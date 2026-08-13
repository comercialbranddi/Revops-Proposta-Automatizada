/**
 * Cria os campos das faixas 2 e 3 de preço do Brand Bidding.
 *
 * Algumas propostas de BB não têm preço único: têm escada por quantidade de
 * palavras-chave (Hotmilhas, 13/08/2026 — a única no Drive até agora):
 *
 *     Proposta:
 *     Até 10 palavras-chave: R$ 24.900/mês
 *     Até 20 palavras-chave: R$ 34.900/mês
 *     Até 30 palavras-chave: R$ 42.900/mês
 *
 * A faixa 1 REAPROVEITA os campos que já existem — "Palavras-chave BB (qtd)" e
 * "Preço BB". Só as faixas 2 e 3 precisam de campo novo, e as duas são
 * OPCIONAIS: card que não usa escada continua gerando com preço único, como
 * sempre. É a maioria dos casos.
 *
 * Uso:
 *   node scripts/campos-faixas-bb.js
 *   node scripts/campos-faixas-bb.js --apply
 */
import 'dotenv/config';
import { PALAVRAS_BB_FIELD } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;

const api = async (path, opts = {}) => {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.pipedrive.com/v1${path}${sep}api_token=${TOKEN}`, {
        ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    return body.data;
};

const campos = await api('/dealFields?limit=500');
const modelo = campos.find((c) => c.key === PALAVRAS_BB_FIELD);
if (!modelo) { console.error('não achei "Palavras-chave BB (qtd)" pra copiar tipo e grupo'); process.exit(1); }
console.log(`molde: "${modelo.name}" tipo=${modelo.field_type} grupo=${modelo.group_id} ordem=${modelo.order_nr}\n`);

// Ordem logo depois dos campos da faixa 1, pra ficarem juntos na tela do card.
const NOVOS = [
    { name: 'Palavras-chave BB faixa 2 (qtd)', order_nr: modelo.order_nr + 1 },
    { name: 'Preço BB faixa 2',                order_nr: modelo.order_nr + 2 },
    { name: 'Palavras-chave BB faixa 3 (qtd)', order_nr: modelo.order_nr + 3 },
    { name: 'Preço BB faixa 3',                order_nr: modelo.order_nr + 4 },
];

const criados = {};
for (const novo of NOVOS) {
    const existe = campos.find((c) => c.name === novo.name);
    if (existe) { console.log(`✅ "${novo.name}" já existe — ${existe.key}`); criados[novo.name] = existe.key; continue; }
    if (!APPLY) { console.log(`   [simulação] criaria "${novo.name}" (${modelo.field_type}, grupo ${modelo.group_id})`); continue; }
    const d = await api('/dealFields', {
        method: 'POST',
        body: JSON.stringify({ name: novo.name, field_type: modelo.field_type, group_id: modelo.group_id, order_nr: novo.order_nr }),
    });
    console.log(`✏️  criado "${novo.name}" — ${d.key}`);
    criados[novo.name] = d.key;
}

if (!APPLY) { console.log('\nrode com --apply'); process.exit(0); }
console.log('\n── cole em src/config/proposal.js ──');
console.log('export const FAIXAS_BB_FIELDS = [');
console.log(`    { qtd: '${criados['Palavras-chave BB faixa 2 (qtd)']}', preco: '${criados['Preço BB faixa 2']}' },`);
console.log(`    { qtd: '${criados['Palavras-chave BB faixa 3 (qtd)']}', preco: '${criados['Preço BB faixa 3']}' },`);
console.log('];');
