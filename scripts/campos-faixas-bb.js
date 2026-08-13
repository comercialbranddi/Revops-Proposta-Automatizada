/**
 * Garante os campos das faixas 2 e 3 de preço do Brand Bidding — existência e
 * nome.
 *
 * Algumas propostas de BB não têm preço único: têm escada por quantidade de
 * palavras-chave (Hotmilhas, 13/08/2026 — a primeira que apareceu):
 *
 *     Proposta:
 *     Até 10 palavras-chave: R$ 24.900/mês
 *     Até 20 palavras-chave: R$ 34.900/mês
 *     Até 30 palavras-chave: R$ 42.900/mês
 *
 * A FAIXA 1 reaproveita "Palavras-chave BB (qtd)" e "Preço BB", que já
 * existiam, e os dois FICAM COM O NOME QUE TÊM: renomeá-los pra "BB faixa 1 —
 * …" confundiria a maioria, que nunca usa escada e só quer preencher um preço.
 * Só as faixas 2 e 3 são campo novo, e as duas são opcionais.
 *
 * O nome traz "faixa N" antes de "palavras-chave"/"preço" porque, na tela do
 * card, o par é o que precisa ficar óbvio — o Pipedrive não deixa escolher a
 * ordem dos campos por API (aceita order_nr e ignora, verificado em
 * 13/08/2026), então quem tem que carregar o agrupamento é o nome.
 *
 * Roda quantas vezes quiser: cria o que falta, renomeia o que está com nome
 * antigo, e não toca no que já está certo.
 *
 * Uso:
 *   node scripts/campos-faixas-bb.js
 *   node scripts/campos-faixas-bb.js --apply
 */
import 'dotenv/config';
import { PALAVRAS_BB_FIELD, FAIXAS_BB_FIELDS } from '../src/config/proposal.js';

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

// A chave manda: é ela que a config usa e o card guarda. O nome é rótulo de
// tela e pode mudar sem quebrar nada.
const DESEJADO = FAIXAS_BB_FIELDS.flatMap((f, i) => [
    { key: f.qtd,   name: `BB faixa ${i + 2} - palavras-chave (qtd)` },
    { key: f.preco, name: `BB faixa ${i + 2} - preço` },
]);

const campos = await api('/dealFields?limit=500');
const molde = campos.find((c) => c.key === PALAVRAS_BB_FIELD);
if (!molde) { console.error('não achei "Palavras-chave BB (qtd)" pra copiar tipo e grupo'); process.exit(1); }
console.log(`molde: "${molde.name}" tipo=${molde.field_type} grupo=${molde.group_id}\n`);

let mudancas = 0;
for (const alvo of DESEJADO) {
    const atual = campos.find((c) => c.key === alvo.key);
    if (!atual) {
        mudancas++;
        if (!APPLY) { console.log(`   [simulação] criaria "${alvo.name}"`); continue; }
        const d = await api('/dealFields', { method: 'POST', body: JSON.stringify({ name: alvo.name, field_type: molde.field_type, group_id: molde.group_id }) });
        console.log(`✏️  criado "${alvo.name}" — ${d.key}`);
        console.log(`    ⚠️  chave NOVA: atualize FAIXAS_BB_FIELDS na config`);
        continue;
    }
    if (atual.name === alvo.name) { console.log(`✅ "${alvo.name}"`); continue; }
    mudancas++;
    if (!APPLY) { console.log(`   [simulação] renomearia "${atual.name}" → "${alvo.name}"`); continue; }
    await api(`/dealFields/${atual.id}`, { method: 'PUT', body: JSON.stringify({ name: alvo.name }) });
    console.log(`✏️  "${atual.name}" → "${alvo.name}"`);
}

console.log(mudancas === 0
    ? '\n✅ os quatro campos já estão como devem'
    : (APPLY ? `\n✅ ${mudancas} alteração(ões)` : `\n[simulação] ${mudancas} alteração(ões) — rode com --apply`));

console.log('\nA ORDEM na tela do card não sai por API — o Pipedrive aceita order_nr e ignora.');
console.log('Se quiser os seis juntos, arraste em Configurações → Campos de dados → Closer:');
console.log('   Palavras-chave BB (qtd) · Preço BB          ← faixa 1, os de sempre');
console.log('   BB faixa 2 - palavras-chave (qtd) · BB faixa 2 - preço');
console.log('   BB faixa 3 - palavras-chave (qtd) · BB faixa 3 - preço');
