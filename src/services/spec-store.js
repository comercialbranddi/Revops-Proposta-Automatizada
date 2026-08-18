/**
 * Onde o formulário grava o que foi preenchido.
 *
 * Uma PLANILHA no Drive, não banco: a Branddi não tem Supabase (a dependência
 * está no package.json de vários repos e engana — as variáveis nunca
 * existiram; o .env.example registra a decisão de 07/08/2026 de rodar sem
 * banco). O que existe e está pago é o Google Workspace, e a service account
 * `proposal-bot@automacoes-pipedrive` já tem escopo `drive`, que a API de
 * Sheets aceita. Zero fornecedor novo, zero acesso novo.
 *
 * O trato é append-only: cada envio do formulário é uma LINHA nova, nunca uma
 * edição. Proposta é documento datado — se o preço for renegociado em
 * setembro, a linha de agosto tem que continuar dizendo o que o cliente
 * recebeu. Por isso "revisão" em vez de sobrescrita.
 *
 * A única exceção são as duas colunas de saída (doc_url, gerado_em), que só
 * existem depois que a proposta é gerada. Elas são escritas uma vez, na linha
 * que já está lá. O `spec` em si nunca é tocado.
 *
 * Limite conhecido: planilha não é banco. Sem transação — dois envios
 * simultâneos pro MESMO negócio podem calcular a mesma revisão. Com o volume
 * real (359 negócios chegaram em "Envio de proposta" na vida inteira do
 * funil), é aceitável; se um dia deixar de ser, isto vira tabela de verdade
 * sem mudar quem chama.
 */
import { authedFetch } from './google-docs-client.js';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:spec-store');

const SHEET_ID = process.env.PROPOSAL_SPEC_SHEET_ID || null;
const ABA = 'specs';

// A ordem é contrato: mudou aqui, muda em lerLinha() e nas escritas.
export const COLUNAS = ['registrado_em', 'deal_id', 'revisao', 'criado_por', 'doc_url', 'gerado_em', 'spec_json'];

const base = () => `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

function exigeConfig() {
    if (!SHEET_ID) throw new Error('PROPOSAL_SPEC_SHEET_ID não configurada — o formulário não tem onde gravar');
}

async function lerTudo() {
    exigeConfig();
    const res = await authedFetch(`${base()}/values/${ABA}!A2:G?majorDimension=ROWS`);
    const { values = [] } = await res.json();
    return values;
}

function lerLinha(v, i) {
    const [registrado_em, deal_id, revisao, criado_por, doc_url, gerado_em, spec_json] = v;
    let spec = null;
    try { spec = spec_json ? JSON.parse(spec_json) : null; } catch { spec = null; }
    // linha da planilha: +2 porque a 1 é cabeçalho e o array começa em 0.
    return { linha: i + 2, registrado_em, deal_id: Number(deal_id), revisao: Number(revisao), criado_por, doc_url: doc_url || null, gerado_em: gerado_em || null, spec };
}

/** Garante a aba e o cabeçalho. Idempotente — roda no primeiro uso. */
export async function ensureSheet() {
    exigeConfig();
    const meta = await (await authedFetch(`${base()}?fields=sheets.properties.title`)).json();
    const existe = (meta.sheets || []).some((s) => s.properties?.title === ABA);
    if (!existe) {
        await authedFetch(`${base()}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ addSheet: { properties: { title: ABA } } }] }),
        });
        log.info(`aba "${ABA}" criada`);
    }
    const primeira = await (await authedFetch(`${base()}/values/${ABA}!A1:G1`)).json();
    if (!primeira.values?.length) {
        await authedFetch(`${base()}/values/${ABA}!A1?valueInputOption=RAW`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [COLUNAS] }),
        });
        log.info('cabeçalho escrito');
    }
}

/** A revisão mais recente desse negócio, ou null. */
export async function ultimaSpec(dealId) {
    const linhas = (await lerTudo()).map(lerLinha).filter((r) => r.deal_id === Number(dealId));
    if (!linhas.length) return null;
    return linhas.reduce((a, b) => (b.revisao >= a.revisao ? b : a));
}

/** Grava um envio novo. Devolve { revisao, linha }. */
export async function salvarSpec(dealId, criadoPor, spec) {
    await ensureSheet();
    const anterior = await ultimaSpec(dealId);
    const revisao = (anterior?.revisao || 0) + 1;
    const linha = [new Date().toISOString(), String(dealId), String(revisao), criadoPor, '', '', JSON.stringify(spec)];
    await authedFetch(`${base()}/values/${ABA}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [linha] }),
    });
    log.info(`deal #${dealId}: spec revisão ${revisao} gravada por ${criadoPor}`);
    return { revisao };
}

/**
 * Carimba o documento na revisão indicada. Escreve SÓ doc_url e gerado_em —
 * as duas colunas que não existiam na hora do envio.
 */
export async function marcarGerada(dealId, revisao, docUrl) {
    const alvo = (await lerTudo()).map(lerLinha)
        .find((r) => r.deal_id === Number(dealId) && r.revisao === Number(revisao));
    if (!alvo) { log.warn(`deal #${dealId} rev ${revisao}: linha não encontrada — doc_url não carimbado`); return false; }
    await authedFetch(`${base()}/values/${ABA}!E${alvo.linha}:F${alvo.linha}?valueInputOption=RAW`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[docUrl, new Date().toISOString()]] }),
    });
    return true;
}
