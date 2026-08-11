/**
 * Uniformiza a formatação dos quatro modelos-base.
 *
 * Eles foram editados à mão em épocas diferentes e misturam 10pt com 11pt (e
 * 13/15pt em alguns pontos) no corpo, além de acumularem linhas em branco em
 * sequência. Como os combinados são montados a partir deles, a bagunça se
 * propagava — arrumar aqui conserta os quinze.
 *
 * ESCOPO: só as cópias em _modelos. Os originais da pasta "Modelo Propostas"
 * do comercial nunca são tocados — este script só conhece os docId da config.
 *
 * Linhas em branco: sequências curtas viram uma só. Sequências LONGAS ficam
 * como estão — no BBP e no GD há blocos de 20, que estão empurrando conteúdo
 * pra página seguinte à mão. Colapsar mudaria a paginação do documento, então
 * o script só avisa e deixa a decisão pra quem diagramou.
 *
 * Uso:
 *   node scripts/uniformiza-bases.js           # simulação
 *   node scripts/uniformiza-bases.js --apply
 *   node scripts/uniformiza-bases.js --idioma=en
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const APPLY = process.argv.includes('--apply');
const IDIOMA = idiomaDaLinhaDeComando();
const MODELOS = templatesDoIdioma(IDIOMA);
const BASES = ['BB', 'BBP', 'GD', 'VM'];
const CORPO_PT = 10;
// Acima disso, a sequência de linhas em branco é considerada paginação manual.
const LIMITE_PAGINACAO = 8;

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/documents'] });
}
const client = getClient();
async function api(url, opts = {}) {
    const { token } = await client.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}

const textoDe = (p) => (p.elements || []).map((e) => e.textRun?.content || '').join('');

console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));
console.log(APPLY ? '>>> APLICANDO nos modelos-base\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

for (const cod of BASES) {
    // Nem todo idioma tem os quatro bases (ver HANDOFF-IDIOMAS.md §3).
    if (!MODELOS[cod]) { console.log(`── ${cod}: sem modelo em ${IDIOMA} — pulando`); continue; }
    const docId = MODELOS[cod].docId;
    const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
    const tab = doc.tabs?.[0];
    const tabId = tab?.tabProperties?.tabId;
    const body = tab?.documentTab?.body || doc.body;
    const t = tabId ? { tabId } : {};

    // ── 1. Tamanho de fonte do corpo ────────────────────────────────
    const estilos = [];
    (function walk(content) {
        for (const el of content || []) {
            if (el.paragraph) {
                const heading = (el.paragraph.paragraphStyle?.namedStyleType || '').startsWith('HEADING');
                for (const e of el.paragraph.elements || []) {
                    const tr = e.textRun;
                    if (!tr?.content?.trim()) continue;
                    const tam = tr.textStyle?.fontSize?.magnitude;
                    if (heading) {
                        // Em título o tamanho vem do estilo nomeado; valor fixo
                        // no texto é resquício e faz o título sair de dois tamanhos.
                        if (tam != null) estilos.push({ startIndex: e.startIndex, endIndex: e.endIndex, remover: true });
                    } else if (tam != null && tam !== CORPO_PT) {
                        estilos.push({ startIndex: e.startIndex, endIndex: e.endIndex, remover: false });
                    }
                }
            }
            if (el.table) for (const l of el.table.tableRows || []) for (const c of l.tableCells || []) walk(c.content);
        }
    })(body.content);

    // ── 2. Linhas em branco no corpo (fora de tabela) ────────────────
    const sequencias = [];
    let atual = [];
    for (const el of body.content || []) {
        if (el.paragraph && !textoDe(el.paragraph).trim()) { atual.push(el); continue; }
        if (atual.length > 1) sequencias.push(atual);
        atual = [];
    }
    if (atual.length > 1) sequencias.push(atual);

    const colapsar = sequencias.filter((s) => s.length <= LIMITE_PAGINACAO);
    const paginacao = sequencias.filter((s) => s.length > LIMITE_PAGINACAO);
    // A quebra final do corpo não pode ser apagada (a API recusa), então o
    // último parágrafo do documento fica de fora.
    const fimCorpo = body.content[body.content.length - 1].endIndex;
    const removiveis = colapsar.flatMap((s) => s.slice(1)).filter((el) => el.endIndex < fimCorpo);

    console.log(`${cod.padEnd(4)} ${String(estilos.length).padStart(3)} trecho(s) de fonte  ·  ${String(removiveis.length).padStart(2)} linha(s) em branco a remover`
        + (paginacao.length ? `  ·  ⚠️ ${paginacao.length} bloco(s) de ${paginacao.map((s) => s.length).join('/')} linhas mantido(s) (paginação manual)` : ''));

    if (!APPLY) continue;

    // Estilo primeiro: não mexe em índice. Depois as remoções, de trás pra
    // frente, pra cada uma não invalidar a posição da anterior.
    const reqEstilo = estilos.map((e) => ({
        updateTextStyle: {
            range: { startIndex: e.startIndex, endIndex: e.endIndex, ...t },
            textStyle: e.remover ? {} : { fontSize: { magnitude: CORPO_PT, unit: 'PT' } },
            fields: 'fontSize',
        },
    }));
    const reqRemocao = removiveis
        .sort((a, b) => b.startIndex - a.startIndex)
        .map((el) => ({ deleteContentRange: { range: { startIndex: el.startIndex, endIndex: el.endIndex, ...t } } }));

    for (const requests of [reqEstilo, reqRemocao]) {
        if (!requests.length) continue;
        await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
        });
    }
    // ── 3. Paginação manual vira quebra de página de verdade ─────────
    // Blocos longos de linha em branco existem pra empurrar conteúdo pra página
    // seguinte. Isso quebra assim que o texto acima muda de tamanho — uma
    // quebra de página faz o mesmo e não depende de contagem de linhas.
    // Um bloco por vez, relendo o documento: cada operação move os índices.
    let trocadas = 0;
    for (;;) {
        const atual = await api(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
        const corpo = (atual.tabs?.[0]?.documentTab || atual).body;
        const seq = [];
        let acc = [];
        for (const el of corpo.content || []) {
            const branco = el.paragraph && !textoDe(el.paragraph).trim()
                && !(el.paragraph.elements || []).some((e) => e.pageBreak);
            if (branco) { acc.push(el); continue; }
            if (acc.length > LIMITE_PAGINACAO) seq.push(acc);
            acc = [];
        }
        if (acc.length > LIMITE_PAGINACAO) seq.push(acc);
        if (!seq.length) break;

        const bloco = seq[0];
        const fim = corpo.content[corpo.content.length - 1].endIndex;
        const apagar = bloco.slice(1).filter((el) => el.endIndex < fim);
        if (!apagar.length) break;
        await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ deleteContentRange: { range: { startIndex: apagar[0].startIndex, endIndex: apagar[apagar.length - 1].endIndex, ...t } } }] }),
        });
        await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ insertPageBreak: { location: { index: bloco[0].startIndex, ...t } } }] }),
        });
        trocadas++;
    }

    console.log(`${' '.repeat(5)}✅ aplicado${trocadas ? `  ·  ${trocadas} bloco(s) trocado(s) por quebra de página` : ''}`);
}

console.log(`\n${APPLY ? 'Rode agora scripts/monta-combos.js --apply para os 11 combos herdarem.' : 'Nada foi alterado.'}`);
