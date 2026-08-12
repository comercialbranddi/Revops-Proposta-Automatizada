/**
 * Cola as linhas do item na Proposta Comercial, como no modelo que o comercial
 * usa.
 *
 * O feedback de 12/08/2026 foi "na parte de preços faltou vir um embaixo do
 * outro, tá separado". A origem é o GD base, que tem o item assim:
 *
 *     1 - Proteção Fraude          em vez de     1 - Proteção Fraude
 *     (linha em branco)                          Proposta: {{PRECO_GD}}
 *     Proposta:                                  Plataformas: {{CANAIS_GD}}
 *     (linha em branco)
 *     {{PRECO_GD}}
 *
 * Como o monta-combos copia o texto do base, todo combo que inclui GD herdou a
 * quebra — por isso o item de Brand Bidding sai certo e o de Fraude não, no
 * mesmo documento.
 *
 * Faz duas coisas, e só dentro da seção comercial:
 *   1. junta o "Proposta:" que ficou sozinho com o valor da linha seguinte;
 *   2. remove linha em branco de DENTRO de um item — a que separa itens, e a
 *      que vem antes de "Condições Comerciais", ficam onde estão.
 *
 * Não altera texto: as palavras são as mesmas, mudam de parágrafo.
 *
 * Uso:
 *   node scripts/arruma-precos.js                 # simula, todos os modelos
 *   node scripts/arruma-precos.js --apply
 *   node scripts/arruma-precos.js --only=GD --idioma=en
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { templatesDoIdioma, secoesDoIdioma, textosDoIdioma } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando, avisoDeIdioma } from './_idioma.js';

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const IDIOMA = idiomaDaLinhaDeComando();
const S = secoesDoIdioma(IDIOMA);
const T = textosDoIdioma(IDIOMA);

const k = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: k.client_email, key: k.private_key, scopes: ['https://www.googleapis.com/auth/documents'] });
async function api(url, opts = {}) {
    const { token } = await gc.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}
const getDoc = (id) => api(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`);
const batch = (id, requests) => api(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
});

/** Parágrafos do corpo (fora de tabela — a seção comercial não tem caixas). */
function paragrafos(doc) {
    const tab = doc.tabs?.[0]?.documentTab || doc;
    return (tab.body.content || []).filter((el) => el.paragraph).map((el) => ({
        start: el.startIndex, end: el.endIndex,
        style: el.paragraph.paragraphStyle?.namedStyleType || '',
        txt: (el.paragraph.elements || []).map((e) => e.textRun?.content || '').join('').replace(/\n/g, ''),
    }));
}

// "Proposta:" / "Price:" / "Propuesta:" sozinho no parágrafo.
const soRotulo = (t) => t.trim() === T.precoLinha.trim();
const ehTituloItem = (p) => /^\d+\s*[-.]\s/.test(p.txt.trim());

async function arruma(chave, docId) {
    let doc = await getDoc(docId);
    const acoes = [];

    // Uma passada de planejamento sobre o estado atual. As edições são
    // aplicadas UMA POR VEZ com releitura: cada delete desloca todos os índices
    // seguintes, e uma batch planejada de uma vez só acerta o primeiro alvo.
    for (let volta = 0; volta < 20; volta++) {
        const paras = paragrafos(doc);
        const iCom = paras.findIndex((p) => S.comercial.test(p.txt));
        if (iCom < 0) break;

        let alvo = null;
        for (let i = iCom; i < paras.length - 1; i++) {
            const p = paras[i], prox = paras[i + 1];

            // 1. Linha em branco dentro de um item: some. A que separa itens
            //    (seguida de título) e a de antes de "Condições Comerciais"
            //    (seguida de HEADING) ficam.
            if (!p.txt.trim() && prox.txt.trim() && !prox.style.startsWith('HEADING') && !ehTituloItem(prox)) {
                alvo = { tipo: 'vazio', del: [p.start, p.end], desc: `linha em branco antes de "${prox.txt.slice(0, 30)}"` };
                break;
            }
            // 2. "Proposta:" sozinho: junta com o próximo parágrafo com texto.
            if (soRotulo(p.txt)) {
                let j = i + 1;
                while (j < paras.length && !paras[j].txt.trim()) j++;
                if (j >= paras.length) break;
                // Apaga do fim do texto de "Proposta:" até o começo do valor —
                // leva junto a quebra de parágrafo e os vazios do meio.
                alvo = { tipo: 'junta', del: [p.end - 1, paras[j].start], insere: p.end - 1,
                    desc: `"${p.txt.trim()} ${paras[j].txt.slice(0, 28)}"` };
                break;
            }
        }
        if (!alvo) break;

        acoes.push(alvo.desc);
        if (!APPLY) {
            // Sem escrever não dá pra reler: simula o efeito no modelo em
            // memória pra achar o próximo alvo em vez de repetir o mesmo.
            const tab = doc.tabs?.[0]?.documentTab || doc;
            tab.body.content = tab.body.content.filter((el) => !(el.paragraph && el.startIndex === alvo.del[0] && alvo.tipo === 'vazio'));
            if (alvo.tipo === 'junta') {
                const idx = tab.body.content.findIndex((el) => el.paragraph && el.endIndex === alvo.del[0] + 1);
                if (idx >= 0) {
                    let j = idx + 1;
                    while (j < tab.body.content.length && !(tab.body.content[j].paragraph && (tab.body.content[j].paragraph.elements || []).map((e) => e.textRun?.content || '').join('').trim())) j++;
                    const valor = tab.body.content[j];
                    tab.body.content[idx].paragraph.elements.push(...(valor.paragraph.elements || []));
                    tab.body.content.splice(idx + 1, j - idx);
                }
            }
            continue;
        }

        await batch(docId, [{ deleteContentRange: { range: { startIndex: alvo.del[0], endIndex: alvo.del[1] } } }]);
        if (alvo.tipo === 'junta') {
            await batch(docId, [{ insertText: { location: { index: alvo.insere }, text: ' ' } }]);
        }
        doc = await getDoc(docId);
    }
    return acoes;
}

const MODELOS = templatesDoIdioma(IDIOMA);
console.log(avisoDeIdioma(IDIOMA, Object.keys(MODELOS).length));
let total = 0;
for (const [chave, { docId }] of Object.entries(MODELOS)) {
    if (ONLY && chave !== ONLY) continue;
    try {
        const acoes = await arruma(chave, docId);
        total += acoes.length;
        console.log(`${acoes.length ? (APPLY ? '✏️ ' : '  ') : '✅'} ${chave.padEnd(14)} ${acoes.length ? acoes.length + ' ajuste(s)' : 'já está colado'}`);
        for (const a of acoes) console.log(`      · ${a}`);
    } catch (err) {
        console.log(`❌ ${chave.padEnd(14)} ${err.message}`);
    }
}
console.log(APPLY ? `\n✅ ${total} ajuste(s) aplicados` : `\n[simulação] ${total} ajuste(s) — rode com --apply`);
