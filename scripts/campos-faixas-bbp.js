/**
 * Garante os campos das faixas 2, 3 e 4 de preço do Buy Box Protection, e o
 * campo "tem faixa Sob Consulta?" — existência e nome.
 *
 * Mesma ideia da escada do BB (scripts/campos-faixas-bb.js), só que o BBP
 * pediu 4 faixas com preço (não 3) e uma quinta faixa sem preço numérico
 * ("Acima de 200 SKUs: Sob Consulta") — decisão da Jessica em 14/08/2026.
 *
 * A FAIXA 1 reaproveita "Catálogo BBP (SKUs)" e "Preço BBP", que já existiam
 * — os dois ficam com o nome que têm. Faixas 2, 3 e 4 são campo novo,
 * opcionais. "Sob Consulta" é um campo separado (sim/não, tipo `set`, mesmo
 * padrão de "Persona é decisor?") porque não tem preço pra guardar — o texto
 * da linha final é sempre "Acima de <qtd da faixa mais alta> SKUs: Sob
 * consulta", montado em código, não digitado.
 *
 * Uso:
 *   node scripts/campos-faixas-bbp.js
 *   node scripts/campos-faixas-bbp.js --apply
 */
import 'dotenv/config';
import { CATALOGO_BBP_FIELD, FAIXAS_BBP_FIELDS, SOB_CONSULTA_BBP_FIELD } from '../src/config/proposal.js';

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

const DESEJADO_NUMERICO = FAIXAS_BBP_FIELDS.flatMap((f, i) => [
    { key: f.qtd,   name: `BBP faixa ${i + 2} - SKUs (qtd)` },
    { key: f.preco, name: `BBP faixa ${i + 2} - preço` },
]);

const campos = await api('/dealFields?limit=500');
const molde = campos.find((c) => c.key === CATALOGO_BBP_FIELD);
if (!molde) { console.error('não achei "Catálogo BBP (SKUs)" pra copiar tipo e grupo'); process.exit(1); }
console.log(`molde numérico: "${molde.name}" tipo=${molde.field_type} grupo=${molde.group_id}\n`);

let mudancas = 0;
for (const alvo of DESEJADO_NUMERICO) {
    const atual = campos.find((c) => c.key === alvo.key);
    if (!atual) {
        mudancas++;
        if (!APPLY) { console.log(`   [simulação] criaria "${alvo.name}"`); continue; }
        const d = await api('/dealFields', { method: 'POST', body: JSON.stringify({ name: alvo.name, field_type: molde.field_type, group_id: molde.group_id }) });
        console.log(`✏️  criado "${alvo.name}" — ${d.key}`);
        console.log(`    ⚠️  chave NOVA: atualize FAIXAS_BBP_FIELDS na config`);
        continue;
    }
    if (atual.name === alvo.name) { console.log(`✅ "${alvo.name}"`); continue; }
    mudancas++;
    if (!APPLY) { console.log(`   [simulação] renomearia "${atual.name}" → "${alvo.name}"`); continue; }
    await api(`/dealFields/${atual.id}`, { method: 'PUT', body: JSON.stringify({ name: alvo.name }) });
    console.log(`✏️  "${atual.name}" → "${alvo.name}"`);
}

// Campo booleano "Sob Consulta" — tipo `set` com opções Sim/Não, mesmo padrão
// de "Persona é decisor?" (key 6c395f9da073b96aa859819906c0229faac5631b).
const atualSC = campos.find((c) => c.key === SOB_CONSULTA_BBP_FIELD);
const NOME_SC = 'BBP faixa Sob Consulta?';
if (!atualSC) {
    mudancas++;
    if (!APPLY) {
        console.log(`   [simulação] criaria "${NOME_SC}" (set, Sim/Não)`);
    } else {
        const d = await api('/dealFields', {
            method: 'POST',
            body: JSON.stringify({
                name: NOME_SC,
                field_type: 'set',
                group_id: molde.group_id,
                options: [{ label: 'Sim' }, { label: 'Não' }],
            }),
        });
        console.log(`✏️  criado "${NOME_SC}" — ${d.key}`);
        console.log(`    opções: ${JSON.stringify(d.options)}`);
        console.log(`    ⚠️  chave NOVA: atualize SOB_CONSULTA_BBP_FIELD na config`);
    }
} else if (atualSC.name !== NOME_SC) {
    mudancas++;
    if (!APPLY) { console.log(`   [simulação] renomearia "${atualSC.name}" → "${NOME_SC}"`); }
    else { await api(`/dealFields/${atualSC.id}`, { method: 'PUT', body: JSON.stringify({ name: NOME_SC }) }); console.log(`✏️  "${atualSC.name}" → "${NOME_SC}"`); }
} else {
    console.log(`✅ "${NOME_SC}"`);
}

console.log(mudancas === 0
    ? '\n✅ todos os campos já estão como devem'
    : (APPLY ? `\n✅ ${mudancas} alteração(ões)` : `\n[simulação] ${mudancas} alteração(ões) — rode com --apply`));
