/**
 * Move os arquivos soltos na raiz da pasta de saída pra uma subpasta de
 * arquivo morto.
 *
 * A automação passou a salvar cada proposta na pasta do cliente, mas o que foi
 * gerado durante o piloto ficou empilhado na raiz (37 propostas do card de
 * teste + um "Cópia de Modelos" perdido). Isso limpa a raiz sem apagar nada —
 * depois dele, a raiz só tem pasta de cliente.
 *
 * Só mexe em ARQUIVO na raiz; subpastas (os clientes) não são tocadas.
 *
 * Uso:
 *   node scripts/archive-loose-files.js                    # simulação
 *   node scripts/archive-loose-files.js --apply
 *   node scripts/archive-loose-files.js --dest="_outra"    # outra pasta destino
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const DEST = (process.argv.find((a) => a.startsWith('--dest=')) || '').split('=')[1] || '_testes-piloto';
const FOLDER = process.env.PROPOSAL_OUTPUT_FOLDER_ID;
const FOLDER_MIME = 'application/vnd.google-apps.folder';

if (!FOLDER) { console.error('PROPOSAL_OUTPUT_FOLDER_ID não configurada'); process.exit(1); }

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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}

async function listChildren(parentId) {
    const out = [];
    let pageToken;
    do {
        const u = new URL('https://www.googleapis.com/drive/v3/files');
        u.searchParams.set('q', `'${parentId}' in parents and trashed = false`);
        u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
        u.searchParams.set('pageSize', '1000');
        u.searchParams.set('supportsAllDrives', 'true');
        u.searchParams.set('includeItemsFromAllDrives', 'true');
        if (pageToken) u.searchParams.set('pageToken', pageToken);
        const body = await api(u.toString());
        out.push(...(body.files || []));
        pageToken = body.nextPageToken;
    } while (pageToken);
    return out;
}

const children = await listChildren(FOLDER);
const loose = children.filter((f) => f.mimeType !== FOLDER_MIME);
const folders = children.filter((f) => f.mimeType === FOLDER_MIME);

console.log(APPLY ? `>>> APLICANDO — movendo para "${DEST}"\n` : `>>> SIMULAÇÃO (nada é movido) — use --apply para valer\n`);
console.log(`raiz: ${folders.length} subpasta(s), ${loose.length} arquivo(s) solto(s)\n`);

if (!loose.length) {
    console.log('Nada a fazer — a raiz já está limpa.');
    process.exit(0);
}

let destId = folders.find((f) => f.name === DEST)?.id || null;
if (APPLY && !destId) {
    const created = await api('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DEST, mimeType: FOLDER_MIME, parents: [FOLDER] }),
    });
    destId = created.id;
    console.log(`📁 pasta "${DEST}" criada\n`);
}

let moved = 0;
for (const f of loose) {
    if (!APPLY) { console.log(`   ${f.name}`); moved++; continue; }
    try {
        await api(`https://www.googleapis.com/drive/v3/files/${f.id}`
            + `?addParents=${destId}&removeParents=${FOLDER}&supportsAllDrives=true&fields=id`,
        { method: 'PATCH' });
        moved++;
        console.log(`✅ ${f.name}`);
    } catch (err) {
        console.log(`❌ ${f.name} — ${err.message}`);
    }
}

console.log(`\n${moved} arquivo(s) ${APPLY ? `movidos para "${DEST}"` : 'seriam movidos'}`);
