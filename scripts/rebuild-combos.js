/**
 * Reconstrói os 11 modelos combinados a partir dos 4 modelos-base.
 *
 * Por que existe: os combos foram criados à mão e divergiram dos bases —
 * os 8 cadastrados em 9b62d07 saíram sem caixa, sem negrito e com as listas
 * em bullets achatadas em texto corrido. Como a automação só faz
 * copyTemplate + replaceAllText, o modelo é literalmente o que o cliente
 * recebe. Este script lê os bases AO VIVO e recompõe cada combo a partir
 * deles, então uma correção num base propaga pros 11 rodando de novo.
 *
 * O que é preservado do combo atual (não vem do base):
 *   - o parágrafo de introdução (o que vem depois de "Prezados,");
 *   - a frase de abertura de cada produto, quando difere do base — é a
 *     prosa de transição escrita à mão ("Complementando a proteção nos
 *     buscadores, ...").
 *
 * Uso:
 *   node scripts/rebuild-combos.js                      # simulação
 *   node scripts/rebuild-combos.js --only=GD+VM         # simula um só
 *   node scripts/rebuild-combos.js --only=GD+VM --apply # escreve um só
 *   node scripts/rebuild-combos.js --apply              # escreve os 11
 *
 * Reverter: Google Docs guarda histórico de versões por documento.
 * Backup completo: node scripts/export-templates.js --format=docx
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { PROPOSAL_TEMPLATES, PRODUCT_CASCADE_ORDER } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;

const BASES = ['BB', 'BBP', 'GD', 'VM'];
const SECTIONS = ['Nossas Proteções', 'Especificações', 'Entregáveis', 'Proposta Comercial', 'Condições Comerciais'];

// Estilo das caixas — idêntico nas 18 tabelas dos 4 bases.
const BOX_BORDER = {
    color: { color: { rgbColor: { red: 0.6, green: 0.6, blue: 0.6 } } },
    width: { magnitude: 0.8333325, unit: 'PT' },
    dashStyle: 'SOLID',
};
const BOX_STYLE = {
    borderTop: BOX_BORDER, borderBottom: BOX_BORDER, borderLeft: BOX_BORDER, borderRight: BOX_BORDER,
    paddingLeft: { magnitude: 8, unit: 'PT' },
};

// Campos de estilo sempre reescritos, pra o texto inserido não herdar o
// formato do parágrafo anterior (sem isso o negrito do heading vaza pro
// parágrafo seguinte).
const TEXT_FIELDS = 'bold,italic,fontSize,foregroundColor';

// ─── API ────────────────────────────────────────────────────────────
function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/documents'] });
}
const client = getClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A Docs API limita escrita a ~60 req/min por usuário e um rebuild completo
// passa disso fácil. Espaça as escritas e faz backoff no 429 — sem isso o
// documento fica gravado pela metade (limpo, mas incompleto).
const WRITE_GAP_MS = 1100;
let lastWrite = 0;

async function api(url, opts = {}, isWrite = false) {
    for (let attempt = 0; ; attempt++) {
        if (isWrite) {
            const wait = lastWrite + WRITE_GAP_MS - Date.now();
            if (wait > 0) await sleep(wait);
            lastWrite = Date.now();
        }
        const { token } = await client.getAccessToken();
        const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
        if (res.status === 429 && attempt < 5) {
            const backoff = 15000 * (attempt + 1);
            console.log(`${' '.repeat(14)} ⏳ quota atingida, aguardando ${backoff / 1000}s`);
            await sleep(backoff);
            continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return res.json();
    }
}
const getDoc = (docId) => api(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
const batchUpdate = (docId, requests) => requests.length
    ? api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
    }, true)
    : Promise.resolve();

const tabOf = (doc) => doc.tabs?.[0];
const bodyOf = (doc) => tabOf(doc)?.documentTab?.body || doc.body;
const tabIdOf = (doc) => tabOf(doc)?.tabProperties?.tabId;
const endOf = (body) => body.content[body.content.length - 1].endIndex;

// ─── Parser: documento → blocos ─────────────────────────────────────
/** Um parágrafo vira {kind:'para', style, runs:[{text, textStyle}]} sem o \n final. */
function paraToBlock(p) {
    const runs = (p.elements || [])
        .filter((e) => e.textRun)
        .map((e) => ({ text: e.textRun.content, textStyle: e.textRun.textStyle || {} }));
    // O \n do fim do parágrafo é remontado na escrita.
    for (let i = runs.length - 1; i >= 0; i--) {
        if (runs[i].text.endsWith('\n')) { runs[i].text = runs[i].text.slice(0, -1); break; }
    }
    return {
        kind: 'para',
        namedStyleType: p.paragraphStyle?.namedStyleType || 'NORMAL_TEXT',
        runs: runs.filter((r) => r.text.length > 0),
    };
}

function parseBody(body) {
    const blocks = [];
    for (const el of body.content || []) {
        if (el.paragraph) blocks.push(paraToBlock(el.paragraph));
        else if (el.table) {
            const paras = [];
            for (const row of el.table.tableRows || []) {
                for (const cell of row.tableCells || []) {
                    for (const ce of cell.content || []) if (ce.paragraph) paras.push(paraToBlock(ce.paragraph));
                }
            }
            blocks.push({ kind: 'box', paras });
        }
    }
    return blocks;
}

const textOf = (b) => (b.kind === 'para' ? b.runs.map((r) => r.text).join('') : b.paras.map(textOf).join('\n'));
const isBlank = (b) => b.kind === 'para' && !textOf(b).trim();

/**
 * Fatia o base em preâmbulo + as 5 seções, usando os HEADING_1 como divisor.
 * Guarda o próprio bloco do heading (`headings`) — é ele que é reaproveitado na
 * composição, pra não perder negrito/cor ao recriar o título.
 */
function splitSections(blocks) {
    const preamble = [];
    const sections = new Map();
    const headings = new Map();
    let current = null;
    for (const b of blocks) {
        if (b.kind === 'para' && b.namedStyleType === 'HEADING_1') {
            current = textOf(b).trim();
            sections.set(current, []);
            headings.set(current, b);
        } else if (current === null) preamble.push(b);
        else sections.get(current).push(b);
    }
    return { preamble, sections, headings };
}

// ─── Blocos sintéticos ──────────────────────────────────────────────
const para = (text, namedStyleType = 'NORMAL_TEXT', textStyle = {}) =>
    ({ kind: 'para', namedStyleType, runs: text ? [{ text, textStyle }] : [] });
const blank = () => para('');
const h2 = (text, model) => {
    const style = model?.runs?.[0]?.textStyle || { bold: true };
    return { kind: 'para', namedStyleType: 'HEADING_2', runs: [{ text, textStyle: style }] };
};

/** Acha no preâmbulo o parágrafo que começa com o prefixo dado. */
const findPre = (preamble, prefix) => preamble.find((b) => textOf(b).trim().startsWith(prefix));

/** Normaliza "1) Brand Bidding" → "brand bidding", pra casar títulos entre docs. */
const normTitle = (s) => s.trim().replace(/^\d+\s*[)\-–]\s*/, '').replace(/^Proteção\s+/i, '').toLowerCase();

// ─── Extração do que é do combo (intro + transições) ────────────────
function extractPreserved(comboBlocks, baseTitles) {
    const paras = comboBlocks.filter((b) => b.kind === 'para');
    const idxAfter = (pred) => {
        const i = paras.findIndex(pred);
        if (i < 0) return null;
        for (let j = i + 1; j < paras.length; j++) if (textOf(paras[j]).trim()) return paras[j];
        return null;
    };
    const intro = idxAfter((b) => textOf(b).trim().startsWith('Prezados'));
    const transitions = {};
    for (const [code, title] of Object.entries(baseTitles)) {
        const t = idxAfter((b) => normTitle(textOf(b)) === normTitle(title));
        if (t) transitions[code] = t;
    }
    return { intro, transitions };
}

// ─── Compositor ─────────────────────────────────────────────────────
function compose(codes, bases, preserved) {
    const first = bases[codes[0]];
    const multi = codes.length > 1;
    const out = [];

    // Preâmbulo. O wordmark só existe no BB — é a referência pros 15.
    const wordmark = findPre(bases.BB.preamble, '◈');
    if (wordmark) { out.push(wordmark); out.push(blank()); }
    out.push(findPre(first.preamble, 'São Paulo,'));
    out.push(findPre(first.preamble, 'Para:'));
    out.push(blank());
    out.push(findPre(first.preamble, 'Prezados'));
    out.push(preserved.intro || first.preamble[first.preamble.length - 1]);

    const sectionOf = (code, name) => bases[code].sections.get(name) || [];
    // Os 4 bases têm os mesmos 5 HEADING_1 — reusa o bloco do primeiro produto,
    // com o estilo original, em vez de recriar o título.
    const heading = (name) => bases[codes[0]].headings.get(name);

    // ── Nossas Proteções: um bloco por produto, renumerado.
    out.push(heading('Nossas Proteções'));
    codes.forEach((code, i) => {
        const [head, ...rest] = sectionOf(code, 'Nossas Proteções');
        const title = textOf(head).trim().replace(/^\d+\s*\)\s*/, '');
        out.push(h2(`${i + 1}) ${title}`, head));
        const body = [...rest];
        // A primeira prosa do produto pode ter sido reescrita como transição.
        const t = preserved.transitions[code];
        if (t && body.length) {
            const k = body.findIndex((b) => !isBlank(b));
            if (k >= 0 && normTitle(textOf(body[k])) !== normTitle(textOf(t))) body[k] = t;
        }
        out.push(...body);
    });

    // ── Especificações e Entregáveis: subtítulo do produto só quando há mais de um.
    for (const name of ['Especificações', 'Entregáveis']) {
        out.push(heading(name));
        codes.forEach((code) => {
            if (multi) {
                const [head] = sectionOf(code, 'Nossas Proteções');
                out.push(h2(textOf(head).trim().replace(/^\d+\s*\)\s*/, ''), head));
            }
            out.push(...sectionOf(code, name));
        });
    }

    // ── Proposta Comercial: renumera "N - Proteção <produto>".
    out.push(heading('Proposta Comercial'));
    codes.forEach((code, i) => {
        const [head, ...rest] = sectionOf(code, 'Proposta Comercial');
        const title = textOf(head).trim().replace(/^\d+\s*[-–]\s*/, '');
        out.push(h2(`${i + 1} - ${title}`, head));
        out.push(...rest);
    });

    // ── Condições Comerciais: linhas comuns uma vez, "Prazo" por produto.
    out.push(heading('Condições Comerciais'));
    const isPrazo = (b) => textOf(b).trim().startsWith('Prazo');
    // A nota [PENDENTE] do VM vem logo depois do Prazo — viaja junto com ele.
    const prazoBlock = (code) => {
        const sec = sectionOf(code, 'Condições Comerciais');
        const i = sec.findIndex(isPrazo);
        if (i < 0) return [];
        const out2 = [sec[i]];
        for (let j = i + 1; j < sec.length; j++) {
            if (!textOf(sec[j]).trim().startsWith('[')) break;
            out2.push(sec[j]);
        }
        return out2;
    };
    const shared = sectionOf(codes[0], 'Condições Comerciais')
        .filter((b) => !isPrazo(b) && !textOf(b).trim().startsWith('['));
    // "Setup", "Limite" etc. vêm antes; "Condição de pagamento" em diante, depois.
    const cut = shared.findIndex((b) => textOf(b).trim().startsWith('Condição de pagamento'));
    out.push(...(cut < 0 ? shared : shared.slice(0, cut)));
    codes.forEach((code) => {
        for (const b of prazoBlock(code)) {
            if (!multi || !isPrazo(b)) { out.push(b); continue; }
            // Qualifica com o produto: "Prazo para início do monitoramento (Brand Bidding): ..."
            const [head] = sectionOf(code, 'Nossas Proteções');
            const label = textOf(head).trim().replace(/^\d+\s*\)\s*/, '');
            const runs = b.runs.map((r) => ({ ...r }));
            const k = runs.findIndex((r) => r.text.includes(':'));
            if (k >= 0) runs[k] = { ...runs[k], text: runs[k].text.replace(':', ` (${label}):`) };
            out.push({ ...b, runs });
        }
    });
    if (cut >= 0) out.push(...shared.slice(cut));

    return out.filter(Boolean);
}

// ─── Writer ─────────────────────────────────────────────────────────
/** Requests pra inserir um parágrafo em `at`. Devolve quanto o índice avança. */
function paraRequests(block, at, tabId, withNewline = true) {
    const text = block.runs.map((r) => r.text).join('') + (withNewline ? '\n' : '');
    if (!text) return { requests: [], delta: 0 };
    const tab = tabId ? { tabId } : {};
    const requests = [{ insertText: { location: { index: at, ...tab }, text } }];
    requests.push({
        updateParagraphStyle: {
            range: { startIndex: at, endIndex: at + text.length, ...tab },
            paragraphStyle: { namedStyleType: block.namedStyleType },
            fields: 'namedStyleType',
        },
    });
    let off = at;
    for (const r of block.runs) {
        if (r.text.length) {
            requests.push({
                updateTextStyle: {
                    range: { startIndex: off, endIndex: off + r.text.length, ...tab },
                    textStyle: r.textStyle,
                    fields: TEXT_FIELDS,
                },
            });
        }
        off += r.text.length;
    }
    return { requests, delta: text.length };
}

async function writeDoc(docId, blocks) {
    let doc = await getDoc(docId);
    const tabId = tabIdOf(doc);
    let body = bodyOf(doc);

    // Limpa o corpo (deixa o parágrafo final, que não pode ser removido).
    const end = endOf(body);
    if (end > 2) {
        await batchUpdate(docId, [{ deleteContentRange: { range: { startIndex: 1, endIndex: end - 1, ...(tabId ? { tabId } : {}) } } }]);
        doc = await getDoc(docId);
        body = bodyOf(doc);
    }

    let cursor = endOf(body);
    let pending = [];
    const flush = async () => { await batchUpdate(docId, pending); pending = []; };

    for (const block of blocks) {
        if (block.kind === 'para') {
            const { requests, delta } = paraRequests(block, cursor - 1, tabId);
            pending.push(...requests);
            cursor += delta;
            continue;
        }
        // Caixa: a tabela entra no mesmo batch dos parágrafos pendentes (uma
        // escrita a menos por caixa), depois relê pra achar o índice da célula.
        pending.push({ insertTable: { location: { index: cursor - 1, ...(tabId ? { tabId } : {}) }, rows: 1, columns: 1 } });
        await flush();
        doc = await getDoc(docId);
        body = bodyOf(doc);

        const tables = (body.content || []).filter((el) => el.table);
        const el = tables[tables.length - 1];
        const cellStart = el.table.tableRows[0].tableCells[0].content[0].startIndex;

        const reqs = [];
        let ci = cellStart;
        block.paras.forEach((p, i) => {
            // A célula já tem uma marca de parágrafo — o último não leva \n.
            const { requests, delta } = paraRequests(p, ci, tabId, i < block.paras.length - 1);
            reqs.push(...requests);
            ci += delta;
        });
        reqs.push({
            updateTableCellStyle: {
                tableRange: {
                    tableCellLocation: { tableStartLocation: { index: el.startIndex, ...(tabId ? { tabId } : {}) }, rowIndex: 0, columnIndex: 0 },
                    rowSpan: 1, columnSpan: 1,
                },
                tableCellStyle: BOX_STYLE,
                fields: 'borderTop,borderBottom,borderLeft,borderRight,paddingLeft',
            },
        });
        await batchUpdate(docId, reqs);

        doc = await getDoc(docId);
        body = bodyOf(doc);
        cursor = endOf(body);
    }
    await flush();
}

// ─── Main ───────────────────────────────────────────────────────────
console.log(APPLY ? '>>> APLICANDO nos modelos de produção\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

// Carrega os 4 bases.
const bases = {};
for (const code of BASES) {
    const doc = await getDoc(PROPOSAL_TEMPLATES[code].docId);
    const { preamble, sections, headings } = splitSections(parseBody(bodyOf(doc)));
    const missing = SECTIONS.filter((s) => !sections.has(s));
    if (missing.length) { console.error(`Base ${code} sem as seções: ${missing.join(', ')}`); process.exit(1); }
    bases[code] = { preamble, sections, headings };
}
console.log(`Bases carregados: ${BASES.join(', ')}\n`);

const baseTitles = Object.fromEntries(BASES.map((c) => {
    const [head] = bases[c].sections.get('Nossas Proteções');
    return [c, textOf(head).trim().replace(/^\d+\s*\)\s*/, '')];
}));

const combos = Object.keys(PROPOSAL_TEMPLATES).filter((k) => k.includes('+'));
const targets = ONLY ? combos.filter((k) => k === ONLY) : combos;
if (!targets.length) { console.error(`Nenhum combo casa com --only=${ONLY}`); process.exit(1); }

for (const key of targets) {
    const codes = PRODUCT_CASCADE_ORDER.filter((c) => key.split('+').includes(c));
    const docId = PROPOSAL_TEMPLATES[key].docId;
    try {
        const current = parseBody(bodyOf(await getDoc(docId)));
        const preserved = extractPreserved(current, baseTitles);
        const blocks = compose(codes, bases, preserved);

        const boxes = blocks.filter((b) => b.kind === 'box').length;
        const chars = blocks.reduce((n, b) => n + textOf(b).length, 0);
        const kept = [preserved.intro ? 'intro' : null, ...Object.keys(preserved.transitions).map((c) => `transição:${c}`)].filter(Boolean);
        console.log(`${key.padEnd(14)} ${String(blocks.length).padStart(3)} blocos, ${String(boxes).padStart(2)} caixas, ${String(chars).padStart(5)} chars  | preservado: ${kept.join(', ') || '(nada)'}`);

        if (APPLY) {
            await writeDoc(docId, blocks);
            console.log(`${' '.repeat(14)} ✅ escrito`);
        }
    } catch (err) {
        console.log(`${key.padEnd(14)} ❌ ${err.message}`);
    }
}

console.log(`\n${targets.length} combo(s) ${APPLY ? 'reconstruído(s)' : 'simulado(s)'}`);
