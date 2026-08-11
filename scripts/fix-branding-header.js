/**
 * Padroniza o wordmark "◈ branddi" no topo dos modelos.
 *
 * Só o modelo de BB tinha a linha (16pt, negrito, #1A1A1A) — os outros 14
 * abriam direto na data, saindo pro cliente sem nenhuma identificação da
 * Branddi. Nenhum dos docs tem logo em imagem nem cabeçalho do Google Docs
 * (verificado via API em 06/08/2026), então o wordmark em texto do BB é a
 * referência existente e é ele que replicamos.
 *
 * Quando houver o logo em imagem, isso aqui vira insertInlineImage — o
 * wordmark em texto é o padrão atual, não o alvo final.
 *
 * Uso:
 *   node scripts/fix-branding-header.js           # simulação
 *   node scripts/fix-branding-header.js --apply   # escreve nos templates
 *
 * Reverter: Arquivo > Histórico de versões, por documento.
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma, IDIOMA_PADRAO } from '../src/config/proposal.js';

// Sem --idioma de propósito: correção de uma vez só nos modelos em português.
// Modelo novo em outro idioma precisa do wordmark também — quando existir, é
// aqui que a flag entra.
const MODELOS = templatesDoIdioma(IDIOMA_PADRAO);

const APPLY = process.argv.includes('--apply');

const WORDMARK = '◈ branddi';
// Wordmark + linha em branco de respiro, igual ao modelo de BB.
const INSERT = `${WORDMARK}\n \n`;
const STYLE = {
    bold: true,
    fontSize: { magnitude: 16, unit: 'PT' },
    foregroundColor: { color: { rgbColor: { red: 0.101960786, green: 0.101960786, blue: 0.101960786 } } },
};

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/documents'] });
}

async function api(token, url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}

const client = getClient();
const { token } = await client.getAccessToken();

console.log(APPLY ? '>>> APLICANDO nos templates de produção\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

let changed = 0;
for (const [key, { docId }] of Object.entries(MODELOS)) {
    try {
        const doc = await api(token, `https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
        const tab = doc.tabs?.[0];
        const body = tab?.documentTab?.body || doc.body;
        const first = (body?.content || []).find((el) => el.paragraph);
        const firstText = (first?.paragraph?.elements || []).map((e) => e.textRun?.content || '').join('').trim();

        if (firstText.startsWith(WORDMARK)) {
            console.log(`   ${key.padEnd(14)} já tem o wordmark`);
            continue;
        }

        changed++;
        if (!APPLY) {
            console.log(`✏️  ${key.padEnd(14)} inseriria (hoje começa com ${JSON.stringify(firstText.slice(0, 30))})`);
            continue;
        }

        // O corpo começa no índice 1. Insere e estiliza só o wordmark — o
        // "\n \n" que vem depois fica com o estilo normal do parágrafo.
        const location = { index: 1, ...(tab?.tabProperties?.tabId ? { tabId: tab.tabProperties.tabId } : {}) };
        await api(token, `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [
                    { insertText: { location, text: INSERT } },
                    {
                        updateTextStyle: {
                            range: { startIndex: 1, endIndex: 1 + WORDMARK.length, ...(location.tabId ? { tabId: location.tabId } : {}) },
                            textStyle: STYLE,
                            fields: 'bold,fontSize,foregroundColor',
                        },
                    },
                ],
            }),
        });
        console.log(`✏️  ${key.padEnd(14)} wordmark inserido`);
    } catch (err) {
        console.log(`❌ ${key.padEnd(14)} ${err.message}`);
    }
}

console.log(`\n${changed} documento(s)${APPLY ? ' alterados' : ' seriam alterados'}`);
