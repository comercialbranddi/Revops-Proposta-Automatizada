/**
 * A atividade que leva o closer ao formulário da proposta.
 *
 * Quando o negócio entra em "Envio de proposta", o DONO DO NEGÓCIO recebe uma
 * atividade "Gerar proposta pelo formulário" com o link. É o único caminho de
 * entrada: a geração automática a partir dos campos do card saiu (ver o bloco
 * "Formulário de proposta" em config/proposal.js pro porquê, com números).
 *
 * Duas garantias que este módulo precisa dar, e que não são detalhe:
 *
 * 1. NÃO DUPLICAR. O webhook reage a qualquer update do card enquanto ele está
 *    na etapa, não só à entrada — um card editado cinco vezes viraria cinco
 *    atividades. Antes de criar, procura uma aberta do mesmo tipo no negócio.
 *
 * 2. FECHAR SOZINHA quando a proposta sair. Atividade que fica aberta depois de
 *    cumprida vira atividade vencida, e o funil de Vendas já tem esse problema
 *    mapeado em outro projeto. A automação nova não pode alimentá-lo.
 */
import { pdGet, pdPost, pdPut } from './pipedrive.js';
import {
    ATIVIDADE_PROPOSTA_TYPE, ATIVIDADE_PROPOSTA_ASSUNTO, ATIVIDADE_PROPOSTA_PRAZO_DIAS,
    formUrlDoDeal,
} from '../config/proposal.js';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:proposal-activity');

const TZ = 'America/Sao_Paulo';

/** O dono do negócio — o campo vem ora como id, ora como objeto. */
export function donoDoDeal(deal) {
    const u = deal?.user_id;
    if (u == null) return null;
    return typeof u === 'object' ? (u.id ?? null) : Number(u);
}

/**
 * Data de vencimento, N dias ÚTEIS à frente, no fuso de São Paulo.
 *
 * Dias úteis e não corridos porque a Vercel roda em UTC e a etapa é medida em
 * dia de trabalho: um card que entra sexta com prazo de 1 dia corrido nasce
 * vencido na segunda de manhã.
 */
export function vencimento(diasUteis = ATIVIDADE_PROPOSTA_PRAZO_DIAS, hoje = new Date()) {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(hoje);
    const d = new Date(`${iso}T12:00:00Z`);
    let faltam = diasUteis;
    while (faltam > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) faltam--;
    }
    return d.toISOString().slice(0, 10);
}

/**
 * As atividades ABERTAS de proposta desse negócio.
 *
 * `active_flag: false` é atividade apagada: ela some da listagem normal mas
 * ainda volta em algumas rotas, e tratá-la como aberta faria a automação nunca
 * mais criar atividade num card onde alguém apagou a anterior.
 */
async function abertasDoDeal(dealId) {
    const r = await pdGet(`/activities?deal_id=${dealId}&done=0&limit=100`);
    return (r?.data || []).filter((a) => a.active_flag !== false && a.type === ATIVIDADE_PROPOSTA_TYPE);
}

/**
 * Garante UMA atividade aberta de proposta no negócio, para o dono dele.
 * Devolve { criada, activityId } — `criada: false` quando já existia.
 */
export async function ensureProposalActivity(dealId, deal) {
    const jaAbertas = await abertasDoDeal(dealId);
    if (jaAbertas.length) {
        log.info(`deal #${dealId}: já tem atividade de proposta aberta (#${jaAbertas[0].id}) — não duplica`);
        return { criada: false, activityId: jaAbertas[0].id };
    }

    const ownerId = donoDoDeal(deal);
    // Sem dono a atividade cairia no usuário do token da API — o RevOps viraria
    // responsável por gerar a proposta de um card que não é dele.
    if (!ownerId) {
        log.warn(`deal #${dealId}: sem dono definido — atividade NÃO criada`);
        return { criada: false, activityId: null, erro: 'sem_dono' };
    }

    const criada = await pdPost('/activities', {
        subject: ATIVIDADE_PROPOSTA_ASSUNTO,
        type: ATIVIDADE_PROPOSTA_TYPE,
        deal_id: Number(dealId),
        user_id: ownerId,
        due_date: vencimento(),
        note: [
            `<p>Abra o formulário para montar a proposta deste negócio:</p>`,
            `<p><a href="${formUrlDoDeal(dealId)}">${formUrlDoDeal(dealId)}</a></p>`,
            `<p>A atividade se fecha sozinha quando a proposta for gerada.</p>`,
        ].join(''),
    });

    const activityId = criada?.data?.id ?? null;
    log.info(`deal #${dealId}: atividade de proposta #${activityId} criada para o usuário ${ownerId}`);
    return { criada: true, activityId };
}

/**
 * Fecha as atividades de proposta abertas do negócio. Chamado depois que a
 * proposta é gerada com sucesso.
 *
 * Falha aqui NÃO derruba a geração: a proposta já existe e o link já está no
 * card. O pior caso é uma atividade que alguém fecha na mão.
 */
export async function closeProposalActivity(dealId) {
    try {
        const abertas = await abertasDoDeal(dealId);
        for (const a of abertas) {
            await pdPut(`/activities/${a.id}`, { done: true });
            log.info(`deal #${dealId}: atividade #${a.id} fechada`);
        }
        return abertas.length;
    } catch (err) {
        log.warn(`deal #${dealId}: não consegui fechar a atividade de proposta — ${err.message}`);
        return 0;
    }
}
