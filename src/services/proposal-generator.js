/**
 * Proposta Automatizada — orquestração (piloto, card de teste apenas).
 *
 * Fluxo: deal entra em "Envio de proposta" (pipe Vendas) → busca dados do
 * deal → resolve 1 ou N produtos selecionados → gera o doc → escreve o
 * link de volta no campo "Link Proposta" → nota no card.
 *
 * 1 produto: copia o template e substitui placeholders direto (rápido,
 * sem IA). 2+ produtos: extrai as seções de cada template, usa Gemini só
 * pra costurar a prosa de transição entre eles (Ponto 4) — preços e specs
 * nunca passam por cálculo da IA, são copiados literalmente ou somados em
 * código antes de chegar no prompt.
 */
import { pdGet, pdPut, pdPost } from './pipedrive.js';
import {
    copyTemplate, replacePlaceholders, shareWithDomain, getDocUrl,
    getPlainText, createBlankDoc, insertText, batchUpdate,
} from './google-docs-client.js';
import { extractSections } from './section-extractor.js';
import { mergeProductSections } from './gemini-client.js';
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

/** Extrai "R$ 9.900/mês" → 9900. Retorna null se o preço ainda for placeholder (ex: "R$ XXXX/mês"). */
function parsePriceLine(comercialText) {
    const match = comercialText.match(/R\$\s*([\d.,]+)\/m[êe]s/i);
    if (!match) return null;
    const numeric = Number(match[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : null;
}

async function generateSingleProductDoc(productCode, orgName, decisorName, price) {
    const template = PROPOSAL_TEMPLATES[productCode];
    const newName = `Proposta_${orgName}_${productCode}_${new Date().toISOString().slice(0, 10)}`;
    const copyId = await copyTemplate(template.docId, newName, PROPOSAL_OUTPUT_FOLDER_ID);

    // "XX de [mês] de [ano]" é substituído como frase única — trocar só "XX"
    // isoladamente colidiria com "Até XX SKUs" (mesmo token, significado
    // diferente, sem contexto pra distinguir).
    await replacePlaceholders(copyId, {
        'XX de [mês] de [ano]': formatDateBR(),
        '{{MARCA}}': orgName,
        '{{DECISOR}}': decisorName,
        'R$ 9.900/mês': formatBRL(price) || 'R$ 9.900/mês',
    });

    await shareWithDomain(copyId).catch((err) => {
        log.warn(`shareWithDomain falhou (não bloqueante): ${err.message}`);
    });

    return copyId;
}

/**
 * Monta o texto final combinando produtos, aplicando o cabeçalho fixo
 * (data/Para/Prezados — não varia por produto, não passa pelo Gemini) +
 * o corpo já costurado pelo Gemini (marcado com "### Título").
 */
function assembleFullText(mergedBody, decisorName) {
    const header = `São Paulo, ${formatDateBR()}.\n\nPara: ${decisorName}\n\n\nPrezados,\n\n`;
    return header + mergedBody.trim() + '\n';
}

/** Localiza as linhas "### Título" no texto final e devolve os ranges (índices UTF-16) pra formatar como heading. */
function findHeadingRanges(fullText) {
    const ranges = [];
    const regex = /^### (.+)$/gm;
    let match;
    // Precisamos dos índices NO TEXTO JÁ SEM "### " (é isso que vai pro doc).
    const cleanedText = fullText.replace(/^### /gm, '');
    let searchFrom = 0;
    while ((match = regex.exec(fullText)) !== null) {
        const title = match[1];
        const cleanIdx = cleanedText.indexOf(title, searchFrom);
        if (cleanIdx !== -1) {
            ranges.push({ start: cleanIdx, end: cleanIdx + title.length });
            searchFrom = cleanIdx + title.length;
        }
    }
    return { cleanedText, ranges };
}

async function generateMultiProductDoc(dealId, productCodes, orgName, decisorName) {
    const sections = await Promise.all(
        productCodes.map(async (code) => {
            const template = PROPOSAL_TEMPLATES[code];
            const plainText = await getPlainText(template.docId);
            return { code, label: template.label, ...extractSections(plainText) };
        })
    );

    // Produto-âncora (primeiro na cascata) fornece as Condições Comerciais
    // — são praticamente idênticas entre produtos, não faz sentido repetir.
    const anchor = sections[0];

    // Preço: soma os preços já definidos em cada modelo (best-effort — não
    // temos breakdown por produto no Pipedrive ainda, só um valor total do
    // deal). Se algum produto ainda não tem preço decidido (placeholder
    // "R$ XXXX/mês"), avisa em vez de inventar número.
    const parsedPrices = sections.map(s => ({ code: s.code, value: parsePriceLine(s.comercial) }));
    const pending = parsedPrices.filter(p => p.value == null).map(p => p.code);
    const total = parsedPrices.reduce((sum, p) => sum + (p.value || 0), 0);
    const totalLine = pending.length > 0
        ? `Total: R$ ${total.toLocaleString('pt-BR')}/mês + preço de ${pending.join('/')} a confirmar`
        : `Total: ${formatBRL(total)}`;

    const mergedBody = await mergeProductSections(sections, anchor.condicoes, totalLine);
    const fullTextRaw = assembleFullText(mergedBody, '{{DECISOR}}');
    const { cleanedText, ranges } = findHeadingRanges(fullTextRaw);

    // Placeholders substituídos em memória — mais simples que replaceAllText
    // via API, já que o texto inteiro ainda está em JS antes de ir pro doc.
    const finalText = cleanedText
        .replaceAll('{{MARCA}}', orgName)
        .replaceAll('{{DECISOR}}', decisorName);

    const productLabel = productCodes.join('+');
    const newName = `Proposta_${orgName}_${productLabel}_${new Date().toISOString().slice(0, 10)}`;
    const docId = await createBlankDoc(newName, PROPOSAL_OUTPUT_FOLDER_ID);

    await insertText(docId, finalText);
    // índice 1 é onde o texto começa (parágrafo inicial vazio do doc em branco)
    const styleRequests = ranges.map(r => ({
        updateParagraphStyle: {
            range: { startIndex: r.start + 1, endIndex: r.end + 1 },
            paragraphStyle: { namedStyleType: 'HEADING_2' },
            fields: 'namedStyleType',
        },
    }));
    await batchUpdate(docId, styleRequests);

    await shareWithDomain(docId).catch((err) => {
        log.warn(`shareWithDomain falhou (não bloqueante): ${err.message}`);
    });

    if (pending.length > 0) {
        log.warn(`deal #${dealId}: total parcial — preço de ${pending.join('/')} ainda não decidido`);
    }

    return docId;
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

        const allCodes = resolveProductCodes(deal);
        const productCodes = allCodes.filter(code => PROPOSAL_TEMPLATES[code]);

        if (productCodes.length === 0) {
            log.warn(`deal #${dealId}: sem produto com template mapeado — fica no fluxo manual`);
            await logAttempt(dealId, 'skipped_no_template', { product_code: allCodes.join(',') || null });
            return;
        }

        const orgName = deal.org_name || deal.org_id?.name || 'Cliente';
        const decisorName = deal.person_name || deal.person_id?.name || orgName;
        const price = deal[PROPOSAL_DEAL_FIELDS.PRODUTO_PRECO] ?? deal.value;

        const docId = productCodes.length === 1
            ? await generateSingleProductDoc(productCodes[0], orgName, decisorName, price)
            : await generateMultiProductDoc(dealId, productCodes, orgName, decisorName);

        const docUrl = getDocUrl(docId);

        await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: docUrl });

        await pdPost('/notes', {
            deal_id: dealId,
            content: `Proposta gerada automaticamente (piloto) — revisar conteúdo antes de enviar.\n${docUrl}`,
        });

        log.info(`✅ Proposta gerada pro deal #${dealId} (${productCodes.join('+')}): ${docUrl}`);
        await logAttempt(dealId, 'success', { template_used: productCodes.join('+'), doc_url: docUrl });
    } catch (err) {
        log.error(`deal #${dealId} falhou: ${err.message}`);
        await logAttempt(dealId, 'error', { error: err.message });
    }
}
