/**
 * Impede que a quebra de página parta um bloco da Proposta Comercial no meio.
 *
 * O que o comercial viu em 13/08/2026: o item do combo terminava numa página
 * com "Por: R$ 15.000/mês" e a linha "Plataformas: …" começava a página
 * seguinte, sozinha, acima de "Condições Comerciais". O leitor perde o vínculo
 * entre o preço e o que ele cobre.
 *
 * A correção é `keepWithNext`, do próprio Google Docs: o parágrafo se recusa a
 * ficar separado do seguinte. Aplicado onde uma linha em branco NÃO separa os
 * dois — ou seja, dentro do bloco. As linhas em branco entre itens continuam
 * sendo pontos de quebra válidos, senão a seção inteira viraria um bloco só e
 * seria empurrada pra próxima página, deixando um vão enorme.
 *
 * Também vale pro título: heading no rodapé da página, com o conteúdo na
 * página seguinte, é a mesma quebra errada.
 *
 * Uso:
 *   node scripts/arruma-quebra-pagina.js
 *   node scripts/arruma-quebra-pagina.js --apply
 *   node scripts/arruma-quebra-pagina.js --idioma=en --apply
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma, secoesDoIdioma } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const APPLY = process.argv.includes('--apply');
const IDIOMA = idiomaDaLinhaDeComando();
const S = secoesDoIdioma(IDIOMA);

const k = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: k.client_email, key: k.private_key, scopes: ['https://www.googleapis.com/auth/documents'] });
async function api(url, opts = {}) {
    const { token } = await gc.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.json();
}

async function arruma(chave, docId) {
    const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`);
    const tab = doc.tabs?.[0]?.documentTab || doc;
    const paras = (tab.body.content || []).filter((el) => el.paragraph).map((el) => ({
        start: el.startIndex, end: el.endIndex,
        txt: (el.paragraph.elements || []).map((e) => e.textRun?.content || '').join('').replace(/\n/g, ''),
        style: el.paragraph.paragraphStyle?.namedStyleType || '',
        jaTem: el.paragraph.paragraphStyle?.keepWithNext === true,
    }));

    const iCom = paras.findIndex((p) => S.comercial.test(p.txt));
    if (iCom < 0) return { alvos: 0, motivo: 'sem seção comercial' };

    const requests = [];
    for (let i = iCom; i < paras.length - 1; i++) {
        const p = paras[i], prox = paras[i + 1];
        // Só cola o que já está junto: parágrafo com texto seguido de outro com
        // texto. Linha em branco no meio significa "aqui pode quebrar".
        const colar = p.txt.trim() && prox.txt.trim();
        if (!colar || p.jaTem) continue;
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: p.start, endIndex: p.end },
                paragraphStyle: { keepWithNext: true },
                fields: 'keepWithNext',
            },
        });
    }
    if (!requests.length) return { alvos: 0, motivo: 'já está colado' };
    if (APPLY) {
        for (let i = 0; i < requests.length; i += 40) {
            await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: requests.slice(i, i + 40) }),
            });
        }
    }
    return { alvos: requests.length };
}

const MODELOS = templatesDoIdioma(IDIOMA);
console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));
let total = 0;
for (const [chave, { docId }] of Object.entries(MODELOS)) {
    try {
        const r = await arruma(chave, docId);
        total += r.alvos;
        console.log(`${r.alvos ? (APPLY ? '✏️ ' : '  ') : '✅'} ${chave.padEnd(14)} ${r.alvos ? `${r.alvos} parágrafo(s)` : r.motivo}`);
    } catch (err) {
        console.log(`❌ ${chave.padEnd(14)} ${err.message.slice(0, 90)}`);
    }
}
console.log(APPLY ? `\n✅ ${total} parágrafo(s) marcados` : `\n[simulação] ${total} parágrafo(s) — rode com --apply`);
