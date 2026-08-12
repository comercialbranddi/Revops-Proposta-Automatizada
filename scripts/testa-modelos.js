/**
 * Bateria sobre os 15 modelos: copia cada um, preenche como o generator
 * preencheria e confere estrutura e conteúdo do documento resultante.
 *
 * Não toca no Pipedrive — testa a metade do fluxo que vive no Drive: modelo
 * certo, placeholders todos substituídos, seções por produto, numeração,
 * caixas, cabeçalho/rodapé e as linhas comerciais.
 *
 * As checagens valem nos três idiomas. O que o teste espera ler sai dos MESMOS
 * helpers que o generator usa (textosDoIdioma, canaisDoDeal) — duplicar as
 * strings aqui foi o que fez esta bateria acusar 15 falhas em inglês quando os
 * modelos estavam certos e quem estava em português eram as asserções.
 *
 * O pouco que sobra em FRASES é texto do MODELO, não do código: "Setup: 01
 * mensalidade" está escrito no documento, não é montado em tempo de execução.
 * Se o comercial reescrever essas linhas, é lá que se ajusta.
 *
 * Uso:
 *   node scripts/testa-modelos.js
 *   node scripts/testa-modelos.js --keep     # não apaga as cópias
 *   node scripts/testa-modelos.js --idioma=en
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import {
    templatesDoIdioma, PROPOSAL_OUTPUT_FOLDER_ID, PRODUCT_CASCADE_ORDER,
    textosDoIdioma, canaisDoDeal, labelCanalVmComContagem,
} from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const KEEP = process.argv.includes('--keep');
const IDIOMA = idiomaDaLinhaDeComando();
const MODELOS = templatesDoIdioma(IDIOMA);

// Valores distintos por produto pra flagrar troca de campo entre eles.
const PRECO = { BB: 8000, BBP: 6000, GD: 9000, VM: 4000 };
const MARCA = 'Marca Teste Automacao';
const PALAVRAS = 4, SKUS = 250, PLATAFORMAS = 7;

// Tudo que o teste espera ler no documento sai dos MESMOS helpers que o
// generator usa. Duplicar as strings aqui foi o que fez esta bateria acusar 15
// falhas em inglês quando os modelos estavam certos: quem estava em português
// eram as asserções.
const T = textosDoIdioma(IDIOMA);
const brl = (n) => `R$ ${n.toLocaleString('pt-BR')}${T.porMes}`;

// Canais: o padrão de cada produto, no idioma do modelo. O VM leva a contagem
// junto, igual ao generator.
const canalVmContagem = labelCanalVmComContagem(IDIOMA);
const CANAIS = Object.fromEntries(['BB', 'BBP', 'GD', 'VM'].map((c) => [c,
    canaisDoDeal({}, c, IDIOMA).map((l) => (
        c === 'VM' && l === canalVmContagem
            ? `${T.ate} ${PLATAFORMAS} ${l.charAt(0).toLowerCase()}${l.slice(1)}`
            : l
    )).join(' + '),
]));

const DATA_LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
function dataFixa() {
    const d = new Date(Date.UTC(2026, 7, 10, 12));
    const p = Object.fromEntries(new Intl.DateTimeFormat(DATA_LOCALE[IDIOMA] || 'pt-BR',
        { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' })
        .formatToParts(d).map((x) => [x.type, x.value]));
    const mes = p.month.charAt(0).toUpperCase() + p.month.slice(1);
    return IDIOMA === 'en' ? `${mes} ${Number(p.day)}, ${p.year}` : `${p.day} de ${mes} de ${p.year}`;
}
const DATA = dataFixa();

// As poucas frases que não vêm de helper — são texto do modelo, não do código.
const FRASES = {
    pt: { setup: 'Setup: 01 mensalidade', pagamento: /^Condição de pagamento/gm, condicoes: /^Condições Comerciais$/gm,
          palavras: (n) => `Até ${n} palavras`, skus: (n) => `Até ${n} SKUs`, marketplaces: (n) => `Até ${n} marketplaces` },
    en: { setup: 'Setup: one monthly fee', pagamento: /^Payment terms/gm, condicoes: /^Commercial Terms$/gm,
          palavras: (n) => `up to ${n} keywords`, skus: (n) => `Up to ${n} SKUs`, marketplaces: (n) => `Up to ${n} marketplaces` },
    es: { setup: 'Setup: 01 mensualidad', pagamento: /^Condición de pago/gm, condicoes: /^Condiciones Comerciales$/gm,
          palavras: (n) => `hasta ${n} palabras`, skus: (n) => `Hasta ${n} SKUs`, marketplaces: (n) => `Hasta ${n} marketplaces` },
};
const F = FRASES[IDIOMA] || FRASES.pt;

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
        // As duas chaves de data, igual ao generator: a frase literal é o que os
        // modelos em português trazem, {{DATA}} é a convenção dos modelos novos.
        'XX de [mês] de [ano]': DATA,
        '{{DATA}}': DATA,
        '{{MARCA}}': MARCA,
        '{{DECISOR}}': MARCA,
        ...Object.fromEntries(codigos.map((c) => [`{{PRECO_${c}}}`, brl(PRECO[c])])),
        ...(codigos.includes('BB') ? { '{{PALAVRAS_BB}}': String(PALAVRAS) } : {}),
        ...(codigos.includes('BBP') ? { '{{CATALOGO_BBP}}': String(SKUS) } : {}),
        ...(codigos.includes('VM') ? { '{{PLATAFORMAS_VM}}': String(PLATAFORMAS) } : {}),
        ...Object.fromEntries(codigos.map((c) => [`{{CANAIS_${c}}}`, CANAIS[c]])),
        ...(codigos.length > 1
            ? { '{{CANAIS_COMBO}}': [...new Set(codigos.flatMap((c) => CANAIS[c].split(' + ')))].join(' + ') }
            : {}),
        ...(codigos.length > 1
            ? {
                '{{TOTAL_DE}}': comPacote ? `${T.de}${brl(soma)}` : brl(soma),
                '{{TOTAL_POR}}': comPacote ? `${T.por}${brl(soma - 1500)}` : '',
            }
            : {}),
    };
    return { codigos, soma, valores };
}

const falhas = [];
console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));
console.log('modelo         prod  caixas  bullets  cab/rod  checagens');
console.log('─'.repeat(92));

for (const [chave, { docId }] of Object.entries(MODELOS)) {
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
            ['data', txt.includes(DATA)],
            ['caixas', caixas === 5 * codigos.length],
            ['cab+rod', cab === 1 && rod === 1],
            // Só nos combos o título do produto é texto numerado. Nos bases ele
            // é item de lista, e o número é renderizado pela lista — não existe
            // no texto do parágrafo.
            ...(codigos.length > 1 ? [['títulos produto', conta(/^\d+\.\s/gm) === codigos.length]] : []),
            // Conta item numerado que NÃO é o do combo — funciona em qualquer
            // idioma, sem depender de como "Proteção" foi traduzido.
            ['itens comerciais', conta(/^\d+ - (?!Combo)/gm) === codigos.length],
            ['condições 1x', conta(F.condicoes) === 1],
            ['setup', txt.includes(F.setup)],
            ...codigos.map((c) => [`preço ${c}`, txt.includes(brl(PRECO[c]))]),
            ...(codigos.includes('BB') ? [['palavras', txt.includes(F.palavras(PALAVRAS))]] : []),
            ...(codigos.includes('BBP') ? [['skus', txt.includes(F.skus(SKUS))]] : []),
            ...(codigos.includes('VM') ? [['plataformas', txt.includes(F.marketplaces(PLATAFORMAS))]] : []),
            ['pacote', codigos.length > 1
                ? txt.includes(comPacote ? `${T.de}${brl(soma)}` : brl(soma))
                : !new RegExp(`TOTAL_|${T.de.trim()}\s*R\$`).test(txt)],
            // O combo é item próprio e numerado, não uma linha solta no fim.
            ['item combo', codigos.length > 1 ? conta(/^\d+ - Combo:/gm) === 1 : !/ - Combo:/.test(txt)],
            // Canais: cada produto traz o seu, e o combo a união sem repetir.
            ...codigos.map((c) => [`canais ${c}`, txt.includes(CANAIS[c])]),
            ...(codigos.length > 1 ? [['canais combo',
                txt.includes(`${T.plataformas} ${[...new Set(codigos.flatMap((c) => CANAIS[c].split(' + ')))].join(' + ')}`)]] : []),
            ['condição 1x', conta(F.pagamento) === 1],
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
        if (copia && !KEEP) {
            // Lixeira, não DELETE: a service account não tem canDelete neste
            // Drive Compartilhado e o DELETE falha calado — foi assim que 110
            // cópias de teste ficaram acumuladas na pasta de saída.
            await api(`https://www.googleapis.com/drive/v3/files/${copia}?supportsAllDrives=true`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
            }).catch((err) => console.log(`   ⚠️ não consegui limpar a cópia ${copia}: ${err.message.slice(0, 60)}`));
        }
    }
}

console.log('─'.repeat(92));
console.log(falhas.length ? `❌ ${falhas.length} modelo(s) com problema:\n   ${falhas.join('\n   ')}` : '✅ todos os 15 modelos passaram');
