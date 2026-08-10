/**
 * Insere os placeholders da automação nos modelos-base importados da pasta
 * antiga "Modelo Propostas".
 *
 * Os modelos antigos eram preenchidos à mão e já traziam marcadores próprios
 * ("XXX" pra marca, "xx de Janeiro de 2026" pra data, "Até XX SKUs"). Este
 * script troca esses marcadores pelos placeholders que o generator entende.
 *
 * Dois cuidados que custaram caro:
 *
 * 1. A ordem importa: "Para: XXX" tem que ser trocado ANTES do "XXX" solto,
 *    senão o decisor vira a marca.
 *
 * 2. O documento guarda espaço não-quebrável (U+00A0) entre "R$" e o número, e
 *    o export em texto puro normaliza isso pra espaço comum. Contar match no
 *    export dá falso positivo — o replaceAllText é literal e não casa. Por isso
 *    a contagem é feita no texto real (Docs API) e cada busca é emitida também
 *    na variante com NBSP.
 *
 * Idempotente: rodar de novo não faz nada, porque os marcadores já viraram
 * placeholders.
 *
 * Uso:
 *   node scripts/aplica-placeholders.js           # simulação
 *   node scripts/aplica-placeholders.js --apply
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { PROPOSAL_TEMPLATES } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const NBSP = ' ';

// "XX de [mês] de [ano]" é a frase que o generator troca pela data do dia.
const DATA_ALVO = 'XX de [mês] de [ano]';

const TROCAS = {
    BB: [
        ['Para: XXX', 'Para: {{DECISOR}}'],
        ['XXX', '{{MARCA}}'],
        ['XX de Maio de 2026', DATA_ALVO],
        ['R$ 7.900/mês', '{{PRECO_BB}}'],
        // Quantidade de palavras é negociada por cliente (as propostas de
        // agosto saíram com 2 e com 3), então vem do card.
        ['Até 3 palavras.', 'Até {{PALAVRAS_BB}} palavras.'],
    ],
    BBP: [
        ['Para: XXX', 'Para: {{DECISOR}}'],
        ['XXX', '{{MARCA}}'],
        ['xx de Janeiro de 2026', DATA_ALVO],
        ['R$ 9.900/mês', '{{PRECO_BBP}}'],
        ['Até XX SKUs', 'Até {{CATALOGO_BBP}} SKUs'],
    ],
    VM: [
        ['Para: XXX', 'Para: {{DECISOR}}'],
        ['XXX', '{{MARCA}}'],
        // O modelo antigo tinha a data de emissão chumbada, não um marcador.
        ['29 de janeiro de 2026', DATA_ALVO],
        ['R$ 4.900,00/mes', '{{PRECO_VM}}'],
        // Aparece em dois pontos: nas Especificações e na Proposta Comercial.
        ['Até 3 marketplaces', 'Até {{PLATAFORMAS_VM}} marketplaces'],
    ],
    GD: [
        ['Para: XXX', 'Para: {{DECISOR}}'],
        ['XXX', '{{MARCA}}'],
        ['XX de janeiro de 2026', DATA_ALVO],
        // O "De/Por" do modelo antigo é desconto de PACOTE, não do produto —
        // vira bloco de combo. No produto único fica só o valor negociado.
        ['De R$ 12.900/mês', ''],
        ['Por: R$ 9.900/mês', '{{PRECO_GD}}'],
    ],
};

/** O mesmo trecho pode estar guardado com espaço comum ou com NBSP. */
function variantes(texto) {
    return [...new Set([texto, texto.replaceAll(' ', NBSP), texto.replaceAll(NBSP, ' ')])];
}

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

/** Texto como o documento realmente guarda — preserva NBSP, ao contrário do export. */
async function textoDoc(docId) {
    const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
    const body = doc.tabs?.[0]?.documentTab?.body || doc.body;
    const partes = [];
    (function walk(conteudo) {
        for (const el of conteudo || []) {
            if (el.paragraph) partes.push((el.paragraph.elements || []).map((e) => e.textRun?.content || '').join(''));
            if (el.table) for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) walk(c.content);
        }
    })(body.content);
    return partes.join('');
}

console.log(APPLY ? '>>> APLICANDO nos modelos\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

for (const cod of Object.keys(TROCAS)) {
    const docId = PROPOSAL_TEMPLATES[cod].docId;
    let simulado = await textoDoc(docId);
    const requests = [];
    console.log(`── ${cod}`);

    for (const [de, para] of TROCAS[cod]) {
        let total = 0;
        for (const v of variantes(de)) {
            const n = simulado.split(v).length - 1;
            if (!n) continue;
            total += n;
            simulado = simulado.split(v).join(para);
            requests.push({ replaceAllText: { containsText: { text: v, matchCase: true }, replaceText: para } });
        }
        const jaFeito = simulado.includes(para) && para;
        console.log(`   ${total ? '✏️ ' : (jaFeito ? '· ' : '⚠️ ')} ${String(total).padStart(2)}x  "${de}" → "${para || '(remove)'}"${total ? '' : (jaFeito ? '  (já aplicado)' : '  NÃO ENCONTRADO')}`);
    }

    if (APPLY && requests.length) {
        await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
        });
    }

    const sobrando = [...new Set(simulado.match(/XXX|R\$[\s ]?[\d.,]+/g) || [])];
    if (sobrando.length) console.log(`   ⚠️  ainda no texto: ${sobrando.map((s) => JSON.stringify(s)).join(' · ')}`);
    console.log(`   placeholders: ${[...new Set(simulado.match(/\{\{[A-Z_]+\}\}/g) || [])].join(', ') || '(nenhum)'}\n`);
}

console.log(APPLY ? 'Aplicado.' : 'Simulação concluída.');
