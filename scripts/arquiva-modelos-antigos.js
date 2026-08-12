/**
 * Move pra uma pasta de arquivo todo modelo que está em _modelos mas NÃO está
 * na config — ou seja, versão substituída por uma rodada do monta-combos.
 *
 * Por que acumula: o monta-combos não sobrescreve. Cada rodada cria documentos
 * novos e a config passa a apontar pra eles; os anteriores ficam na mesma pasta,
 * com o mesmo nome. Em 12/08/2026 havia 90 arquivos em _modelos pra 45 modelos
 * em uso, e oito arquivos chamados "MODELO BB+GD". Quem abre o Drive não tem
 * como saber qual a automação usa.
 *
 * Guardar em vez de apagar é decisão da Jessica: a versão anterior é a que o
 * comercial já tinha visto, e serve de referência pra comparar.
 *
 * O nome ganha a data de modificação no arquivamento — sem isso a pasta vira
 * onze nomes repetidos e não serve pra consultar, que é o motivo de existir.
 *
 * Uso:
 *   node scripts/arquiva-modelos-antigos.js
 *   node scripts/arquiva-modelos-antigos.js --apply
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { todosOsDocIds, PROPOSAL_TEMPLATES, SECOES_POR_IDIOMA } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
export const PASTA_ARQUIVO = 'Modelo Proposta Padronizado';

const k = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: k.client_email, key: k.private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
async function api(url, opts = {}) {
    const { token } = await gc.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.json();
}

// A pasta dos modelos é descoberta a partir de um modelo em uso, não fixada:
// assim o script continua certo se os modelos mudarem de lugar.
const umModelo = PROPOSAL_TEMPLATES.pt.BB.docId;
const pastaModelos = (await api(`https://www.googleapis.com/drive/v3/files/${umModelo}?fields=parents&supportsAllDrives=true`)).parents?.[0];
if (!pastaModelos) { console.error('não achei a pasta dos modelos'); process.exit(1); }

const listar = async () => {
    const q = `'${pastaModelos}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`;
    const r = await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`
        + '&fields=files(id,name,modifiedTime)&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true');
    return r.files || [];
};

const emUso = new Set(todosOsDocIds());
const todos = await listar();
const antigos = todos.filter((f) => !emUso.has(f.id));

console.log(`pasta de modelos: ${pastaModelos}`);
console.log(`${todos.length} documento(s) na pasta · ${emUso.size} em uso na config · ${antigos.length} a arquivar\n`);

if (!antigos.length) { console.log('✅ nada a arquivar — a pasta já tem só o que está em uso'); process.exit(0); }

const porNome = {};
for (const f of antigos) (porNome[f.name] ||= []).push(f);
for (const [nome, fs] of Object.entries(porNome).sort()) {
    console.log(`   ${String(fs.length).padStart(2)}× ${nome.padEnd(28)} ${fs.map((f) => f.modifiedTime.slice(0, 10)).sort().join(' ')}`);
}

if (!APPLY) { console.log(`\n[simulação] ${antigos.length} documento(s) seriam movidos pra "${PASTA_ARQUIVO}" — rode com --apply`); process.exit(0); }

const q = `'${pastaModelos}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${PASTA_ARQUIVO}' and trashed = false`;
const achou = await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
let destino = achou.files?.[0]?.id;
if (!destino) {
    destino = (await api('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: PASTA_ARQUIVO, mimeType: 'application/vnd.google-apps.folder', parents: [pastaModelos] }),
    })).id;
    console.log(`\n📁 pasta criada: ${PASTA_ARQUIVO}`);
}

/**
 * Idioma do documento, lido do próprio texto.
 *
 * Sem isto o arquivo fica com quatro "MODELO BB+GD" e não serve pra consultar,
 * que é o único motivo de guardar em vez de apagar. A data não separa: as
 * versões de uma mesma rodada têm todas o mesmo dia.
 */
async function idiomaDo(id) {
    const { token } = await gc.getAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return '??';
    const txt = await res.text();
    for (const [idi, s] of Object.entries(SECOES_POR_IDIOMA)) {
        if (txt.split('\n').some((l) => s.comercial.test(l.trim()))) return idi;
    }
    return '??';
}

let ok = 0, falhas = 0;
const usados = new Set();
for (const f of antigos) {
    try {
        const idi = await idiomaDo(f.id);
        let novoNome = `${f.name} [${idi}] (${f.modifiedTime.slice(0, 10)})`;
        // Duas versões do mesmo modelo, idioma e dia ainda colidiriam.
        for (let n = 2; usados.has(novoNome); n++) novoNome = `${f.name} [${idi}] (${f.modifiedTime.slice(0, 10)}) #${n}`;
        usados.add(novoNome);
        await api(`https://www.googleapis.com/drive/v3/files/${f.id}?addParents=${destino}&removeParents=${pastaModelos}&supportsAllDrives=true&fields=id`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: novoNome }),
        });
        console.log(`   ${novoNome}`);
        ok++;
    } catch (err) {
        console.log(`❌ ${f.name}: ${err.message.slice(0, 80)}`);
        falhas++;
    }
}

const restam = (await listar()).length;
console.log(`\n✅ ${ok} arquivado(s)${falhas ? `, ${falhas} falha(s)` : ''}`);
console.log(`   _modelos agora tem ${restam} documento(s) — deve bater com os ${emUso.size} em uso`);
console.log(`   https://drive.google.com/drive/folders/${destino}`);
