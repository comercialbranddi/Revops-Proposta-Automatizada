/**
 * Cria os modelos-base de outro idioma a partir dos modelos em PORTUGUÊS.
 *
 * Por que traduzir do português em vez de importar os documentos que o
 * comercial já tem em inglês/espanhol: os antigos carregam condições comerciais
 * que o time não pratica mais (contrato anual com fidelidade, quando hoje se
 * vende sem fidelidade) e cobrem só parte das combinações. O português é a
 * fonte correta e completa — ver AUDITORIA-IDIOMAS.md. Os documentos antigos
 * viram GLOSSÁRIO: é deles que sai o vocabulário da Branddi em cada idioma
 * ("Intellectual Property Infringement", "Protección Fraude"), não o conteúdo.
 *
 * O modelo novo nasce como CÓPIA do português e só o texto é trocado, um
 * parágrafo por vez. É a mesma escolha do monta-combos.js, pela mesma razão:
 * cabeçalho com o wordmark, rodapé, estilos nomeados, caixas e configuração de
 * página não são reconstruíveis pela API — copiar preserva tudo.
 *
 * Os placeholders ({{MARCA}}, {{PRECO_BB}}, …) atravessam a tradução intactos,
 * porque a tradução é parágrafo a parágrafo e eles fazem parte do texto.
 *
 * ─── Fluxo em duas fases ───────────────────────────────────────────
 *
 * 1. --dump  grava traducoes/<idioma>/<produto>.json com um par por parágrafo:
 *            { original: "<texto exato do doc>", traducao: "" }
 *            O "original" vem da Docs API, NÃO do export em texto puro: o
 *            export normaliza espaço não-quebrável (U+00A0) e o replaceAllText
 *            é literal, então casar pelo export dá falso positivo.
 *
 * 2. preenche as traduções no JSON (a mão, é o trabalho de tradução mesmo)
 *
 * 3. sem flag   simula: mostra quantas ocorrências cada troca encontraria e
 *               ACUSA as que encontrariam zero — que é como se descobre
 *               parágrafo que mudou no português desde o dump.
 *    --apply    cria a cópia em _modelos e aplica.
 *
 * Uso:
 *   node scripts/traduz-bases.js --idioma=en --produto=BB --dump
 *   node scripts/traduz-bases.js --idioma=en --produto=BB
 *   node scripts/traduz-bases.js --idioma=en --produto=BB --apply
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma, IDIOMA_PADRAO, PROPOSAL_OUTPUT_FOLDER_ID } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando } from './_idioma.js';

const APPLY = process.argv.includes('--apply');
const DUMP = process.argv.includes('--dump');
const IDIOMA = idiomaDaLinhaDeComando();
const PRODUTO = (process.argv.find((a) => a.startsWith('--produto=')) || '').split('=')[1] || null;

if (IDIOMA === IDIOMA_PADRAO) {
    console.error('--idioma=pt não faz sentido aqui: o português é a FONTE da tradução, não o destino.');
    process.exit(1);
}
if (!PRODUTO) {
    console.error('Faltou --produto=BB (ou BBP, GD, VM).');
    process.exit(1);
}

const FONTE = templatesDoIdioma(IDIOMA_PADRAO)[PRODUTO];
if (!FONTE) {
    console.error(`Não há modelo "${PRODUTO}" em português pra servir de fonte.`);
    process.exit(1);
}

const DIR = new URL(`../traducoes/${IDIOMA}/`, import.meta.url);
const ARQ = new URL(`${PRODUTO}.json`, DIR);

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'] });
}
const client = getClient();
async function api(url, opts = {}) {
    const { token } = await client.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? {} : res.json();
}

/** Texto de cada parágrafo, incluindo os de dentro de tabela (as "caixas"). */
function paragrafos(content, out = []) {
    for (const el of content || []) {
        if (el.paragraph) {
            const t = (el.paragraph.elements || []).map((e) => e.textRun?.content || '').join('');
            out.push(t);
        }
        if (el.table) {
            for (const row of el.table.tableRows || []) {
                for (const cell of row.tableCells || []) paragrafos(cell.content, out);
            }
        }
    }
    return out;
}

const doc = await api(`https://docs.googleapis.com/v1/documents/${FONTE.docId}?includeTabsContent=true`);
const tab = doc.tabs?.[0]?.documentTab;
const body = tab?.body || doc.body;

// Cabeçalho e rodapé entram junto: o rodapé é a assinatura da Branddi
// ("Branddi – Combata o uso indevido da sua marca…") e não está no corpo, então
// varrer só body.content deixava ele em português no documento traduzido.
// O replaceAllText da Docs API já alcança header/footer sozinho — o que faltava
// era saber que aquele texto existe.
const extras = [
    ...Object.values(tab?.headers || doc.headers || {}),
    ...Object.values(tab?.footers || doc.footers || {}),
].flatMap((h) => paragrafos(h.content));

// Sem o \n final e sem repetição: replaceAllText já troca todas as ocorrências,
// e uma linha repetida geraria duas requisições idênticas.
const originais = [...new Set(
    [...paragrafos(body.content), ...extras].map((t) => t.replace(/\n+$/, '')).filter((t) => t.trim().length > 1),
)];

// ─── Fase 1: dump ───────────────────────────────────────────────────
// O corpo abaixo é if/else em vez de terminar o dump com process.exit(): no
// Node 24 do Windows, sair com handles do cliente HTTP ainda abertos dispara
// uma assertion do libuv e devolve código de saída inútil.
if (DUMP) {
    await mkdir(DIR, { recursive: true });
    let existente = {};
    try {
        // Preserva o que já foi traduzido: rodar --dump de novo depois de o
        // português mudar não pode jogar fora o trabalho feito.
        const antes = JSON.parse(await readFile(ARQ, 'utf-8'));
        for (const p of antes.pares || []) existente[p.original] = p.traducao;
    } catch { /* primeiro dump */ }

    const pares = originais.map((original) => ({ original, traducao: existente[original] || '' }));
    await writeFile(ARQ, JSON.stringify({
        idioma: IDIOMA, produto: PRODUTO, fonte: FONTE.docId,
        _instrucao: 'Preencha "traducao". Deixar vazio = manter o texto em português no documento final. Placeholders {{...}} devem sobreviver.',
        pares,
    }, null, 2), 'utf-8');

    const feitos = pares.filter((p) => p.traducao).length;
    console.log(`${PRODUTO} → ${pares.length} parágrafos (${feitos} já traduzidos, ${pares.length - feitos} em branco)`);
    console.log(`arquivo: traducoes/${IDIOMA}/${PRODUTO}.json`);
} else {

// ─── Fases 2 e 3: simulação e aplicação ─────────────────────────────
let dados;
try {
    dados = JSON.parse(await readFile(ARQ, 'utf-8'));
} catch {
    console.error(`Não achei traducoes/${IDIOMA}/${PRODUTO}.json — rode com --dump primeiro.`);
    dados = null;
}
if (!dados) {
    process.exitCode = 1;
} else {

const preenchidos = (dados.pares || []).filter((p) => p.traducao && p.traducao.trim());
const vazios = (dados.pares || []).length - preenchidos.length;

// Um parágrafo que sumiu do português desde o dump não seria trocado e sairia
// no documento final em português, calado. Melhor acusar.
const textoAtual = new Set(originais);
const orfaos = preenchidos.filter((p) => !textoAtual.has(p.original));

console.log(`${PRODUTO} em ${IDIOMA}: ${preenchidos.length} traduções, ${vazios} em branco`);
if (orfaos.length) {
    console.log(`\n⚠️  ${orfaos.length} tradução(ões) não casam com o português atual — o modelo mudou desde o dump:`);
    for (const o of orfaos.slice(0, 5)) console.log(`   ${JSON.stringify(o.original.slice(0, 70))}`);
    console.log('   rode --dump de novo (ele preserva o que já foi traduzido)');
}
if (vazios) {
    console.log(`\n⚠️  ${vazios} parágrafo(s) sem tradução sairiam em PORTUGUÊS no documento final.`);
}

const pendencias = orfaos.length || vazios;

if (!APPLY) {
    console.log('\n>>> SIMULAÇÃO — use --apply pra criar o documento');
    process.exitCode = pendencias ? 1 : 0;
} else if (pendencias) {
    console.error('\nRecusando aplicar com pendências acima — um modelo meio traduzido é pior que nenhum.');
    process.exitCode = 1;
} else {

// Pasta _modelos, onde vivem os bases.
const q = `'${PROPOSAL_OUTPUT_FOLDER_ID}' in parents and name='_modelos' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
const pasta = (await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`)).files?.[0]?.id;

const copia = (await api(`https://www.googleapis.com/drive/v3/files/${FONTE.docId}/copy?supportsAllDrives=true`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `MODELO ${IDIOMA.toUpperCase()} ${PRODUTO}`, parents: [pasta] }),
})).id;

// Do parágrafo mais longo pro mais curto: um trecho curto que também apareça
// dentro de um longo seria trocado antes, e a troca do longo não casaria mais.
const ordenadas = [...preenchidos].sort((a, b) => b.original.length - a.original.length);
const requests = ordenadas.map((p) => ({
    replaceAllText: { containsText: { text: p.original, matchCase: true }, replaceText: p.traducao },
}));

const res = await api(`https://docs.googleapis.com/v1/documents/${copia}:batchUpdate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
});

const trocas = (res.replies || []).map((r, i) => ({ n: r.replaceAllText?.occurrencesChanged || 0, p: ordenadas[i] }));
const zerados = trocas.filter((t) => t.n === 0);
console.log(`\n✅ ${PRODUTO} em ${IDIOMA}: ${trocas.reduce((s, t) => s + t.n, 0)} trocas em ${trocas.length} parágrafos`);
if (zerados.length) {
    console.log(`⚠️  ${zerados.length} não encontraram ocorrência no documento copiado:`);
    for (const z of zerados.slice(0, 8)) console.log(`   ${JSON.stringify(z.p.original.slice(0, 70))}`);
}
console.log(`\ndocId: ${copia}`);
console.log(`cole em PROPOSAL_TEMPLATES.${IDIOMA}:`);
console.log(`        ${PRODUTO}: { docId: '${copia}', label: '${FONTE.label}' },`);
console.log(`https://docs.google.com/document/d/${copia}/edit`);
}
}
}
