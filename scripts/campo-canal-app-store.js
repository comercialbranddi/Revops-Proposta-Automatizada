/**
 * Acrescenta "App Store (ASA e Play Store)" às opções do campo "Canais BB".
 *
 * Por que isso existe: as propostas de App Store que o time enviou (Jusbrasil,
 * 29/04 e 30/07/2026) são a proposta de Brand Bidding com a caixa
 * "Plataforma(s) Monitorada(s)" trocada — mesmo texto de proteções, mesmos
 * entregáveis, mesmas condições. Ou seja, loja de aplicativos é CANAL de BB,
 * não produto com modelo próprio. Com a opção no campo, o closer marca o canal
 * e a proposta sai completa.
 *
 * Cuidado com o PUT: mandar `options` substitui a lista inteira. As opções que
 * já existem vão junto COM o id — omitir uma apaga a opção e limpa o valor nos
 * cards que a usavam.
 *
 * Uso:
 *   node scripts/campo-canal-app-store.js           # mostra o que faria
 *   node scripts/campo-canal-app-store.js --apply
 */
import 'dotenv/config';
import { CANAIS_FIELDS } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const NOVA_OPCAO = 'App Store (ASA e Play Store)';

if (!TOKEN) {
    console.error('PIPEDRIVE_API_TOKEN não configurado (.env)');
    process.exit(1);
}

const api = async (path, opts = {}) => {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.pipedrive.com/v1${path}${sep}api_token=${TOKEN}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) {
        throw new Error(`Pipedrive ${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
    }
    return body.data;
};

async function main() {
    // O campo é identificado pela chave que a config já usa, não por um id
    // solto — se alguém recriar o campo, a config é o único lugar a atualizar.
    const campos = await api('/dealFields?limit=500');
    const campo = campos.find((c) => c.key === CANAIS_FIELDS.BB);
    if (!campo) {
        console.error(`campo "Canais BB" (${CANAIS_FIELDS.BB}) não encontrado`);
        return 1;
    }

    console.log(`campo #${campo.id} "${campo.name}" (${campo.field_type})`);
    console.log('opções hoje:', campo.options.map((o) => `${o.id}=${o.label}`).join(', '));

    const jaTem = campo.options.find((o) => o.label === NOVA_OPCAO);
    if (jaTem) {
        console.log(`\n✅ "${NOVA_OPCAO}" já existe — id ${jaTem.id}. Nada a fazer.`);
        return 0;
    }

    const options = [...campo.options.map((o) => ({ id: o.id, label: o.label })), { label: NOVA_OPCAO }];

    if (!APPLY) {
        console.log(`\n[simulação] acrescentaria "${NOVA_OPCAO}" — rode com --apply`);
        console.log('payload:', JSON.stringify({ options }));
        return 0;
    }

    const atualizado = await api(`/dealFields/${campo.id}`, { method: 'PUT', body: JSON.stringify({ options }) });
    const criada = atualizado.options.find((o) => o.label === NOVA_OPCAO);
    console.log('\n✅ opções agora:', atualizado.options.map((o) => `${o.id}=${o.label}`).join(', '));
    console.log(`\nid da nova opção: ${criada?.id} — anote em CANAIS_OPTION_TO_LABEL e CANAL_BB_APP_STORE_ID.`);
    return 0;
}

process.exitCode = await main().catch((err) => {
    console.error(`\n❌ ${err.message}`);
    return 1;
});
