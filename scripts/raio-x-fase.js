/**
 * Raio-X da fase "Envio de proposta": o que aconteceria se a automação fosse
 * ligada pra todo mundo, sem escrever nada em lugar nenhum.
 *
 * A pergunta que ele responde é a que decide se dá pra ligar: dos cards que
 * estão parados na fase AGORA, quantos geram proposta limpa, quantos só
 * receberiam nota de "falta preencher" e quantos não têm modelo. Ligar sem
 * saber isso pode encher dezenas de cards de cliente com nota de cobrança de
 * campo no mesmo minuto.
 *
 * Uso:
 *   node scripts/raio-x-fase.js
 *   node scripts/raio-x-fase.js --lista    # mostra card a card
 */
import 'dotenv/config';
import {
    SALES_PIPELINE_ID, ENVIO_PROPOSTA_STAGE_ID, PROPOSAL_DEAL_FIELDS as F,
    PRODUCT_PRICE_FIELDS as P, PRICED_PRODUCTS, CATALOGO_BBP_FIELD, PALAVRAS_BB_FIELD,
    PLATAFORMAS_VM_FIELD, parseServicoOferecido, getProductByPrincipalOptionId,
    PRODUCT_CASCADE_ORDER, resolveTemplate, idiomaDoDeal, bbSoAppStore,
    SERVICO_QUE_VIROU_CANAL, IDIOMA_LABEL,
} from '../src/config/proposal.js';

const LISTA = process.argv.includes('--lista');
const T = process.env.PIPEDRIVE_API_TOKEN;
const pd = async (p) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`)).json());

// Só negócio ABERTO: ganho e perdido não recebem proposta nova.
const deals = [];
for (let start = 0; ; ) {
    const r = await pd(`/deals?stage_id=${ENVIO_PROPOSTA_STAGE_ID}&status=open&limit=500&start=${start}`);
    for (const d of r.data || []) if (d.pipeline_id === SALES_PIPELINE_ID) deals.push(d);
    if (!r.additional_data?.pagination?.more_items_in_collection) break;
    start = r.additional_data.pagination.next_start;
}

const preenchido = (v) => v != null && v !== '' && Number(v) > 0;

const balde = { jaTem: [], geraria: [], faltaCampo: [], semModelo: [], semProduto: [] };
for (const d of deals) {
    const idioma = idiomaDoDeal(d);
    const { codes, semTemplate, idsSemTemplate } = parseServicoOferecido(d[F.SERVICO_OFERECIDO]);
    let productCodes = PRODUCT_CASCADE_ORDER.filter((c) => codes.includes(c));
    let origem = 'servico';
    if (!productCodes.length && !semTemplate.length) {
        const principal = getProductByPrincipalOptionId(d[F.PRODUTO_PRINCIPAL]);
        if (principal) { productCodes = [principal.code]; origem = 'principal'; }
    }
    const info = { id: d.id, org: d.org_name || '(sem organização)', idioma, chave: productCodes.join('+'), origem, semTemplate };

    if (d[F.LINK_PROPOSTA]) { balde.jaTem.push(info); continue; }
    if (!productCodes.length) {
        (semTemplate.length ? balde.semModelo : balde.semProduto).push(info);
        continue;
    }
    if (!resolveTemplate(idioma, info.chave)) { balde.semModelo.push({ ...info, motivo: `sem modelo ${info.chave} em ${IDIOMA_LABEL[idioma]}` }); continue; }

    const falta = [];
    if (!(d.org_name || d.org_id?.name)) falta.push('Organização');
    for (const c of productCodes.filter((x) => PRICED_PRODUCTS.includes(x))) {
        if (!preenchido(d[P[c]])) falta.push(`Preço ${c}`);
    }
    if (productCodes.includes('BBP') && !preenchido(d[CATALOGO_BBP_FIELD])) falta.push('Catálogo BBP');
    if (productCodes.includes('BB') && !bbSoAppStore(d) && !preenchido(d[PALAVRAS_BB_FIELD])) falta.push('Palavras-chave BB');
    if (productCodes.includes('VM') && !preenchido(d[PLATAFORMAS_VM_FIELD])) falta.push('Plataformas VM');

    if (falta.length) balde.faltaCampo.push({ ...info, falta });
    else balde.geraria.push(info);
}

const n = deals.length;
const pct = (x) => (n ? `${Math.round((x / n) * 100)}%` : '0%');
console.log(`\nFunil ${SALES_PIPELINE_ID}, fase ${ENVIO_PROPOSTA_STAGE_ID} — ${n} negócio(s) ABERTO(s)\n`);
console.log(`  já tem Link Proposta (seriam ignorados)  ${String(balde.jaTem.length).padStart(4)}  ${pct(balde.jaTem.length)}`);
console.log(`  gerariam proposta agora                  ${String(balde.geraria.length).padStart(4)}  ${pct(balde.geraria.length)}`);
console.log(`  só receberiam nota de "falta preencher"  ${String(balde.faltaCampo.length).padStart(4)}  ${pct(balde.faltaCampo.length)}`);
console.log(`  sem modelo pra combinação                ${String(balde.semModelo.length).padStart(4)}  ${pct(balde.semModelo.length)}`);
console.log(`  sem produto identificável                ${String(balde.semProduto.length).padStart(4)}  ${pct(balde.semProduto.length)}`);

const porChave = {};
for (const i of balde.geraria) porChave[`${i.chave} (${i.idioma})`] = (porChave[`${i.chave} (${i.idioma})`] || 0) + 1;
if (Object.keys(porChave).length) {
    console.log('\nmodelos que sairiam:');
    for (const [k, v] of Object.entries(porChave).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}× ${k}`);
}

const porFalta = {};
for (const i of balde.faltaCampo) for (const f of i.falta) porFalta[f] = (porFalta[f] || 0) + 1;
if (Object.keys(porFalta).length) {
    console.log('\ncampos que faltam (um card pode faltar mais de um):');
    for (const [k, v] of Object.entries(porFalta).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}× ${k}`);
}

const doPrincipal = balde.geraria.filter((i) => i.origem === 'principal').length;
if (doPrincipal) console.log(`\n⚠️  ${doPrincipal} card(s) teriam o produto DEDUZIDO do "Produto Principal" — "Serviço oferecido" vazio.`);
const comCanal = balde.geraria.concat(balde.faltaCampo).filter((i) => i.semTemplate?.some((r) => Object.values(SERVICO_QUE_VIROU_CANAL).some((v) => v.canal.startsWith(r) || r === 'APP' || r === 'Bing'))).length;
if (comCanal) console.log(`⚠️  ${comCanal} card(s) têm serviço que virou canal marcado em "Serviço oferecido".`);

if (LISTA) {
    for (const [nome, itens] of Object.entries(balde)) {
        if (!itens.length) continue;
        console.log(`\n── ${nome} (${itens.length})`);
        for (const i of itens) console.log(`   #${i.id.toString().padEnd(6)} ${String(i.chave || '—').padEnd(14)} ${i.idioma}  ${i.org.slice(0, 40).padEnd(42)}${i.falta ? 'falta: ' + i.falta.join(', ') : (i.motivo || '')}`);
    }
}
console.log('');
