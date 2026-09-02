/**
 * A nota com o link do formulário, na entrada de "Envio de proposta".
 *
 * Pedido da Jessica em 25/08/2026: o time vai validar o modelo novo usando de
 * verdade, então cada card que entra na etapa precisa ter o link à mão. É SÓ
 * isso — nada de atividade (a de "Gerar proposta pelo formulário" segue
 * desligada desde 19/08) e nada de mexer na geração antiga, que continua
 * atrás da trava de piloto.
 *
 * ─── Por que fora da trava de piloto ────────────────────────────────
 *
 * `isProposalAutomationEnabledForDeal` prende a GERAÇÃO ao card de teste
 * (PROPOSAL_TEST_ONLY=true, deal 60956). Pendurar a nota na mesma porta
 * entregaria o link em um card só — o oposto do pedido. A nota tem a sua
 * própria chave (PROPOSAL_NOTA_LINK_ENABLED), porque o risco é outro: a
 * geração escreve no card e cria documento; a nota é um link.
 *
 * ─── Não duplicar ───────────────────────────────────────────────────
 *
 * O webhook reage a qualquer update do card na etapa, e `isEntry` já filtra a
 * maior parte — mas um card pode sair e voltar, e o Pipedrive pode mandar o
 * mesmo evento de entrada mais de uma vez. Como o link de um negócio é sempre
 * o mesmo, a checagem é direta: se alguma nota do card já tem esta URL, não
 * posta de novo. Sem janela de tempo — nota repetida com o mesmo link é ruído
 * em qualquer intervalo.
 */
import { pdGet, pdPost, pdPut } from './pipedrive.js';
import { formUrlDoDeal, PROPOSAL_FORM_DOMAIN, PROPOSAL_DEAL_FIELDS } from '../config/proposal.js';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:proposal-form-note');

/** O corpo da nota. HTML simples — é o que o Pipedrive renderiza na timeline. */
export function corpoDaNota(dealId) {
    const url = formUrlDoDeal(dealId);
    return [
        '<p><b>Proposta comercial — modelo novo</b></p>',
        '<p>Monte a proposta deste negócio pelo formulário:</p>',
        `<p><a href="${url}">${url}</a></p>`,
        `<p>Entre com a conta @${PROPOSAL_FORM_DOMAIN}. O formulário pede serviços, canais, quantidades, preços e condições, e devolve a proposta pronta em PDF para enviar ao cliente.</p>`,
    ].join('');
}

/** True se o card já tem uma nota com este link. */
async function jaTemONota(dealId, url) {
    // 100 é folga larga: o card mais movimentado do funil tem dezenas de notas.
    // Se um dia estourar, o pior caso é uma nota repetida — não uma falha.
    const r = await pdGet(`/notes?deal_id=${dealId}&limit=100&sort=add_time%20DESC`);
    return (r?.data || []).some((n) => String(n.content || '').includes(url));
}

/**
 * Só o campo do link — sem nota, sem checar duplicata (é idempotente: o link
 * é derivado do id do card e nunca muda). NUNCA lança.
 *
 * Usado em dois lugares: aqui embaixo (na entrada de "Proposta enviada",
 * antes da nota) e no webhook, pra QUALQUER card do pipe de vendas ganhar o
 * campo assim que entra, em qualquer fase — pedido de 02/09/2026, pra o
 * closer não precisar mover o card só pra ter o link à mão. Sem nota nem
 * atividade nesse caminho: essas continuam presas à entrada em "Proposta
 * enviada", do jeito que já eram.
 */
export async function gravarLinkDoFormulario(dealId) {
    try {
        await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.FORM_PROPOSTA]: formUrlDoDeal(dealId) });
        return true;
    } catch (err) {
        log.warn(`deal #${dealId}: não consegui gravar o link do formulário no campo — ${err.message}`);
        return false;
    }
}

/**
 * Posta a nota do formulário no card, uma vez só.
 *
 * NUNCA lança: esta nota é conveniência para o time, e uma falha aqui não pode
 * derrubar o resto do que o webhook faz. Devolve o que aconteceu, pro log.
 *
 * @returns {Promise<'postada'|'ja_tinha'|'erro'>}
 */
export async function postarNotaDoFormulario(dealId) {
    const url = formUrlDoDeal(dealId);
    await gravarLinkDoFormulario(dealId);

    try {
        if (await jaTemONota(dealId, url)) {
            log.info(`deal #${dealId}: já tem nota com o link do formulário — nada a fazer`);
            return 'ja_tinha';
        }
        await pdPost('/notes', { deal_id: Number(dealId), content: corpoDaNota(dealId) });
        log.info(`deal #${dealId}: nota com o link do formulário postada`);
        return 'postada';
    } catch (err) {
        log.warn(`deal #${dealId}: não consegui postar a nota do formulário — ${err.message}`);
        return 'erro';
    }
}
