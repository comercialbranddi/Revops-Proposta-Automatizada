/**
 * Acrescenta uma opção de canal ao campo "Canais <produto>" do Pipedrive.
 *
 * Canal é como um monitoramento novo entra na proposta sem virar produto novo.
 * Foi assim com a loja de aplicativos (App Store, sob BB, em 12/08/2026) e é
 * assim com a Shopee (sob VM, 27/08/2026): o texto do serviço é o mesmo, o que
 * muda é a caixa "Plataforma(s) Monitorada(s)". Produto novo dobraria a matriz
 * de modelos; canal não custa nada.
 *
 * CUIDADO com o PUT: mandar `options` substitui a lista inteira. As opções que
 * já existem vão junto COM o id — omitir uma apaga a opção e limpa o valor nos
 * cards que a usavam.
 *
 * O id da opção nova precisa ser copiado pra CANAIS_OPTION_TO_LABEL na config,
 * senão canaisDoDeal descarta o canal em silêncio e a proposta sai sem ele.
 *
 * Uso:
 *   node scripts/campo-canal.js --produto=VM --label=Shopee
 *   node scripts/campo-canal.js --produto=VM --label=Shopee --apply
 */
import 'dotenv/config';
import { CANAIS_FIELDS, CANAIS_OPTION_TO_LABEL } from '../src/config/proposal.js';

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=');
const APPLY = process.argv.includes('--apply');
const PRODUTO = (arg('produto') || '').toUpperCase();
const LABEL = arg('label');
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;

if (!CANAIS_FIELDS[PRODUTO] || !LABEL) {
    console.error(`uso: --produto=<${Object.keys(CANAIS_FIELDS).join('|')}> --label="Nome do canal" [--apply]`);
    process.exit(1);
}

const api = async (path, opts = {}) => {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.pipedrive.com/v1${path}${sep}api_token=${TOKEN}`, {
        ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 220)}`);
    return body.data;
};

const campos = await api('/dealFields?limit=500');
const campo = campos.find((c) => c.key === CANAIS_FIELDS[PRODUTO]);
if (!campo) { console.error(`campo "Canais ${PRODUTO}" não encontrado`); process.exit(1); }

console.log(`campo #${campo.id} "${campo.name}"`);
for (const o of campo.options) console.log(`   ${o.id}  ${o.label}${CANAIS_OPTION_TO_LABEL[o.id] ? '' : '   ⚠️ fora da config'}`);

const jaTem = campo.options.find((o) => o.label.toLowerCase() === LABEL.toLowerCase());
if (jaTem) { console.log(`\n✅ "${jaTem.label}" já existe — id ${jaTem.id}`); process.exit(0); }

const options = [...campo.options.map((o) => ({ id: o.id, label: o.label })), { label: LABEL }];
if (!APPLY) {
    console.log(`\n[simulação] acrescentaria "${LABEL}" — rode com --apply`);
    process.exit(0);
}

const atualizado = await api(`/dealFields/${campo.id}`, { method: 'PUT', body: JSON.stringify({ options }) });
const criada = atualizado.options.find((o) => o.label === LABEL);
console.log(`\n✏️  "${LABEL}" criada — id ${criada?.id}`);
console.log(`\ncole em CANAIS_OPTION_TO_LABEL (src/config/proposal.js):`);
console.log(`    ${criada?.id}: '${LABEL}',`);
