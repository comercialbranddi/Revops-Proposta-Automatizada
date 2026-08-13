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

/**
 * Apaga do documento os parágrafos que começam com algum dos prefixos dados.
 *
 * Existe porque replaceAllText não dá conta: trocar o texto por "" deixa o
 * parágrafo vazio, e uma linha em branco sobrando no meio da Proposta Comercial
 * é visível. Aqui some a linha inteira, marca de parágrafo junto.
 *
 * Os ranges são apagados do fim pro começo — deletar do começo desloca os
 * índices de tudo que vem depois, e o segundo delete cairia no lugar errado.
 *
 * @returns {number} quantos parágrafos foram apagados
 */
export async function deleteParagraphsStartingWith(docId, prefixes) {
    const alvos = (Array.isArray(prefixes) ? prefixes : [prefixes]).filter(Boolean);
    if (alvos.length === 0) return 0;

    const doc = await (await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`)).json();
    // Os modelos vivem numa aba só, mas um documento pode ter várias e o corpo
    // clássico (doc.body) some quando includeTabsContent está ligado.
    const corpos = [
        ...(doc.body ? [doc.body] : []),
        ...(doc.tabs || []).map((t) => t.documentTab?.body).filter(Boolean),
    ];

    const ranges = [];
    for (const corpo of corpos) {
        for (const el of corpo.content || []) {
            if (!el.paragraph) continue;
            const texto = (el.paragraph.elements || [])
                .map((e) => e.textRun?.content || '')
                .join('')
                .trim();
            if (alvos.some((p) => texto.startsWith(p))) {
                ranges.push({ startIndex: el.startIndex, endIndex: el.endIndex });
            }
        }
    }
    if (ranges.length === 0) {
        log.warn(`nenhum parágrafo começando com ${JSON.stringify(alvos)} em ${docId} — o texto do modelo mudou?`);
        return 0;
    }

    ranges.sort((a, b) => b.startIndex - a.startIndex);
    await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: ranges.map((range) => ({ deleteContentRange: { range } })) }),
    });
    log.info(`🗑️  ${ranges.length} parágrafo(s) removido(s) de ${docId}`);
    return ranges.length;
}

/**
 * Troca um parágrafo por várias linhas, cada uma com rótulo normal e valor em
 * negrito.
 *
 * Serve pra escada de preço do Brand Bidding: o modelo traz uma linha só
 * ("Palavras-chave: Até N palavras.") e a proposta em faixas precisa de uma
 * linha por faixa. replaceAllText não resolve — ele troca texto dentro do
 * parágrafo, não cria parágrafos.
 *
 * O estilo não é inventado: sai dos DOIS runs do parágrafo que está sendo
 * trocado, que já é "rótulo normal + valor em negrito". Assim as linhas novas
 * herdam fonte, tamanho e cor do modelo, sem nada codificado aqui — foi
 * justamente estilo escrito na mão que deixou os combos em Arial.
 *
 * @param {string} docId
 * @param {string} prefixo  começo do parágrafo a substituir
 * @param {Array<{rotulo: string, valor: string}>} linhas
 * @returns {number} quantas linhas foram escritas (0 = parágrafo não encontrado)
 */
export async function replaceParagraphWithLines(docId, prefixo, linhas) {
    if (!linhas?.length) return 0;

    const doc = await (await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`)).json();
    const corpos = [
        ...(doc.body ? [doc.body] : []),
        ...(doc.tabs || []).map((t) => t.documentTab?.body).filter(Boolean),
    ];

    let alvo = null;
    for (const corpo of corpos) {
        for (const el of corpo.content || []) {
            if (!el.paragraph) continue;
            const runs = (el.paragraph.elements || []).filter((e) => e.textRun);
            const texto = runs.map((e) => e.textRun.content).join('').replace(/\n/g, '');
            if (texto.trim().startsWith(prefixo)) {
                alvo = { el, runs, keepWithNext: el.paragraph.paragraphStyle?.keepWithNext === true };
                break;
            }
        }
        if (alvo) break;
    }
    if (!alvo) {
        log.warn(`parágrafo começando com "${prefixo}" não encontrado em ${docId} — o modelo mudou?`);
        return 0;
    }

    // Estilo do rótulo e do valor, lidos do próprio parágrafo. Se ele tiver um
    // run só, os dois saem iguais e o negrito é aplicado por cima.
    const comTexto = alvo.runs.filter((e) => e.textRun.content.replace(/\n/g, '').length);
    const estiloRotulo = { ...(comTexto[0]?.textRun.textStyle || {}), bold: false };
    const estiloValor = { ...(comTexto[comTexto.length - 1]?.textRun.textStyle || comTexto[0]?.textRun.textStyle || {}), bold: true };

    const inicio = alvo.el.startIndex;
    const fimTexto = alvo.el.endIndex - 1;   // preserva a marca de parágrafo

    // Apaga o conteúdo e escreve tudo de uma vez. O "\n" entre as linhas cria
    // parágrafos novos, que herdam o estilo de parágrafo do original — é por
    // isso que o recuo e o alinhamento continuam batendo com o resto da seção.
    const texto = linhas.map((l) => `${l.rotulo}${l.valor}`).join('\n');
    await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [
                ...(fimTexto > inicio ? [{ deleteContentRange: { range: { startIndex: inicio, endIndex: fimTexto } } }] : []),
                { insertText: { location: { index: inicio }, text: texto } },
            ],
        }),
    });

    // Estilos numa segunda passada: os índices só são conhecidos depois que o
    // texto existe, e são calculados a partir do início, que não se moveu.
    const requests = [];
    let off = inicio;
    for (const [i, l] of linhas.entries()) {
        const fimLinha = off + l.rotulo.length + l.valor.length;
        if (l.rotulo.length) requests.push({ updateTextStyle: { range: { startIndex: off, endIndex: off + l.rotulo.length }, textStyle: estiloRotulo, fields: '*' } });
        if (l.valor.length) requests.push({ updateTextStyle: { range: { startIndex: off + l.rotulo.length, endIndex: fimLinha }, textStyle: estiloValor, fields: '*' } });

        // Parágrafo criado nasce SEM keepWithNext, e a escada é justamente um
        // bloco que não pode ser partido: sem isto o documento volta a quebrar
        // a página entre duas faixas de preço. As linhas do meio prendem a
        // seguinte; a última herda o que o parágrafo original tinha, porque
        // depois dela vem o mesmo que vinha antes.
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: off, endIndex: fimLinha + 1 },
                paragraphStyle: { keepWithNext: i < linhas.length - 1 ? true : alvo.keepWithNext },
                fields: 'keepWithNext',
            },
        });
        off = fimLinha + 1;   // +1 pela quebra de parágrafo
    }
    if (requests.length) {
        await authedFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
        });
    }
    log.info(`📐 ${linhas.length} linha(s) no lugar de "${prefixo}…" em ${docId}`);
    return linhas.length;
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
