/**
 * Troca o preço estático de GD e VM por placeholder nos modelos do Drive.
 *
 * Antes: singles com "Proposta: R$ XXXX/mês", combos com "<Produto>: preço a
 * confirmar". Depois: {{PRECO_GD}} / {{PRECO_VM}}, que o generator preenche
 * com o valor do campo do card (PRICED_PRODUCTS passou a incluir GD e VM em
 * 06/08/2026).
 *
 * Não mexe em mais nada — as notas de revisão entre colchetes ficam onde
 * estão, por decisão da Jessica (modelo definitivo ainda não fechado).
 *
 * Uso:
 *   node scripts/fix-price-placeholders.js           # simulação (não escreve)
 *   node scripts/fix-price-placeholders.js --apply   # escreve nos templates
 *
 * Reverter: Google Docs guarda histórico de versões por documento
 * (Arquivo > Histórico de versões).
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma, IDIOMA_PADRAO } from '../src/config/proposal.js';

// Sem --idioma de propósito: correção de uma vez só, e as RULES_BY_KEY abaixo
// casam texto em português ("Proposta: R$ XXXX/mês").
const MODELOS = templatesDoIdioma(IDIOMA_PADRAO);

const APPLY = process.argv.includes('--apply');
const EXPORT_DIR = new URL('../modelos-export/', import.meta.url);

// Só os singles de GD e VM usam "Proposta: R$ XXXX/mês"; os combos listam o
// produto pelo nome com o preço na mesma linha.
const RULES_BY_KEY = (key) => {
    if (key === 'GD') return [{ find: 'Proposta: R$ XXXX/mês', replace: 'Proposta: {{PRECO_GD}}' }];
    if (key === 'VM') return [{ find: 'Proposta: R$ XXXX/mês', replace: 'Proposta: {{PRECO_VM}}' }];
    return [
        { find: 'Golpes Digitais: preço a confirmar', replace: 'Golpes Digitais: {{PRECO_GD}}' },
        { find: 'Violação de Marca: preço a confirmar', replace: 'Violação de Marca: {{PRECO_VM}}' },
    ];
};

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/documents'] });
}

async function batchReplace(client, docId, rules) {
    const { token } = await client.getAccessToken();
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: rules.map(({ find, replace }) => ({
                replaceAllText: { containsText: { text: find, matchCase: true }, replaceText: replace },
            })),
        }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    return (body.replies || []).reduce((sum, r) => sum + (r.replaceAllText?.occurrencesChanged || 0), 0);
}

const client = APPLY ? getClient() : null;
let total = 0;

console.log(APPLY ? '>>> APLICANDO nos templates de produção\n' : '>>> SIMULAÇÃO (nada é escrito) — use --apply para valer\n');

for (const [key, { docId }] of Object.entries(MODELOS)) {
    const rules = RULES_BY_KEY(key);
    try {
        let n;
        if (APPLY) {
            n = await batchReplace(client, docId, rules);
        } else {
            // Conta em cima do export local, sem tocar na API.
            const text = await readFile(new URL(`${key}.txt`, EXPORT_DIR), 'utf-8');
            n = rules.reduce((sum, { find }) => sum + text.split(find).length - 1, 0);
        }
        total += n;
        console.log(`${n > 0 ? '✏️ ' : '  '} ${key.padEnd(14)} ${n} substituição(ões)`);
    } catch (err) {
        console.log(`❌ ${key.padEnd(14)} ${err.message}`);
    }
}

console.log(`\nTotal: ${total} substituições${APPLY ? ' aplicadas' : ' (simulação)'}`);
