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
import { randomBytes } from 'node:crypto';
import { authedFetch } from './google-docs-client.js';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:spec-store');

const SHEET_ID = process.env.PROPOSAL_SPEC_SHEET_ID || null;
const ABA = 'specs';

// A ordem é contrato: mudou aqui, muda em lerLinha() e nas escritas.
export const COLUNAS = ['registrado_em', 'deal_id', 'revisao', 'criado_por', 'doc_url', 'gerado_em', 'spec_json', 'slug'];

const base = () => `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

function exigeConfig() {
    if (!SHEET_ID) throw new Error('PROPOSAL_SPEC_SHEET_ID não configurada — o formulário não tem onde gravar');
}

async function lerTudo() {
    exigeConfig();
    const res = await authedFetch(`${base()}/values/${ABA}!A2:H?majorDimension=ROWS`);
    const { values = [] } = await res.json();
    return values;
}

function lerLinha(v, i) {
    const [registrado_em, deal_id, revisao, criado_por, doc_url, gerado_em, spec_json, slug] = v;
    let spec = null;
    try { spec = spec_json ? JSON.parse(spec_json) : null; } catch { spec = null; }
    // linha da planilha: +2 porque a 1 é cabeçalho e o array começa em 0.
    return { linha: i + 2, registrado_em, deal_id: Number(deal_id), revisao: Number(revisao), criado_por,
        doc_url: doc_url || null, gerado_em: gerado_em || null, spec, slug: slug || null };
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
    const primeira = await (await authedFetch(`${base()}/values/${ABA}!A1:H1`)).json();
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

/**
 * O endereço público da proposta. Aleatório e longo em vez de sequencial: o
 * link circula por e-mail e dentro do cliente, e /p/3 deixaria adivinhar a
 * proposta do vizinho. 16 bytes = 22 caracteres, não é adivinhável na força.
 */
function novoSlug() {
    return randomBytes(16).toString('base64url');
}

/** Grava um envio novo. Devolve { revisao, slug }. */
export async function salvarSpec(dealId, criadoPor, spec) {
    await ensureSheet();
    const anterior = await ultimaSpec(dealId);
    const revisao = (anterior?.revisao || 0) + 1;
    const slug = novoSlug();
    const linha = [new Date().toISOString(), String(dealId), String(revisao), criadoPor, '', '', JSON.stringify(spec), slug];
    await authedFetch(`${base()}/values/${ABA}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [linha] }),
    });
    log.info(`deal #${dealId}: spec revisão ${revisao} gravada por ${criadoPor}`);
    return { revisao, slug };
}

/**
 * A proposta de um slug — é o que a página pública abre.
 *
 * Devolve o SPEC congelado, não um HTML congelado: preço, escopo e modalidade
 * são exatamente os do envio, e é isso que precisa ser imutável. O texto dos
 * blocos é lido na hora, então uma correção de redação alcança propostas já
 * enviadas. É o trato certo pra correção de erro, e o errado pra mudança de
 * conteúdo — se um dia o catálogo mudar de forma que não deva alcançar o que
 * já saiu, aí sim vale congelar o HTML junto da linha.
 */
export async function porSlug(slug) {
    if (!slug) return null;
    return (await lerTudo()).map(lerLinha).find((r) => r.slug === slug) || null;
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

// ─── Aberturas ──────────────────────────────────────────────────────
// Aba separada, append-only: uma linha por abertura da página pública. É o
// que o Google Doc nunca deu — saber que o cliente abriu, quando, e quantas
// vezes. Vira gatilho de follow-up: "reabriu três vezes na semana passada".
const ABA_ABERTURAS = 'aberturas';
export const COLUNAS_ABERTURAS = ['quando', 'slug', 'deal_id', 'dispositivo'];

// Varredor de link (antivírus de e-mail, prévia do WhatsApp/Slack, robô de
// busca) abre o link sem ninguém ter lido. Contar isso como interesse do
// cliente é pior que não contar: o closer liga achando que houve leitura.
const ROBO = /bot|crawl|spider|slurp|preview|fetch|monitor|curl|wget|python-requests|headless|facebookexternalhit|whatsapp|slackbot|discord|telegram|linkedinbot|bingpreview/i;

/** True se o user agent é de robô/varredor — a abertura não é contada. */
export function ehRobo(ua) {
    return !ua || ROBO.test(String(ua));
}

function dispositivo(ua) {
    return /mobile|android|iphone|ipad/i.test(String(ua)) ? 'celular' : 'computador';
}

/**
 * Registra uma abertura. Não lança nunca: telemetria que derruba a página do
 * cliente é pior que telemetria que falta.
 *
 * Não guarda IP nem user agent inteiro — só "celular" ou "computador".
 * Registrar quem abriu de onde é dado pessoal, e a pergunta que o comercial
 * precisa responder ("abriram?") não exige isso.
 */
export async function registrarAbertura(slug, dealId, ua) {
    try {
        if (!SHEET_ID || ehRobo(ua)) return false;
        const meta = await (await authedFetch(`${base()}?fields=sheets.properties.title`)).json();
        if (!(meta.sheets || []).some((s) => s.properties?.title === ABA_ABERTURAS)) {
            await authedFetch(`${base()}:batchUpdate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests: [{ addSheet: { properties: { title: ABA_ABERTURAS } } }] }),
            });
            await authedFetch(`${base()}/values/${ABA_ABERTURAS}!A1?valueInputOption=RAW`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [COLUNAS_ABERTURAS] }),
            });
        }
        await authedFetch(`${base()}/values/${ABA_ABERTURAS}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [[new Date().toISOString(), slug, String(dealId), dispositivo(ua)]] }),
        });
        return true;
    } catch (err) {
        log.warn(`abertura de ${slug} não registrada: ${err.message}`);
        return false;
    }
}

/** Resumo das aberturas de um negócio — o que o formulário mostra ao reabrir. */
export async function aberturasDoDeal(dealId) {
    try {
        if (!SHEET_ID) return { total: 0, primeira: null, ultima: null };
        const res = await authedFetch(`${base()}/values/${ABA_ABERTURAS}!A2:D2000`);
        const linhas = ((await res.json()).values || []).filter((v) => String(v[2]) === String(dealId));
        if (!linhas.length) return { total: 0, primeira: null, ultima: null };
        const datas = linhas.map((v) => v[0]).sort();
        return { total: linhas.length, primeira: datas[0], ultima: datas[datas.length - 1] };
    } catch {
        return { total: 0, primeira: null, ultima: null };
    }
}

// ─── Aceite ─────────────────────────────────────────────────────────
// Aba própria, append-only. O aceite é declaração do cliente na página, não
// assinatura qualificada: prova intenção e data, não identidade certificada.
// Se a Branddi precisar de valor probatório pleno, o caminho é assinatura
// eletrônica com certificado — decisão jurídica, não técnica.
const ABA_ACEITES = 'aceites';
export const COLUNAS_ACEITES = ['quando', 'slug', 'deal_id', 'nome', 'email', 'cargo', 'valor'];

/** O aceite de uma proposta, ou null. */
export async function aceiteDe(slug) {
    try {
        if (!SHEET_ID || !slug) return null;
        const res = await authedFetch(`${base()}/values/${ABA_ACEITES}!A2:G1000`);
        const l = ((await res.json()).values || []).find((v) => v[1] === slug);
        if (!l) return null;
        return { quando: l[0], slug: l[1], deal_id: Number(l[2]), nome: l[3], email: l[4], cargo: l[5] || null, valor: l[6] || null };
    } catch {
        // Aba ainda não existe = ninguém aceitou nada. Não é erro.
        return null;
    }
}

/**
 * Registra o aceite. Idempotente pelo slug: a página é pública e um duplo
 * clique — ou alguém curioso com o link — não pode gerar dois aceites nem dois
 * avisos no card.
 *
 * Devolve { novo: false } quando já havia aceite, com o que já estava lá.
 */
export async function registrarAceite(slug, dealId, { nome, email, cargo, valor }) {
    exigeConfig();
    const jaTem = await aceiteDe(slug);
    if (jaTem) return { novo: false, aceite: jaTem };

    const meta = await (await authedFetch(`${base()}?fields=sheets.properties.title`)).json();
    if (!(meta.sheets || []).some((s) => s.properties?.title === ABA_ACEITES)) {
        await authedFetch(`${base()}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ addSheet: { properties: { title: ABA_ACEITES } } }] }),
        });
        await authedFetch(`${base()}/values/${ABA_ACEITES}!A1?valueInputOption=RAW`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [COLUNAS_ACEITES] }),
        });
    }
    const quando = new Date().toISOString();
    await authedFetch(`${base()}/values/${ABA_ACEITES}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[quando, slug, String(dealId), nome, email, cargo || '', String(valor ?? '')]] }),
    });
    log.info(`deal #${dealId}: proposta ${slug} ACEITA por ${nome} <${email}>`);
    return { novo: true, aceite: { quando, slug, deal_id: dealId, nome, email, cargo, valor } };
}
