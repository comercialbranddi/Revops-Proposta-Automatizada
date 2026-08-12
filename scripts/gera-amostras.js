/**
 * Gera uma amostra preenchida de cada um dos 15 modelos, numa pasta separada,
 * pra alguém do comercial ler e validar o texto.
 *
 * É o que os testes automatizados NÃO fazem: eles conferem que o documento
 * monta certo, não se o texto está bom pra mandar pro cliente.
 *
 * Os dados são fictícios e evidentes ("Cliente Exemplo"), e os arquivos são
 * nomeados "AMOSTRA — …" pra ninguém confundir com proposta real.
 *
 * Uso:
 *   node scripts/gera-amostras.js
 *   node scripts/gera-amostras.js --limpar   # apaga as amostras anteriores
 *   node scripts/gera-amostras.js --idioma=en
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import {
    templatesDoIdioma, PROPOSAL_OUTPUT_FOLDER_ID, PRODUCT_CASCADE_ORDER, IDIOMA_PADRAO,
    textosDoIdioma, canaisDoDeal, labelCanalVmComContagem,
} from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const LIMPAR = process.argv.includes('--limpar');
const IDIOMA = idiomaDaLinhaDeComando();
const MODELOS = templatesDoIdioma(IDIOMA);
const PASTA = '_amostras para validação';
// Todos os idiomas dividem a mesma pasta, então o nome carrega o idioma e a
// faxina só toca no que é do idioma corrente. Sem isso, um --idioma=en varreria
// as amostras em português que o comercial está validando.
const PREFIXO = IDIOMA === IDIOMA_PADRAO ? 'AMOSTRA — ' : `AMOSTRA (${IDIOMA}) — `;
const MARCA = 'Cliente Exemplo';

// Preços plausíveis, próximos dos praticados.
const PRECO = { BB: 7900, BBP: 9900, GD: 6000, VM: 4900 };
const PALAVRAS = 3, SKUS = 150, PLATAFORMAS = 3;

// A amostra tem que sair EXATAMENTE como a proposta real sairia, senão ela não
// valida nada — por isso reusa as mesmas strings por idioma que o generator
// usa, em vez de montar as suas.
const T = textosDoIdioma(IDIOMA);
const brl = (n) => `R$ ${n.toLocaleString('pt-BR')}${T.porMes}`;
const TZ = 'America/Sao_Paulo';
const DATA_LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
function dataBR() {
    const locale = DATA_LOCALE[IDIOMA] || DATA_LOCALE[IDIOMA_PADRAO];
    const p = Object.fromEntries(new Intl.DateTimeFormat(locale, { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric' })
        .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const mes = p.month.charAt(0).toUpperCase() + p.month.slice(1);
    if (IDIOMA === 'en') return `${mes} ${Number(p.day)}, ${p.year}`;
    return `${p.day} de ${mes} de ${p.year}`;
}

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
    return res.status === 204 ? {} : res.json();
}
const listar = async (pai) => {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${pai}' in parents and trashed=false`);
    u.searchParams.set('fields', 'files(id,name)'); u.searchParams.set('pageSize', '200');
    u.searchParams.set('supportsAllDrives', 'true'); u.searchParams.set('includeItemsFromAllDrives', 'true');
    return (await api(u.toString())).files || [];
};

// Pasta das amostras (cria se não existir).
let pasta = (await listar(PROPOSAL_OUTPUT_FOLDER_ID)).find((f) => f.name === PASTA)?.id;
if (!pasta) {
    pasta = (await api('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: PASTA, mimeType: 'application/vnd.google-apps.folder', parents: [PROPOSAL_OUTPUT_FOLDER_ID] }),
    })).id;
}
for (const f of (await listar(pasta)).filter((f) => f.name.startsWith(PREFIXO))) {
    await api(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    });
}
if (LIMPAR) { console.log(`amostras anteriores removidas de "${PASTA}"`); process.exit(0); }

console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));
console.log(`Amostras em "${PASTA}" — marca fictícia "${MARCA}"\n`);
console.log(`preços: BB ${brl(PRECO.BB)} · BBP ${brl(PRECO.BBP)} · GD ${brl(PRECO.GD)} · VM ${brl(PRECO.VM)}`);
console.log(`palavras-chave ${PALAVRAS} · catálogo ${SKUS} SKUs · ${PLATAFORMAS} marketplaces\n`);

for (const [chave, { docId, label }] of Object.entries(MODELOS)) {
    const codigos = PRODUCT_CASCADE_ORDER.filter((c) => chave.split('+').includes(c));
    const soma = codigos.reduce((n, c) => n + PRECO[c], 0);
    // Desconto de 10% arredondado na centena, como um fechamento de pacote real.
    const fechado = Math.round((soma * 0.9) / 100) * 100;
    const combo = codigos.length > 1;

    const valores = {
        // As duas chaves de data, igual ao generator (ver o comentário lá).
        'XX de [mês] de [ano]': dataBR(),
        '{{DATA}}': dataBR(),
        '{{MARCA}}': MARCA,
        '{{DECISOR}}': MARCA,
        ...Object.fromEntries(codigos.map((c) => [`{{PRECO_${c}}}`, brl(PRECO[c])])),
        ...(codigos.includes('BB') ? { '{{PALAVRAS_BB}}': String(PALAVRAS) } : {}),
        ...(codigos.includes('BBP') ? { '{{CATALOGO_BBP}}': String(SKUS) } : {}),
        ...(codigos.includes('VM') ? { '{{PLATAFORMAS_VM}}': String(PLATAFORMAS) } : {}),
        ...(combo ? { '{{TOTAL_DE}}': `${T.de}${brl(soma)}`, '{{TOTAL_POR}}': `${T.por}${brl(fechado)}` } : {}),
        // Canal: sem isto a amostra saía com {{CANAIS_BB}} cru no documento.
        // Campo vazio cai no padrão do produto, que é o caso mais comum.
        ...Object.fromEntries(codigos.map((c) => {
            const labels = canaisDoDeal({}, c, IDIOMA).map((l) => (
                c === 'VM' && l === labelCanalVmComContagem(IDIOMA)
                    ? `${T.ate} ${PLATAFORMAS} ${l.charAt(0).toLowerCase()}${l.slice(1)}`
                    : l
            ));
            return [`{{CANAIS_${c}}}`, labels.join(' + ')];
        })),
        ...(combo ? { '{{CANAIS_COMBO}}': [...new Set(codigos.flatMap((c) => canaisDoDeal({}, c, IDIOMA)))].join(' + ') } : {}),
    };

    const nome = `${PREFIXO}${chave}${combo ? ` (${brl(soma)} → ${brl(fechado)})` : ''}`;
    const copia = (await api(`https://www.googleapis.com/drive/v3/files/${docId}/copy?supportsAllDrives=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, parents: [pasta] }),
    })).id;
    await api(`https://docs.googleapis.com/v1/documents/${copia}:batchUpdate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: Object.entries(valores).map(([de, para]) => ({ replaceAllText: { containsText: { text: de, matchCase: true }, replaceText: String(para) } })) }),
    });
    await api(`https://www.googleapis.com/drive/v3/files/${copia}/permissions?supportsAllDrives=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'domain', domain: 'branddi.com' }),
    }).catch(() => {});

    console.log(`${chave.padEnd(14)} https://docs.google.com/document/d/${copia}/edit`);
}

console.log(`\npasta: https://drive.google.com/drive/folders/${pasta}`);
