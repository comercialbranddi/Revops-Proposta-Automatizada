/**
 * Monta os modelos combinados a partir dos quatro modelos-base.
 *
 * Substitui o rebuild-combos.js, que foi escrito pro esqueleto dos modelos do
 * piloto (HEADING_1/2, marcador "•" digitado como texto). Os modelos antigos,
 * que voltaram a ser a base, usam outro esqueleto:
 *
 *   H2  Nossas Proteções
 *       H3  <Produto>
 *           H4  Especificações   + caixas
 *           H4  Entregáveis      + caixas
 *   H2  Proposta Comercial
 *       H3  N - Proteção <Produto>
 *       H3  Condições Comerciais
 *
 * Cada produto carrega Especificações e Entregáveis dentro do próprio bloco,
 * o que encaixa direto num combo: basta empilhar os blocos H3.
 *
 * Cada combo nasce como CÓPIA de um base (files.copy preserva cabeçalho com o
 * logo, estilos nomeados e configuração de página), e só o corpo é reescrito.
 * Recriar do zero perderia tudo isso.
 *
 * Uso:
 *   node scripts/monta-combos.js --dump=BB          # inspeciona a leitura de um base
 *   node scripts/monta-combos.js                    # simula os 11
 *   node scripts/monta-combos.js --only=GD+VM --apply
 *   node scripts/monta-combos.js --apply
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { PROPOSAL_TEMPLATES, PRODUCT_CASCADE_ORDER, PROPOSAL_OUTPUT_FOLDER_ID } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const DUMP = (process.argv.find((a) => a.startsWith('--dump=')) || '').split('=')[1] || null;
const BASES = ['BB', 'BBP', 'GD', 'VM'];

// ─── API ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WRITE_GAP_MS = 1100; // a Docs API limita escrita a ~60/min
let lastWrite = 0;

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'] });
}
const client = getClient();

async function api(url, opts = {}, isWrite = false) {
    for (let tentativa = 0; ; tentativa++) {
        if (isWrite) {
            const espera = lastWrite + WRITE_GAP_MS - Date.now();
            if (espera > 0) await sleep(espera);
            lastWrite = Date.now();
        }
        const { token } = await client.getAccessToken();
        const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
        if (res.status === 429 && tentativa < 5) { await sleep(15000 * (tentativa + 1)); continue; }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return res.status === 204 ? {} : res.json();
    }
}
const getDoc = (id) => api(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`);
const batch = (id, requests) => requests.length
    ? api(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) }, true)
    : Promise.resolve();

const tabOf = (d) => d.tabs?.[0];
const bodyOf = (d) => tabOf(d)?.documentTab?.body || d.body;
const tabIdOf = (d) => tabOf(d)?.tabProperties?.tabId;
const fimDe = (body) => body.content[body.content.length - 1].endIndex;

// ─── Parser ─────────────────────────────────────────────────────────
function paraParaBloco(p) {
    const runs = (p.elements || []).filter((e) => e.textRun)
        .map((e) => ({ text: e.textRun.content, textStyle: e.textRun.textStyle || {} }));
    for (let i = runs.length - 1; i >= 0; i--) {
        if (runs[i].text.endsWith('\n')) { runs[i].text = runs[i].text.slice(0, -1); break; }
    }
    const ps = p.paragraphStyle || {};
    return {
        kind: 'para',
        style: ps.namedStyleType || 'NORMAL_TEXT',
        alignment: ps.alignment,
        indentStart: ps.indentStart?.magnitude ?? 0,
        indentFirstLine: ps.indentFirstLine?.magnitude ?? 0,
        // nestingLevel do bullet é derivado da indentação na hora de recriar.
        bullet: p.bullet ? { nivel: p.bullet.nestingLevel ?? 0 } : null,
        runs: runs.filter((r) => r.text.length > 0),
    };
}

function parseBody(body) {
    const blocos = [];
    for (const el of body.content || []) {
        if (el.paragraph) blocos.push(paraParaBloco(el.paragraph));
        else if (el.table) {
            const paras = [];
            for (const linha of el.table.tableRows || []) {
                for (const celula of linha.tableCells || []) {
                    for (const c of celula.content || []) if (c.paragraph) paras.push(paraParaBloco(c.paragraph));
                }
            }
            blocos.push({ kind: 'caixa', paras, estilo: el.table.tableRows?.[0]?.tableCells?.[0]?.tableCellStyle || null });
        }
    }
    return blocos;
}

const textoDe = (b) => (b.kind === 'para' ? b.runs.map((r) => r.text).join('') : b.paras.map(textoDe).join('\n'));
const vazio = (b) => b.kind === 'para' && !textoDe(b).trim();
const ehH = (b, n) => b.kind === 'para' && b.style === `HEADING_${n}`;

/**
 * Fatia um base em: preâmbulo, bloco do produto (H3 dentro de Nossas
 * Proteções), bloco comercial (H3 "N - Proteção X"), condições (H3 Condições
 * Comerciais) e fecho (o que vier depois).
 */
function fatiar(blocos) {
    // As fronteiras são achadas pelo TEXTO, não pelo nível de heading: os
    // modelos são inconsistentes entre si (em BB e BBP o "Proposta Comercial"
    // é parágrafo normal; em GD e VM é HEADING_2).
    const acha = (re, desde = 0) => blocos.findIndex((b, i) => i >= desde && b.kind === 'para' && re.test(textoDe(b).trim()));
    const iProt = acha(/^Nossas Prote/i);
    const iComercial = acha(/^Proposta Comercial/i, iProt + 1);
    const iCond = acha(/^Condi..es Comerciais/i, iComercial + 1);
    if (iProt < 0 || iComercial < 0 || iCond < 0) {
        throw new Error(`esqueleto inesperado (Nossas Proteções=${iProt}, Proposta Comercial=${iComercial}, Condições=${iCond})`);
    }
    // Fecho: da última linha não-vazia depois das condições até o fim.
    let iFecho = blocos.length;
    for (let i = blocos.length - 1; i > iCond; i--) {
        if (!vazio(blocos[i]) && /Branddi\s*[–-]/.test(textoDe(blocos[i]))) { iFecho = i; break; }
    }
    return {
        preambulo: blocos.slice(0, iProt),
        cabecalhoProtecoes: blocos[iProt],
        produto: blocos.slice(iProt + 1, iComercial),
        cabecalhoComercial: blocos[iComercial],
        comercial: blocos.slice(iComercial + 1, iCond),
        condicoes: blocos.slice(iCond, iFecho),
        fecho: blocos.slice(iFecho),
    };
}

// ─── Inspeção ───────────────────────────────────────────────────────
if (DUMP) {
    const doc = await getDoc(PROPOSAL_TEMPLATES[DUMP].docId);
    const fatias = fatiar(parseBody(bodyOf(doc)));
    for (const [nome, valor] of Object.entries(fatias)) {
        const lista = Array.isArray(valor) ? valor : [valor];
        console.log(`\n━━ ${nome} (${lista.length} bloco(s))`);
        for (const b of lista) {
            if (b.kind === 'caixa') { console.log(`   [CAIXA ${b.paras.length} par.]  ${textoDe(b).replace(/\n/g, ' / ').slice(0, 60)}`); continue; }
            const t = textoDe(b); if (!t.trim()) continue;
            const marca = b.bullet ? `•n${b.bullet.nivel}` : '   ';
            console.log(`   ${b.style.replace('_TEXT', '').padEnd(9)} ${marca} ind=${String(b.indentStart).padStart(4)} ${t.slice(0, 56)}`);
        }
    }
    process.exit(0);
}

// ─── Compositor ─────────────────────────────────────────────────────
/** Tira o "1." do começo de um título de produto — a numeração é reescrita. */
const semNumero = (t) => t.trim().replace(/^\d+\s*[.)\-–]\s*/, '');

/** Copia um bloco trocando o texto do primeiro run (mantém o estilo). */
function comTexto(bloco, texto) {
    const runs = bloco.runs.length ? bloco.runs.map((r, i) => ({ ...r, text: i === 0 ? texto : '' })) : [{ text: texto, textStyle: {} }];
    return { ...bloco, runs: runs.filter((r) => r.text.length) };
}

function compor(codigos, fatiasPorCodigo, introPreservada) {
    const primeiro = fatiasPorCodigo[codigos[0]];
    const out = [];

    // Preâmbulo do primeiro base; a intro é a única prosa específica do combo.
    for (const b of primeiro.preambulo) {
        const t = textoDe(b).trim();
        out.push(introPreservada && t.startsWith('Apresentamos') ? comTexto(b, introPreservada) : b);
    }

    // Como os bases divergem no nível de heading, a hierarquia é normalizada
    // no combo — senão o produto 1 sairia como texto normal e o produto 2 como
    // título, dentro do mesmo documento.
    const comoTitulo = (b, texto, nivel) => ({
        ...comTexto(b, texto), style: `HEADING_${nivel}`, bullet: null, indentStart: 0, indentFirstLine: 0,
    });
    const primeiroCheio = (blocos) => blocos.findIndex((b) => !vazio(b));

    // ── Nossas Proteções: um bloco por produto, renumerado.
    out.push({ ...primeiro.cabecalhoProtecoes, style: 'HEADING_2' });
    codigos.forEach((cod, i) => {
        const blocos = fatiasPorCodigo[cod].produto;
        const iTitulo = primeiroCheio(blocos);
        blocos.forEach((b, j) => {
            if (j === iTitulo) out.push(comoTitulo(b, `${i + 1}. ${semNumero(textoDe(b))}`, 3));
            else out.push(b);
        });
    });

    // ── Proposta Comercial: um item por produto, renumerado.
    out.push({ ...primeiro.cabecalhoComercial, style: 'HEADING_2' });
    codigos.forEach((cod, i) => {
        const blocos = fatiasPorCodigo[cod].comercial;
        const iTitulo = primeiroCheio(blocos);
        blocos.forEach((b, j) => {
            if (j === iTitulo) out.push(comoTitulo(b, `${i + 1} - ${semNumero(textoDe(b))}`, 3));
            else out.push(b);
        });
    });

    // ── Combo: item próprio e numerado, como nos modelos antigos feitos à mão
    // ("3 - Combo: Brand Bidding + Violação PI", com Proposta / De / Por em
    // linhas separadas). Antes isso era uma linha solta no fim da seção, e
    // ficava escondido no meio dos itens de produto.
    if (codigos.length > 1) {
        const tituloModelo = primeiro.comercial[primeiroCheio(primeiro.comercial)];
        const linhaModelo = primeiro.comercial.find((b) => /^Proposta:/.test(textoDe(b).trim()));
        const nomes = codigos.map((cod) => {
            const blocos = fatiasPorCodigo[cod].produto;
            return semNumero(textoDe(blocos[primeiroCheio(blocos)]));
        });
        out.push(comoTitulo(tituloModelo, `${codigos.length + 1} - Combo: ${nomes.join(' + ')}`, 3));
        if (linhaModelo) {
            out.push(comTexto(linhaModelo, 'Proposta:'));
            out.push(comTexto(linhaModelo, '{{TOTAL_DE}}'));
            out.push(comTexto(linhaModelo, '{{TOTAL_POR}}'));
            // Canais do combo saem do card, não do modelo: cada produto tem seu
            // campo de canais e o generator monta a união em {{CANAIS_COMBO}}.
            out.push(comTexto(linhaModelo, 'Plataformas: {{CANAIS_COMBO}}'));
        }
    }

    // ── Condições Comerciais: as do primeiro, mais qualquer linha que só
    // exista em outro produto (o VM traz "Renovação automática.", por ex.).
    // A comparação ignora espaço duplicado e NBSP — sem isso a "Condição de
    // pagamento" do VM não casava com a do BB e saía duplicada no documento.
    const normaliza = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    // Compara por FRASE, não por parágrafo: no VM a "Condição de pagamento" e a
    // "Renovação automática." dividem o mesmo parágrafo, separadas por quebra
    // leve (shift+enter). Comparando o parágrafo inteiro, ele nunca casava com
    // a linha equivalente do BB e a condição saía repetida no documento.
    const frases = (b) => textoDe(b).split(/[\v\n]/).map((s) => s.trim()).filter(Boolean);
    const jaTem = new Set(primeiro.condicoes.flatMap(frases).map(normaliza));
    out.push(...primeiro.condicoes);
    for (const cod of codigos.slice(1)) {
        for (const b of fatiasPorCodigo[cod].condicoes) {
            if (ehH(b, 3)) continue;
            const novas = frases(b).filter((f) => !jaTem.has(normaliza(f)));
            if (!novas.length) continue;
            novas.forEach((f) => jaTem.add(normaliza(f)));
            out.push(comTexto(b, novas.join('\v')));
        }
    }
    return padronizar(out);
}

/**
 * Uniformiza o documento montado. Os quatro bases foram editados à mão em
 * épocas diferentes e misturam 10pt com 11pt no corpo, além de acumularem
 * linhas em branco em sequência — juntar dois deles deixava a diferença
 * evidente.
 */
const CORPO_PT = 10;
function padronizar(blocos) {
    const out = [];
    for (const b of blocos) {
        if (b.kind === 'caixa') { out.push({ ...b, paras: padronizar(b.paras) }); continue; }

        // No máximo uma linha em branco seguida.
        if (vazio(b)) { if (out.length && vazio(out[out.length - 1])) continue; out.push(b); continue; }

        const heading = b.style.startsWith('HEADING');
        const runs = b.runs.map((r) => {
            const ts = { ...r.textStyle };
            // Em título, o tamanho vem do estilo nomeado; tamanho explícito no
            // run é resquício de edição manual e gera título de dois tamanhos.
            if (heading) delete ts.fontSize;
            else ts.fontSize = { magnitude: CORPO_PT, unit: 'PT' };
            return { ...r, textStyle: ts };
        });
        out.push({ ...b, runs });
    }
    return out;
}

// ─── Escritor ───────────────────────────────────────────────────────
function pedidosPara(bloco, em, tabId, comQuebra = true) {
    const texto = bloco.runs.map((r) => r.text).join('') + (comQuebra ? '\n' : '');
    if (!texto) return { requests: [], delta: 0, bulletRange: null };
    const t = tabId ? { tabId } : {};

    // createParagraphBullets não aceita nível de aninhamento: ele DEDUZ pela
    // indentação do parágrafo. Passar a indentação crua do original achatava
    // tudo em dois níveis, então ela é recalculada a partir do nível — 36pt por
    // degrau, que é o padrão do Docs.
    const indent = bloco.bullet
        ? { start: 36 + 36 * bloco.bullet.nivel, first: 18 + 36 * bloco.bullet.nivel }
        : { start: bloco.indentStart || 0, first: bloco.indentFirstLine || 0 };

    const requests = [{ insertText: { location: { index: em, ...t }, text: texto } }];
    requests.push({
        updateParagraphStyle: {
            range: { startIndex: em, endIndex: em + texto.length, ...t },
            paragraphStyle: {
                namedStyleType: bloco.style,
                ...(bloco.alignment ? { alignment: bloco.alignment } : {}),
                indentStart: { magnitude: indent.start, unit: 'PT' },
                indentFirstLine: { magnitude: indent.first, unit: 'PT' },
            },
            fields: 'namedStyleType,indentStart,indentFirstLine' + (bloco.alignment ? ',alignment' : ''),
        },
    });
    let off = em;
    for (const r of bloco.runs) {
        if (r.text.length) {
            requests.push({ updateTextStyle: { range: { startIndex: off, endIndex: off + r.text.length, ...t }, textStyle: r.textStyle, fields: 'bold,italic,fontSize,foregroundColor' } });
        }
        off += r.text.length;
    }
    return { requests, delta: texto.length, bulletRange: bloco.bullet ? { startIndex: em, endIndex: em + texto.length } : null };
}

async function escrever(docId, blocos, presetBullet) {
    let doc = await getDoc(docId);
    const tabId = tabIdOf(doc);
    let body = bodyOf(doc);
    const t = tabId ? { tabId } : {};

    const fim = fimDe(body);
    if (fim > 2) { await batch(docId, [{ deleteContentRange: { range: { startIndex: 1, endIndex: fim - 1, ...t } } }]); doc = await getDoc(docId); body = bodyOf(doc); }

    let cursor = fimDe(body);
    let pendentes = [];
    const bullets = [];
    const flush = async () => { await batch(docId, pendentes); pendentes = []; };

    for (const bloco of blocos) {
        if (bloco.kind === 'para') {
            const { requests, delta, bulletRange } = pedidosPara(bloco, cursor - 1, tabId);
            pendentes.push(...requests);
            if (bulletRange) bullets.push(bulletRange);
            cursor += delta;
            continue;
        }
        pendentes.push({ insertTable: { location: { index: cursor - 1, ...t }, rows: 1, columns: 1 } });
        await flush();
        doc = await getDoc(docId); body = bodyOf(doc);
        const tabelas = (body.content || []).filter((el) => el.table);
        const el = tabelas[tabelas.length - 1];
        let ci = el.table.tableRows[0].tableCells[0].content[0].startIndex;
        const reqs = [];
        bloco.paras.forEach((p, i) => {
            const { requests, delta, bulletRange } = pedidosPara(p, ci, tabId, i < bloco.paras.length - 1);
            reqs.push(...requests);
            if (bulletRange) bullets.push(bulletRange);
            ci += delta;
        });
        if (bloco.estilo) {
            reqs.push({ updateTableCellStyle: {
                tableRange: { tableCellLocation: { tableStartLocation: { index: el.startIndex, ...t }, rowIndex: 0, columnIndex: 0 }, rowSpan: 1, columnSpan: 1 },
                tableCellStyle: bloco.estilo,
                fields: 'borderTop,borderBottom,borderLeft,borderRight,paddingLeft,paddingRight,paddingTop,paddingBottom',
            } });
        }
        await batch(docId, reqs);
        doc = await getDoc(docId); body = bodyOf(doc); cursor = fimDe(body);
    }
    await flush();

    // Marcadores por último: como só acrescentamos no fim, os índices
    // registrados durante a escrita continuam válidos. O nível de aninhamento
    // sai da indentação que já foi aplicada em cada parágrafo.
    const juntos = [];
    for (const r of bullets) {
        const ult = juntos[juntos.length - 1];
        if (ult && r.startIndex === ult.endIndex) ult.endIndex = r.endIndex;
        else juntos.push({ ...r });
    }
    for (const faixa of juntos) {
        await batch(docId, [{ createParagraphBullets: { range: { ...faixa, ...t }, bulletPreset: presetBullet } }]);
    }
    return juntos.length;
}

// ─── Main ───────────────────────────────────────────────────────────
console.log(APPLY ? '>>> APLICANDO\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

const fatias = {};
for (const cod of BASES) {
    const doc = await getDoc(PROPOSAL_TEMPLATES[cod].docId);
    fatias[cod] = fatiar(parseBody(bodyOf(doc)));
}
console.log(`bases lidos: ${BASES.join(', ')}\n`);

const combos = Object.keys(PROPOSAL_TEMPLATES).filter((k) => k.includes('+'));
const alvos = ONLY ? combos.filter((k) => k === ONLY) : combos;

// Pasta _modelos, onde vivem os bases importados.
async function pastaModelos() {
    const q = `'${PROPOSAL_OUTPUT_FOLDER_ID}' in parents and name='_modelos' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    return r.files?.[0]?.id;
}

/**
 * O combo nasce como cópia do base do primeiro produto. É isso que traz o
 * cabeçalho com o logo, o rodapé ("Branddi – Combata o uso indevido…"), os
 * estilos nomeados e a configuração de página — nada disso é reconstruível
 * pela API de documentos.
 */
async function criarCombo(chave, codigos, pasta) {
    const base = PROPOSAL_TEMPLATES[codigos[0]].docId;
    const cp = await api(`https://www.googleapis.com/drive/v3/files/${base}/copy?supportsAllDrives=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `MODELO ${chave}`, parents: [pasta] }),
    }, true);
    return cp.id;
}

const pasta = APPLY ? await pastaModelos() : null;
const novosIds = {};

for (const chave of alvos) {
    const codigos = PRODUCT_CASCADE_ORDER.filter((c) => chave.split('+').includes(c));
    try {
        // Intro do combo atual é a única prosa escrita à mão que vale preservar.
        const atual = parseBody(bodyOf(await getDoc(PROPOSAL_TEMPLATES[chave].docId)));
        const intro = atual.map(textoDe).map((s) => s.trim()).find((s) => s.startsWith('Apresentamos'));
        const blocos = compor(codigos, fatias, intro);
        const caixas = blocos.filter((b) => b.kind === 'caixa').length;
        const chars = blocos.reduce((n, b) => n + textoDe(b).length, 0);
        console.log(`${chave.padEnd(14)} ${String(blocos.length).padStart(3)} blocos, ${String(caixas).padStart(2)} caixas, ${String(chars).padStart(5)} chars | intro: ${intro ? 'preservada' : 'do base'}`);
        if (APPLY) {
            const docId = await criarCombo(chave, codigos, pasta);
            const listas = await escrever(docId, blocos, 'BULLET_DISC_CIRCLE_SQUARE');
            novosIds[chave] = docId;
            console.log(`${' '.repeat(14)} ✅ ${docId}  (${listas} lista(s))`);
        }
    } catch (err) {
        console.log(`${chave.padEnd(14)} ❌ ${err.message}`);
    }
}
console.log(`\n${alvos.length} combo(s) ${APPLY ? 'montado(s)' : 'simulado(s)'}`);

if (APPLY && Object.keys(novosIds).length) {
    console.log('\n── cole em PROPOSAL_TEMPLATES ──');
    for (const [k, id] of Object.entries(novosIds)) {
        console.log(`    '${k}': { docId: '${id}', label: '${PROPOSAL_TEMPLATES[k].label}' },`);
    }
}
