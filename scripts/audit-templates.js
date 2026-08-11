/**
 * Auditoria de formatação dos 15 modelos: caixas, negrito, headings e
 * placeholders por modelo.
 *
 * Serve de antes/depois do rebuild dos combos — os 4 bases (BB, BBP, GD, VM)
 * são a referência; todo combo deveria bater com eles.
 *
 * Uso:
 *   node scripts/audit-templates.js
 *   node scripts/audit-templates.js --idioma=en
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const BASES = ['BB', 'BBP', 'GD', 'VM'];
const IDIOMA = idiomaDaLinhaDeComando();
const MODELOS = templatesDoIdioma(IDIOMA);

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/documents.readonly'] });
}

/** Achata parágrafos do corpo e de dentro das tabelas numa lista só. */
function collectParagraphs(content, out = []) {
    for (const el of content || []) {
        if (el.paragraph) out.push(el.paragraph);
        if (el.table) {
            for (const row of el.table.tableRows || []) {
                for (const cell of row.tableCells || []) collectParagraphs(cell.content, out);
            }
        }
    }
    return out;
}

function countTables(content) {
    return (content || []).filter((el) => el.table).length;
}

const client = getClient();
const { token } = await client.getAccessToken();

// O padrão não é fixo: é o que os modelos-base usam. Quando os bases trocaram
// (H1+H2 do piloto para H2+H3+H4 dos modelos antigos), um critério chumbado
// reprovaria os onze combos sem que nada estivesse errado com eles.
let padraoHeadings = null;
let caixasPorBase = {};

console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));
console.log('modelo          caixas  negrito  headings      placeholders');
console.log('─'.repeat(96));

for (const [key, { docId }] of Object.entries(MODELOS)) {
    try {
        const res = await fetch(
            `https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const doc = await res.json();
        const body = doc.tabs?.[0]?.documentTab?.body || doc.body;

        const paras = collectParagraphs(body.content);
        const boxes = countTables(body.content);
        const bold = paras.reduce((n, p) => n + (p.elements || [])
            .filter((e) => e.textRun?.textStyle?.bold && e.textRun.content.trim()).length, 0);
        const heads = [...new Set(paras.map((p) => p.paragraphStyle?.namedStyleType).filter((s) => s?.startsWith('HEADING')))].sort();
        const text = paras.map((p) => (p.elements || []).map((e) => e.textRun?.content || '').join('')).join('');
        const ph = [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) || [])].length;

        const isBase = BASES.includes(key);
        const assinatura = heads.map((h) => h.replace('HEADING_', 'H')).join('+') || '—';
        if (isBase) {
            padraoHeadings ??= assinatura;
            caixasPorBase[key] = boxes;
        }

        // Combo saudável: mesma hierarquia dos bases e a soma exata das caixas
        // dos produtos que o compõem — caixa a menos é seção que se perdeu.
        const esperado = isBase ? boxes
            : key.split('+').reduce((n, c) => n + (caixasPorBase[c] ?? 0), 0);
        const ok = bold > 0 && assinatura === padraoHeadings && boxes === esperado;
        const flag = isBase ? '·' : (ok ? '✅' : `❌ (caixas esperadas: ${esperado})`);

        console.log(
            `${flag.padEnd(2)} ${key.padEnd(14)}${String(boxes).padStart(4)}${String(bold).padStart(9)}`
            + `  ${assinatura.padEnd(12)}  ${ph}`,
        );
    } catch (err) {
        console.log(`❌ ${key.padEnd(14)} ${err.message}`);
    }
}

console.log('\n· = modelo base (referência)   ✅ = combo no padrão   ❌ = combo fora do padrão');
