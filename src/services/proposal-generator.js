/**
 * Proposta Automatizada — orquestração (piloto, card de teste apenas).
 *
 * Fluxo: deal entra em "Envio de proposta" (pipe Vendas) → busca dados do
 * deal → copia o template do produto → preenche placeholders → escreve o
 * link de volta no campo "Link Proposta" → nota no card.
 *
 * Modelo usa placeholders únicos por campo ({{MARCA}}, {{DECISOR}}) desde
 * 31/07/2026 — antes disso "XXX" era usado pros dois, sem distinção
 * possível via replaceAllText (troca todas as ocorrências pelo mesmo
 * valor). Resolvido editando o doc "Cópia de Modelos" direto.
 */
import { pdGet, pdPut, pdPost } from './pipedrive.js';
import { copyTemplate, replacePlaceholders, shareWithDomain, getDocUrl } from './google-docs-client.js';
import { PROPOSAL_TEMPLATES, PROPOSAL_OUTPUT_FOLDER_ID, PROPOSAL_DEAL_FIELDS, getProductByPrincipalOptionId } from '../config/proposal.js';
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

        const productOptionId = deal[PROPOSAL_DEAL_FIELDS.PRODUTO_PRINCIPAL];
        const product = getProductByPrincipalOptionId(productOptionId);
        const productCode = product?.code;
        const template = productCode && PROPOSAL_TEMPLATES[productCode];

        if (!template) {
            log.warn(`deal #${dealId}: sem template pro produto (option=${productOptionId}, code=${productCode}) — fica no fluxo manual`);
            await logAttempt(dealId, 'skipped_no_template', { product_code: productCode || null });
            return;
        }

        const orgName = deal.org_name || deal.org_id?.name || 'Cliente';
        const decisorName = deal.person_name || deal.person_id?.name || orgName;
        const price = deal[PROPOSAL_DEAL_FIELDS.PRODUTO_PRECO] ?? deal.value;

        const newName = `Proposta_${orgName}_${productCode}_${new Date().toISOString().slice(0, 10)}`;
        const copyId = await copyTemplate(template.docId, newName, PROPOSAL_OUTPUT_FOLDER_ID);

        // "XX de [mês] de [ano]" é substituído como frase única — trocar só
        // "XX" isoladamente colidiria com "Até XX SKUs" (mesmo token,
        // significado diferente, sem contexto pra distinguir).
        await replacePlaceholders(copyId, {
            'XX de [mês] de [ano]': formatDateBR(),
            '{{MARCA}}': orgName,
            '{{DECISOR}}': decisorName,
            'R$ 9.900/mês': formatBRL(price) || 'R$ 9.900/mês',
        });

        await shareWithDomain(copyId).catch((err) => {
            log.warn(`shareWithDomain falhou (não bloqueante): ${err.message}`);
        });

        const docUrl = getDocUrl(copyId);

        await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: docUrl });

        await pdPost('/notes', {
            deal_id: dealId,
            content: `Proposta gerada automaticamente (piloto) — revisar conteúdo antes de enviar.\n${docUrl}`,
        });

        log.info(`✅ Proposta gerada pro deal #${dealId}: ${docUrl}`);
        await logAttempt(dealId, 'success', { template_used: productCode, doc_url: docUrl });
    } catch (err) {
        log.error(`deal #${dealId} falhou: ${err.message}`);
        await logAttempt(dealId, 'error', { error: err.message });
    }
}
