/**
 * Google Docs/Drive client — geração de proposta.
 *
 * REST direto via google-auth-library (JWT da service account) em vez do
 * pacote `googleapis` — mais leve, só 4 chamadas precisam ser feitas.
 *
 * Credencial: GOOGLE_PROPOSAL_SA_KEY_BASE64 (JSON da service account,
 * codificado em base64) — nunca comitar o valor real, só a env var na
 * Vercel. Escopos: Docs (leitura/escrita) + Drive (copiar/exportar/compartilhar).
 */
import { JWT } from 'google-auth-library';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:google-docs-client');

const SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
];

let _client = null;

function getClient() {
    if (_client) return _client;
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) {
        throw new Error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada');
    }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    _client = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: SCOPES,
    });
    return _client;
}

async function authedFetch(url, opts = {}) {
    const client = getClient();
    const { token } = await client.getAccessToken();
    const res = await fetch(url, {
        ...opts,
        headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Google API ${opts.method || 'GET'} ${url} → HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
}

/**
 * Copia o template pra um novo arquivo (nome + pasta de destino opcional).
 * supportsAllDrives=true é obrigatório pra funcionar com Drives Compartilhados
 * (sem isso, a cópia tenta usar o storage da própria service account, que é
 * zero — dá "storageQuotaExceeded"). destFolderId precisa ser uma pasta
 * DENTRO de um Drive Compartilhado, não uma pasta comum compartilhada.
 */
export async function copyTemplate(templateDocId, newName, destFolderId) {
    const res = await authedFetch(`https://www.googleapis.com/drive/v3/files/${templateDocId}/copy?supportsAllDrives=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, ...(destFolderId ? { parents: [destFolderId] } : {}) }),
    });
    const body = await res.json();
    log.info(`📄 Cópia criada: ${body.id} ("${newName}")`);
    return body.id;
}

/**
 * Substitui placeholders no documento copiado.
 * @param {string} docId
 * @param {Record<string,string>} replacements — chave = texto literal a buscar, valor = substituição
 */
export async function replacePlaceholders(docId, replacements) {
    const requests = Object.entries(replacements)
        .filter(([, value]) => value != null && value !== '')
        .map(([find, replaceText]) => ({
            replaceAllText: { containsText: { text: find, matchCase: true }, replaceText: String(replaceText) },
        }));
    if (requests.length === 0) return;
    await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
    });
    log.info(`✏️  ${requests.length} placeholders substituídos em ${docId}`);
}

/** Garante compartilhamento (domínio branddi.com, mesmo nível dos docs manuais). */
export async function shareWithDomain(fileId, domain = 'branddi.com', role = 'writer') {
    await authedFetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'domain', domain, role }),
    });
}

/** Exporta o Doc como PDF (bytes) — equivalente a "Arquivo > Fazer download > PDF". */
export async function exportAsPdf(docId) {
    const res = await authedFetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf&supportsAllDrives=true`);
    return Buffer.from(await res.arrayBuffer());
}

export function getDocUrl(docId) {
    return `https://docs.google.com/document/d/${docId}/edit`;
}

/** Lê o texto puro de um doc (concatena os textRuns dos parágrafos do corpo). */
export async function getPlainText(docId) {
    const res = await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}`);
    const body = await res.json();
    const content = body.body?.content || [];
    let text = '';
    for (const el of content) {
        const elements = el.paragraph?.elements || [];
        for (const run of elements) {
            text += run.textRun?.content || '';
        }
    }
    return text;
}

/**
 * Cria um Doc em branco DENTRO da pasta de destino (Drive Compartilhado).
 * Usa Drive API files.create (não Docs API documents.create) — criar já
 * com parents definido evita o problema de storageQuotaExceeded (o arquivo
 * nasce no Drive Compartilhado, nunca passa pelo storage próprio da
 * service account).
 */
export async function createBlankDoc(name, destFolderId) {
    const res = await authedFetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.document',
            ...(destFolderId ? { parents: [destFolderId] } : {}),
        }),
    });
    const body = await res.json();
    log.info(`📄 Doc em branco criado: ${body.id} ("${name}")`);
    return body.id;
}

/** Insere texto puro no início do doc (índice 1 — logo depois do parágrafo inicial vazio). */
export async function insertText(docId, text) {
    await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text } }] }),
    });
}

/**
 * Aplica um estilo de parágrafo (ex: 'HEADING_1') num range de índices
 * [startIndex, endIndex). Usado pra formatar títulos depois de inserir o
 * texto puro — os índices vêm de calcular offsets no próprio texto que a
 * gente montou (contagem de unidades UTF-16, mesma base do Docs API).
 */
export async function applyParagraphStyle(docId, startIndex, endIndex, namedStyleType) {
    await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [{
                updateParagraphStyle: {
                    range: { startIndex, endIndex },
                    paragraphStyle: { namedStyleType },
                    fields: 'namedStyleType',
                },
            }],
        }),
    });
}

/** Aplica batchUpdate genérico — usado pra agrupar várias formatações numa chamada só. */
export async function batchUpdate(docId, requests) {
    if (requests.length === 0) return;
    await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
    });
}
