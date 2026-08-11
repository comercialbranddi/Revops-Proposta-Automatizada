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
 * Acha (ou cria) uma subpasta pelo nome dentro de parentId.
 *
 * A proposta vai pra pasta do cliente em vez de cair toda na raiz — com vários
 * cards gerando, a raiz vira uma lista chapada impossível de consultar. Agrupar
 * por cliente mantém o histórico dele junto (renegociação, upsell).
 */
export async function findOrCreateFolder(name, parentId) {
    if (!parentId || !name) return null;
    // Nome vai dentro de string na query do Drive — escapa aspas simples.
    const safeName = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' `
        + `and name = '${safeName}' and trashed = false`;
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`
        + '&fields=files(id,name,createdTime)&supportsAllDrives=true&includeItemsFromAllDrives=true';

    const found = await (await authedFetch(listUrl)).json();
    if (found.files?.length) return found.files[0].id;

    const created = await (await authedFetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    })).json();

    // A trava de geração é por deal, não por cliente: dois deals da mesma
    // organização nova podem criar a pasta ao mesmo tempo. Relê e fica com a
    // mais antiga; se a nossa perdeu, apaga — acabou de nascer e está vazia.
    const depois = await (await authedFetch(listUrl)).json();
    const maisAntiga = (depois.files || []).slice()
        .sort((a, b) => String(a.createdTime).localeCompare(String(b.createdTime)))[0];

    if (maisAntiga && maisAntiga.id !== created.id) {
        log.warn(`📁 corrida na criação de "${name}" — usando a pasta mais antiga e removendo a duplicada`);
        await authedFetch(`https://www.googleapis.com/drive/v3/files/${created.id}?supportsAllDrives=true`, { method: 'DELETE' })
            .catch((err) => log.warn(`não consegui remover a pasta duplicada: ${err.message}`));
        return maisAntiga.id;
    }

    log.info(`📁 Pasta do cliente criada: "${name}" (${created.id})`);
    return created.id;
}

/**
 * Substitui placeholders no documento copiado.
 * @param {string} docId
 * @param {Record<string,string>} replacements — chave = texto literal a buscar, valor = substituição
 */
export async function replacePlaceholders(docId, replacements) {
    // null/undefined significa "não tenho esse valor, deixa o texto como está";
    // string vazia significa "apaga este placeholder". Tratar os dois igual
    // deixava o {{TOTAL_POR}} visível no documento quando a proposta combinada
    // saía sem desconto — que é justamente quando ele não deve aparecer.
    const requests = Object.entries(replacements)
        .filter(([, value]) => value != null)
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
