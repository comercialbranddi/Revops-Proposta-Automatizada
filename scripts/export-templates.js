/**
 * Exporta todos os modelos de PROPOSAL_TEMPLATES pra validação de conteúdo
 * fora do Drive (revisão com Sérgio/DT/Miriam).
 *
 * Não toca em nada de produção — só lê os docs.
 *
 * Uso:
 *   vercel env pull .env      # traz GOOGLE_PROPOSAL_SA_KEY_BASE64
 *   node scripts/export-templates.js                 # .txt em modelos-export/
 *   node scripts/export-templates.js --format=docx   # .docx em modelos-export/docx/
 *   node scripts/export-templates.js --format=pdf    # .pdf  em modelos-export/pdf/
 *   node scripts/export-templates.js --idioma=en     # .txt em modelos-export/en/
 *
 * txt serve pra diff/grep (perde formatação); docx e pdf mostram o documento
 * como o cliente recebe.
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma, IDIOMA_PADRAO } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const FORMATS = {
    txt:  { mime: 'text/plain', subdir: '' },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', subdir: 'docx/' },
    pdf:  { mime: 'application/pdf', subdir: 'pdf/' },
};

const formatArg = (process.argv.find(a => a.startsWith('--format=')) || '').split('=')[1] || 'txt';
const format = FORMATS[formatArg];
if (!format) {
    console.error(`Formato inválido: ${formatArg}. Use: ${Object.keys(FORMATS).join(', ')}`);
    process.exit(1);
}

const IDIOMA = idiomaDaLinhaDeComando();
const MODELOS = templatesDoIdioma(IDIOMA);

// Português exporta na raiz de modelos-export/, como sempre — os outros idiomas
// ganham subpasta própria pra não sobrescrever o export do PT, que é a
// referência de comparação.
const subIdioma = IDIOMA === IDIOMA_PADRAO ? '' : `${IDIOMA}/`;
const OUT_DIR = new URL(`../modelos-export/${subIdioma}${format.subdir}`, import.meta.url);

function getClient() {
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) {
        console.error('GOOGLE_PROPOSAL_SA_KEY_BASE64 não configurada — rode `vercel env pull .env` primeiro.');
        process.exit(1);
    }
    const key = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return new JWT({
        email: key.client_email,
        key: key.private_key,
        // Só leitura: este script nunca escreve no Drive.
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
}

/** Exporta o Doc no mimeType pedido. supportsAllDrives por causa do Drive Compartilhado. */
async function exportDoc(client, docId, mimeType) {
    const { token } = await client.getAccessToken();
    const url = `https://www.googleapis.com/drive/v3/files/${docId}/export`
        + `?mimeType=${encodeURIComponent(mimeType)}&supportsAllDrives=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

const client = getClient();
await mkdir(OUT_DIR, { recursive: true });
console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));

for (const [key, { docId, label }] of Object.entries(MODELOS)) {
    try {
        const buf = await exportDoc(client, docId, format.mime);
        await writeFile(new URL(`${key}.${formatArg}`, OUT_DIR), buf);
        console.log(`✅ ${key.padEnd(14)} ${String(buf.length).padStart(7)} bytes  ${label}`);
        if (formatArg === 'txt') {
            // Só o texto puro permite conferir quais placeholders o modelo usa.
            const placeholders = [...new Set(buf.toString('utf-8').match(/\{\{[A-Z_]+\}\}/g) || [])];
            console.log(`   placeholders: ${placeholders.length ? placeholders.join(', ') : '(nenhum)'}`);
        }
    } catch (err) {
        console.log(`❌ ${key.padEnd(14)} ${err.message}`);
    }
}

console.log(`\nSaída em modelos-export/${format.subdir}`);
