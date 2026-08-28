/**
 * Esconde do card os campos que só o fluxo ANTIGO usa.
 *
 * A proposta passou a ser montada pelo formulário (/proposta/<id>), que lê do
 * card apenas "Serviço oferecido" e a identidade do negócio. Preço, canal,
 * catálogo, plataformas, faixas e valor de pacote seguem no card só porque o
 * gerador de Google Docs os lê — e ninguém mais preenche isso à mão.
 *
 * "Idioma da proposta" entrou junto em 27/08/2026, por decisão da Jessica. Ele
 * era a exceção: a rota do formulário o lê pra pré-selecionar o idioma. Só que
 * o formulário TEM o seu próprio seletor de idioma, então o campo no card só
 * adiantava um clique — e um clique não paga um campo a mais na tela de quem
 * não usa mais o fluxo antigo.
 *
 * Esconder não fecha a porta: o Pipedrive esconde da TELA, não da API. Os
 * cards que já têm idioma gravado continuam abrindo o formulário nele; os
 * novos abrem em português e o closer escolhe no próprio formulário.
 *
 * ESCONDER NÃO APAGA. O valor continua gravado e volta a aparecer com
 * --mostrar. O mecanismo é o mesmo que deixou quatro campos invisíveis por
 * engano em 27/08: restrição ligada com lista de funis VAZIA.
 *
 * Uso:
 *   node scripts/oculta-campos-fluxo-antigo.js
 *   node scripts/oculta-campos-fluxo-antigo.js --apply
 *   node scripts/oculta-campos-fluxo-antigo.js --mostrar --apply   # desfaz
 */
import 'dotenv/config';
import {
    PRODUCT_PRICE_FIELDS as P, CANAIS_FIELDS as C, CATALOGO_BBP_FIELD, PALAVRAS_BB_FIELD,
    PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, FAIXAS_BB_FIELDS, FAIXAS_BBP_FIELDS,
    SOB_CONSULTA_BBP_FIELD, IDIOMA_FIELD,
} from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const MOSTRAR = process.argv.includes('--mostrar');
const T = process.env.PIPEDRIVE_API_TOKEN;

const api = async (p, o) => {
    const r = await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o?.headers || {}) } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || b.success === false) throw new Error(`${o?.method || 'GET'} ${p} → ${r.status}: ${JSON.stringify(b).slice(0, 160)}`);
    return b.data;
};

const CHAVES = [
    ...Object.values(P), ...Object.values(C),
    CATALOGO_BBP_FIELD, PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD,
    IDIOMA_FIELD,
    ...FAIXAS_BB_FIELDS.flatMap((f) => [f.qtd, f.preco]),
    ...(FAIXAS_BBP_FIELDS || []).flatMap((f) => [f.qtd, f.preco]),
    SOB_CONSULTA_BBP_FIELD,
].filter(Boolean);

const campos = await api('/dealFields?limit=500');
const alvos = CHAVES.map((k) => campos.find((c) => c.key === k)).filter(Boolean);
const escondido = (c) => c.show_in_pipelines?.show_in_all === false && !(c.show_in_pipelines.pipeline_ids || []).length;

console.log(`${alvos.length} campo(s) do fluxo antigo — ${MOSTRAR ? 'voltando a aparecer' : 'escondendo'}\n`);
let n = 0;
for (const c of alvos) {
    const jaEsta = MOSTRAR ? !escondido(c) : escondido(c);
    if (jaEsta) { console.log(`   ${c.name.padEnd(36)} já está assim`); continue; }
    n++;
    if (!APPLY) { console.log(`   ${c.name.padEnd(36)} ${MOSTRAR ? 'voltaria' : 'sumiria do card'}`); continue; }
    await api(`/dealFields/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ show_in_pipelines: MOSTRAR ? { show_in_all: true, pipeline_ids: [] } : { show_in_all: false, pipeline_ids: [] } }),
    });
    console.log(`✏️  ${c.name.padEnd(36)} ${MOSTRAR ? 'aparece de novo' : 'escondido'}`);
}
console.log(APPLY ? `\n✅ ${n} campo(s) alterado(s)` : `\n[simulação] ${n} campo(s) — rode com --apply`);
console.log('O dado gravado NÃO é apagado; --mostrar traz tudo de volta.');
