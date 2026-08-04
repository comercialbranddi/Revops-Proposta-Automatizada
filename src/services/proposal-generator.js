/**
 * Proposta Automatizada — orquestração (piloto, card de teste apenas).
 *
 * Fluxo: deal entra em "Envio de proposta" (pipe Vendas) → busca dados do
 * deal → resolve a combinação de produtos selecionados → copia o modelo
 * certo (1 produto = modelo simples; 2+ produtos = modelo pré-mesclado) →
 * preenche placeholders → escreve o link de volta no campo "Link Proposta"
 * → nota no card.
 *
 * Combinações de 2+ produtos usam um modelo PRÉ-GERADO (mesma pasta do
 * Drive, cadastrado em PROPOSAL_TEMPLATES com a chave "BB+GD" etc.) — a
 * prosa de transição entre produtos foi escrita uma vez, na criação desse
 * modelo, não em tempo real. Isso evita qualquer dependência de IA (custo/
 * quota) no caminho de produção — é sempre copyTemplate + replaceAllText,
 * igual pra 1 ou N produtos. Se a combinação do deal não tiver modelo
 * cadastrado ainda, a automação pula e o card segue no fluxo manual.
 */
import { pdGet, pdPut, pdPost } from './pipedrive.js';
import { copyTemplate, replacePlaceholders, shareWithDomain, getDocUrl } from './google-docs-client.js';
import {
    PROPOSAL_TEMPLATES, PROPOSAL_OUTPUT_FOLDER_ID, PROPOSAL_DEAL_FIELDS,
    getProductByPrincipalOptionId, parseServicoOferecido, PRODUCT_CASCADE_ORDER,
} from '../config/proposal.js';
import { getContextLogger } from '../lib/logger.js';
import supabase from './supabase-client.js';

const log = getContextLogger('services:proposal-generator');

function formatDateBR(date = new Date()) {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${date.getDate().toString().padStart(2, '0')} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatBRL(value) {
    if (value == null) return null;
    return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/mês`;
}

async function logAttempt(dealId, status, extra = {}) {
    if (!supabase) return;
    try {
        await supabase.from('proposal_generation_log').insert({ deal_id: dealId, status, ...extra });
    } catch (err) {
        log.warn(`falha ao gravar audit log: ${err.message}`);
    }
}

/** Resolve os códigos de produto selecionados no deal, na ordem de cascata. */
function resolveProductCodes(deal) {
    const multi = parseServicoOferecido(deal[PROPOSAL_DEAL_FIELDS.SERVICO_OFERECIDO]);
    if (multi.length > 0) {
        return PRODUCT_CASCADE_ORDER.filter(code => multi.includes(code));
    }
    // Fallback: sem "Serviço oferecido" preenchido, usa o Produto Principal (single).
    const principal = getProductByPrincipalOptionId(deal[PROPOSAL_DEAL_FIELDS.PRODUTO_PRINCIPAL]);
    return principal ? [principal.code] : [];
}

/**
 * Gera a proposta pro deal informado e escreve o link de volta no Pipedrive.
 * Nunca lança — qualquer falha é logada e o card segue no fluxo manual normal.
 */
export async function generateProposalForDeal(dealId) {
    try {
        const dealRes = await pdGet(`/deals/${dealId}`);
        const deal = dealRes?.data;
        if (!deal) {
            log.warn(`deal #${dealId} não encontrado`);
            await logAttempt(dealId, 'error', { error: 'deal_not_found' });
            return;
        }

        const productCodes = resolveProductCodes(deal);
        const templateKey = productCodes.join('+'); // "BB" (1 produto) ou "BB+GD" (combinação)
        const template = productCodes.length > 0 && PROPOSAL_TEMPLATES[templateKey];

        if (!template) {
            log.warn(`deal #${dealId}: sem template pra "${templateKey || 'nenhum produto'}" — fica no fluxo manual`);
            await logAttempt(dealId, 'skipped_no_template', { product_code: templateKey || null });
            return;
        }

        const orgName = deal.org_name || deal.org_id?.name || 'Cliente';
        const decisorName = deal.person_name || deal.person_id?.name || orgName;
        const price = deal[PROPOSAL_DEAL_FIELDS.PRODUTO_PRECO] ?? deal.value;

        // Modelos de combinação (2+ produtos) têm o preço de CADA produto
        // escrito como o mesmo literal "R$ 9.900/mês" — não há como saber,
        // via replaceAllText, qual ocorrência pertence a qual produto. Como
        // o Pipedrive só guarda um preço por deal (não por produto), tentar
        // substituir aqui sobrescreveria o preço individual de todos os
        // produtos pelo valor total do card. Em vez disso, pula a
        // substituição de preço nos combos e deixa explícito na nota que a
        // precificação por produto precisa ser preenchida manualmente.
        const isCombo = productCodes.length > 1;

        const newName = `Proposta_${orgName}_${templateKey}_${new Date().toISOString().slice(0, 10)}`;
        const copyId = await copyTemplate(template.docId, newName, PROPOSAL_OUTPUT_FOLDER_ID);

        // "XX de [mês] de [ano]" é substituído como frase única — trocar só
        // "XX" isoladamente colidiria com "Até XX SKUs" (mesmo token,
        // significado diferente, sem contexto pra distinguir).
        await replacePlaceholders(copyId, {
            'XX de [mês] de [ano]': formatDateBR(),
            '{{MARCA}}': orgName,
            '{{DECISOR}}': decisorName,
            ...(isCombo ? {} : { 'R$ 9.900/mês': formatBRL(price) || 'R$ 9.900/mês' }),
        });

        await shareWithDomain(copyId).catch((err) => {
            log.warn(`shareWithDomain falhou (não bloqueante): ${err.message}`);
        });

        const docUrl = getDocUrl(copyId);

        await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: docUrl });

        const noteContent = isCombo
            ? `Proposta gerada automaticamente (piloto) — combinação de ${productCodes.length} produtos, preencher o preço de cada produto manualmente antes de enviar.\n${docUrl}`
            : `Proposta gerada automaticamente (piloto) — revisar conteúdo antes de enviar.\n${docUrl}`;

        await pdPost('/notes', {
            deal_id: dealId,
            content: noteContent,
        });

        log.info(`✅ Proposta gerada pro deal #${dealId} (${templateKey}): ${docUrl}`);
        await logAttempt(dealId, 'success', { template_used: templateKey, doc_url: docUrl });
    } catch (err) {
        log.error(`deal #${dealId} falhou: ${err.message}`);
        await logAttempt(dealId, 'error', { error: err.message });
    }
}
