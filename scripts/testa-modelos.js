/**
 * Bateria sobre os 15 modelos: copia cada um, preenche como o generator
 * preencheria e confere estrutura e conteúdo do documento resultante.
 *
 * Não toca no Pipedrive — testa a metade do fluxo que vive no Drive: modelo
 * certo, placeholders todos substituídos, seções por produto, numeração,
 * caixas, cabeçalho/rodapé e as linhas comerciais.
 *
 * Uso:
 *   node scripts/testa-modelos.js
 *   node scripts/testa-modelos.js --keep     # não apaga as cópias
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { PROPOSAL_TEMPLATES, PROPOSAL_OUTPUT_FOLDER_ID, PRODUCT_CASCADE_ORDER } from '../src/config/proposal.js';

const KEEP = process.argv.includes('--keep');

// Valores distintos por produto pra flagrar troca de campo entre eles.
const PRECO = { BB: 8000, BBP: 6000, GD: 9000, VM: 4000 };
const brl = (n) => `R$ ${n.toLocaleString('pt-BR')}/mês`;
const MARCA = 'Marca Teste Automacao';

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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
    return res;
}

async function preparar(chave, comPacote) {
    const codigos = PRODUCT_CASCADE_ORDER.filter((c) => chave.split('+').includes(c));
    const soma = codigos.reduce((n, c) => n + PRECO[c], 0);
    const valores = {
        'XX de [mês] de [ano]': '10 de Agosto de 2026',
        '{{MARCA}}': MARCA,
        '{{DECISOR}}': MARCA,
        ...Object.fromEntries(codigos.map((c) => [`{{PRECO_${c}}}`, brl(PRECO[c])])),
        ...(codigos.includes('BB') ? { '{{PALAVRAS_BB}}': '4' } : {}),
        ...(codigos.includes('BBP') ? { '{{CATALOGO_BBP}}': '250' } : {}),
        ...(codigos.includes('VM') ? { '{{PLATAFORMAS_VM}}': '7' } : {}),
        ...(codigos.length > 1
            ? {
                '{{TOTAL_DE}}': comPacote ? `De ${brl(soma)}` : brl(soma),
                '{{TOTAL_POR}}': comPacote ? `Por: ${brl(soma - 1500)}` : '',
            }
            : {}),
    };
    return { codigos, soma, valores };
}

const falhas = [];
console.log('modelo         prod  caixas  bullets  cab/rod  checagens');
console.log('─'.repeat(92));

for (const [chave, { docId }] of Object.entries(PROPOSAL_TEMPLATES)) {
    const comPacote = chave.includes('+') && chave.split('+').length % 2 === 0; // alterna com/sem
    const { codigos, soma, valores } = await preparar(chave, comPacote);
    let copia = null;
    try {
        copia = (await (await api(`https://www.googleapis.com/drive/v3/files/${docId}/copy?supportsAllDrives=true`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `__teste ${chave}`, parents: [PROPOSAL_OUTPUT_FOLDER_ID] }),
        })).json()).id;

        const requests = Object.entries(valores).filter(([, v]) => v != null)
            .map(([de, para]) => ({ replaceAllText: { containsText: { text: de, matchCase: true }, replaceText: String(para) } }));
        await api(`https://docs.googleapis.com/v1/documents/${copia}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
        });

        const doc = await (await api(`https://docs.googleapis.com/v1/documents/${copia}?includeTabsContent=true`)).json();
        const tab = doc.tabs?.[0]?.documentTab || doc;
        const paras = []; let caixas = 0;
        (function walk(ct) {
            for (const el of ct || []) {
                if (el.paragraph) paras.push(el.paragraph);
                if (el.table) { caixas++; for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) walk(c.content); }
            }
        })(tab.body.content);
        const linhas = paras.map((p) => (p.elements || []).map((e) => e.textRun?.content || '').join('').replace(/\n/g, '').trim());
        const txt = linhas.join('\n');
        const bullets = paras.filter((p) => p.bullet).length;
        const cab = Object.keys(tab.headers || {}).length, rod = Object.keys(tab.footers || {}).length;

        const conta = (re) => (txt.match(re) || []).length;
        const checagens = [
            ['sem placeholder', !/\{\{[A-Z_]+\}\}|XXX/.test(txt)],
            ['marca', txt.includes(MARCA)],
            ['data', txt.includes('10 de Agosto de 2026')],
            ['caixas', caixas === 5 * codigos.length],
            ['cab+rod', cab === 1 && rod === 1],
            // Só nos combos o título do produto é texto numerado. Nos bases ele
            // é item de lista, e o número é renderizado pela lista — não existe
            // no texto do parágrafo.
            ...(codigos.length > 1 ? [['títulos produto', conta(/^\d+\.\s/gm) === codigos.length]] : []),
            ['itens comerciais', conta(/^\d+ - Prote/gm) === codigos.length],
            ['condições 1x', conta(/^Condi..es Comerciais$/gm) === 1],
            ['setup', /Setup: 01 mensalidade/.test(txt)],
            ...codigos.map((c) => [`preço ${c}`, txt.includes(brl(PRECO[c]))]),
            ...(codigos.includes('BB') ? [['palavras', /Até 4 palavras/.test(txt)]] : []),
            ...(codigos.includes('BBP') ? [['skus', /Até 250 SKUs/.test(txt)]] : []),
            ...(codigos.includes('VM') ? [['plataformas', /Até 7 marketplaces/.test(txt)]] : []),
            ['pacote', codigos.length > 1
                ? txt.includes(comPacote ? `De ${brl(soma)}` : brl(soma))
                : !/TOTAL_|De R\$/.test(txt)],
            // O combo é item próprio e numerado, não uma linha solta no fim.
            ['item combo', codigos.length > 1 ? conta(/^\d+ - Combo:/gm) === 1 : !/ - Combo:/.test(txt)],
            ['condição 1x', conta(/^Condição de pagamento/gm) === 1],
            // Só os combos são uniformizados: os bases são os documentos que o
            // time já usava, e misturar 10pt com 11pt é como eles vieram.
            // Restilizá-los seria mexer no que foi aprovado.
            ...(codigos.length > 1 ? [['corpo 10pt', paras.every((p) => (p.paragraphStyle?.namedStyleType || '').startsWith('HEADING')
                || (p.elements || []).every((e) => !e.textRun?.content?.trim() || e.textRun.textStyle?.fontSize?.magnitude === 10))]] : []),
        ];
        const ruins = checagens.filter(([, ok]) => !ok).map(([n]) => n);
        if (ruins.length) falhas.push(`${chave}: ${ruins.join(', ')}`);
        console.log(`${(ruins.length ? '❌' : '✅')} ${chave.padEnd(13)}${String(codigos.length).padStart(3)}${String(caixas).padStart(7)}${String(bullets).padStart(8)}     ${cab}/${rod}    ${ruins.length ? ruins.join(', ') : `${checagens.length} ok`}`);
    } catch (err) {
        falhas.push(`${chave}: ${err.message}`);
        console.log(`❌ ${chave.padEnd(13)} ${err.message}`);
    } finally {
        if (copia && !KEEP) await api(`https://www.googleapis.com/drive/v3/files/${copia}?supportsAllDrives=true`, { method: 'DELETE' }).catch(() => {});
    }
}

console.log('─'.repeat(92));
console.log(falhas.length ? `❌ ${falhas.length} modelo(s) com problema:\n   ${falhas.join('\n   ')}` : '✅ todos os 15 modelos passaram');
