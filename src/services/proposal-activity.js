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
    // `type` na QUERY, não só no filtro em memória: um card de uso pesado passa
    // de 100 atividades abertas e o limite da página corta — no 60956 a
    // atividade criada minutos antes ficou de fora da resposta, e o link foi
    // parar numa de cinco semanas atrás. Filtrando na origem, voltam 10.
    const r = await pdGet(`/activities?deal_id=${dealId}&done=0&type=${ATIVIDADE_PROPOSTA_TYPE}&limit=100`);
    return (r?.data || [])
        .filter((a) => a.active_flag !== false && a.type === ATIVIDADE_PROPOSTA_TYPE)
        // Mais RECENTE primeiro. A ordem que a API devolve não é a de criação, e
        // um card pode ter mais de uma atividade de proposta aberta — o 60956
        // tinha duas, uma de 13/07 e a de hoje. Sem ordenar, o link ia parar na
        // de cinco semanas atrás, que ninguém mais abre.
        .sort((a, b) => String(b.add_time || '').localeCompare(String(a.add_time || '')));
}

/** O trecho de nota que leva o closer ao formulário. */
function blocoLink(dealId) {
    const url = formUrlDoDeal(dealId);
    return [
        `<p>Monte a proposta pelo formulário:</p>`,
        `<p><a href="${url}">${url}</a></p>`,
    ].join('');
}

/**
 * Garante que o negócio tenha UMA atividade de proposta aberta, com o link do
 * formulário, no nome do dono.
 *
 * A ordem importa: o funil JÁ TEM uma automação nativa do Pipedrive que cria
 * "Enviar Proposta Comercial" na entrada da etapa (confirmado em 18/08/2026 no
 * card 60956 — `reference_type: automation`, nota vazia). Criar outra deixaria
 * duas tarefas no card pro mesmo trabalho.
 *
 * Então o caminho normal é ENRIQUECER a que existe: ela já traz o hábito do
 * time e o dono certo; o que falta nela é o link. Criar do zero virou o
 * fallback, pra quando a automação nativa não tiver rodado.
 *
 * Devolve { acao, activityId } — 'criada' | 'link_incluido' | 'ja_tinha_link'.
 */
export async function ensureProposalActivity(dealId, deal) {
    const jaAbertas = await abertasDoDeal(dealId);
    if (jaAbertas.length) {
        const alvo = jaAbertas[0];
        const url = formUrlDoDeal(dealId);
        // Idempotente: o webhook dispara a cada edição do card (15 vezes em 2
        // segundos no teste real), então sem esta checagem a nota ganharia o
        // mesmo link uma dúzia de vezes.
        if (String(alvo.note || '').includes(url)) {
            log.info(`deal #${dealId}: atividade #${alvo.id} já tem o link — nada a fazer`);
            return { acao: 'ja_tinha_link', activityId: alvo.id };
        }
        const notaAtual = String(alvo.note || '').trim();
        await pdPut(`/activities/${alvo.id}`, { note: notaAtual ? `${notaAtual}${blocoLink(dealId)}` : blocoLink(dealId) });
        log.info(`deal #${dealId}: link do formulário incluído na atividade #${alvo.id}`);
        return { acao: 'link_incluido', activityId: alvo.id };
    }

    const ownerId = donoDoDeal(deal);
    // Sem dono a atividade cairia no usuário do token da API — o RevOps viraria
    // responsável por gerar a proposta de um card que não é dele.
    if (!ownerId) {
        log.warn(`deal #${dealId}: sem dono definido — atividade NÃO criada`);
        return { acao: 'sem_dono', activityId: null };
    }

    const criada = await pdPost('/activities', {
        subject: ATIVIDADE_PROPOSTA_ASSUNTO,
        type: ATIVIDADE_PROPOSTA_TYPE,
        deal_id: Number(dealId),
        user_id: ownerId,
        due_date: vencimento(),
        note: blocoLink(dealId),
    });

    const activityId = criada?.data?.id ?? null;
    log.info(`deal #${dealId}: atividade de proposta #${activityId} criada para o usuário ${ownerId}`);
    return { acao: 'criada', activityId };
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
