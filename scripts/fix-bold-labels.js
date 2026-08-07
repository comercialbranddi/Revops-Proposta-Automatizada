/**
 * Põe em negrito o valor das linhas "Rótulo: valor" que ficaram sem.
 *
 * O padrão dos modelos é rótulo normal + valor em negrito ("Frequência do
 * Monitoramento: **Diária, em horários diversos.**"). Seis linhas nos 4 bases
 * fugiam disso — duas por causa do replaceAllText que trocou o preço de GD/VM
 * (o texto novo herdou o estilo do rótulo), quatro por edição manual anterior.
 *
 * Escopo deliberadamente estreito, pra não pegar prosa que tenha dois-pontos:
 * só parágrafos do corpo (não entra em caixa), não-heading, que comecem com
 * maiúscula, tenham rótulo de até 60 caracteres e algum valor depois.
 *
 * Rode nos 4 bases e depois `rebuild-combos.js --apply` — os combos herdam.
 *
 * Uso:
 *   node scripts/fix-bold-labels.js           # simulação
 *   node scripts/fix-bold-labels.js --apply
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { PROPOSAL_TEMPLATES } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const BASES = ['BB', 'BBP', 'GD', 'VM'];
const LABEL_LINE = /^[A-ZÀ-Ú][^:]{2,60}:\s*\S/;

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

console.log(APPLY ? '>>> APLICANDO nos modelos base\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

let total = 0;
for (const key of BASES) {
    const docId = PROPOSAL_TEMPLATES[key].docId;
    const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
    const tab = doc.tabs?.[0];
    const tabId = tab?.tabProperties?.tabId;
    const body = tab?.documentTab?.body || doc.body;

    const requests = [];
    for (const el of body.content || []) {
        const p = el.paragraph;
        if (!p || p.paragraphStyle?.namedStyleType?.startsWith('HEADING')) continue;

        const runs = (p.elements || []).filter((e) => e.textRun);
        const text = runs.map((e) => e.textRun.content).join('').replace(/\n/g, '');
        if (!LABEL_LINE.test(text) || text.trim().startsWith('[')) continue;

        const colon = text.indexOf(':');
        // O valor já está em negrito? Então não há o que fazer.
        let pos = 0, hasBold = false, hasValue = false;
        for (const e of runs) {
            const t = e.textRun.content.replace(/\n/g, '');
            if (pos + t.length > colon + 1) {
                const seg = t.slice(Math.max(0, colon + 1 - pos));
                if (seg.trim()) { hasValue = true; if (e.textRun.textStyle?.bold) hasBold = true; }
            }
            pos += t.length;
        }
        if (!hasValue || hasBold) continue;

        let start = colon + 1;
        while (start < text.length && text[start] === ' ') start++; // não engorda o espaço
        requests.push({
            updateTextStyle: {
                range: { startIndex: el.startIndex + start, endIndex: el.startIndex + text.length, ...(tabId ? { tabId } : {}) },
                textStyle: { bold: true },
                fields: 'bold',
            },
        });
        console.log(`✏️  ${key.padEnd(4)} ${text.slice(0, 74)}`);
    }

    total += requests.length;
    if (APPLY && requests.length) {
        await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
        });
    }
}

console.log(`\n${total} linha(s) ${APPLY ? 'corrigidas' : 'seriam corrigidas'}`);
