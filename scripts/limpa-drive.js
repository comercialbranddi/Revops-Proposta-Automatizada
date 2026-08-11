/**
 * Faxina da pasta de saída no Drive.
 *
 * Três fontes de sujeira, todas nossas:
 *  - cópias temporárias de script ("__*") que ficaram pra trás na raiz;
 *  - versões antigas de modelo em _modelos, de cada vez que os combinados
 *    foram remontados;
 *  - propostas de teste na pasta do cliente, que não são a vigente do card.
 *
 * O que NUNCA é tocado: os 15 modelos da config, a proposta vinculada ao card,
 * as amostras de validação e o arquivo morto (_testes-piloto).
 *
 * Uso:
 *   node scripts/limpa-drive.js            # lista o que faria
 *   node scripts/limpa-drive.js --apply
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { PROPOSAL_TEMPLATES, PROPOSAL_OUTPUT_FOLDER_ID as ROOT, PROPOSAL_DEAL_FIELDS as F } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const PROTEGIDAS = ['_amostras para validação', '_testes-piloto'];

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) { console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada'); process.exit(1); }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
}
const client = getClient();
async function api(url, opts = {}) {
    const { token } = await client.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
    return res.status === 204 ? {} : res.json();
}
async function listar(pai) {
    const out = []; let pageToken;
    do {
        const u = new URL('https://www.googleapis.com/drive/v3/files');
        u.searchParams.set('q', `'${pai}' in parents and trashed=false`);
        u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
        u.searchParams.set('pageSize', '300');
        u.searchParams.set('supportsAllDrives', 'true');
        u.searchParams.set('includeItemsFromAllDrives', 'true');
        if (pageToken) u.searchParams.set('pageToken', pageToken);
        const r = await api(u.toString());
        out.push(...(r.files || [])); pageToken = r.nextPageToken;
    } while (pageToken);
    return out;
}
const ehPasta = (f) => f.mimeType.endsWith('.folder');

// Proposta vigente do card de teste — essa fica.
const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = process.env.PROPOSAL_TEST_DEAL_ID;
let vinculada = null;
if (T && ID) {
    const d = (await (await fetch(`https://api.pipedrive.com/v1/deals/${ID}?api_token=${T}`)).json()).data;
    vinculada = (String(d?.[F.LINK_PROPOSTA] || '').match(/document\/d\/([\w-]+)/) || [])[1] || null;
}

const emUso = new Set(Object.values(PROPOSAL_TEMPLATES).map((t) => t.docId));
const alvos = [];

const raiz = await listar(ROOT);

// 1. Temporários soltos na raiz.
for (const f of raiz.filter((x) => !ehPasta(x) && /^__/.test(x.name))) alvos.push({ ...f, motivo: 'temporário de script' });

// 2. Versões antigas de modelo.
const modelos = raiz.find((f) => ehPasta(f) && f.name === '_modelos');
if (modelos) for (const f of await listar(modelos.id)) if (!emUso.has(f.id)) alvos.push({ ...f, motivo: 'versão antiga de modelo' });

// 3. Propostas de teste na pasta do cliente (mantém a vigente).
for (const pasta of raiz.filter((f) => ehPasta(f) && !PROTEGIDAS.includes(f.name) && f.name !== '_modelos')) {
    for (const f of await listar(pasta.id)) if (f.id !== vinculada) alvos.push({ ...f, motivo: `proposta de teste (${pasta.name})` });
}

const porMotivo = alvos.reduce((m, a) => ({ ...m, [a.motivo.replace(/ \(.*/, '')]: (m[a.motivo.replace(/ \(.*/, '')] || 0) + 1 }), {});
console.log(APPLY ? '>>> APAGANDO\n' : '>>> SIMULAÇÃO — use --apply para valer\n');
for (const [motivo, n] of Object.entries(porMotivo)) console.log(`  ${String(n).padStart(4)}  ${motivo}`);
console.log(`  ${String(alvos.length).padStart(4)}  TOTAL`);
console.log(`\nintocados: ${emUso.size} modelos da config${vinculada ? ', a proposta vigente do card' : ''}, ${PROTEGIDAS.join(' e ')}`);

if (APPLY) {
    let n = 0, jaForam = 0, falhas = 0;
    for (const f of alvos) {
        try {
            // Lixeira, não remoção definitiva: a service account não tem
            // canDelete neste Drive Compartilhado (o Drive responde 404, não
            // 403), e mandar pra lixeira ainda deixa 30 dias pra recuperar —
            // que é o que faltou quando apaguei arquivos sem querer antes.
            await api(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
            });
            n++;
        } catch (err) {
            // 404 aqui é arquivo que já sumiu (duplicado na lista, ou removido
            // no meio da varredura) — não é motivo pra abortar a faxina.
            if (/HTTP 404/.test(err.message)) { jaForam++; continue; }
            falhas++;
            console.log(`   ❌ ${f.name}: ${err.message.slice(0, 60)}`);
        }
    }
    console.log(`\n${n} removido(s)${jaForam ? ` · ${jaForam} já não existia(m)` : ''}${falhas ? ` · ${falhas} falha(s)` : ''}`);
    console.log('\nestado final:');
    for (const f of await listar(ROOT)) {
        if (ehPasta(f)) console.log(`  📁 ${f.name.padEnd(30)} ${(await listar(f.id)).length}`);
        else console.log(`  ⚠️ solto: ${f.name}`);
    }
}
