/**
 * Avisa, uma única vez, os cards que estão parados na fase "Envio de proposta"
 * sem que nada vá acontecer com eles.
 *
 * Por que precisa existir: a automação reage a EVENTO. As notas explicativas
 * ("falta preencher X", "não consegui identificar o produto") só saem na
 * ENTRADA na fase. Quem já estava lá quando a automação foi ligada nunca recebe
 * evento de entrada — o card fica parado, em silêncio, e o closer não tem como
 * saber que existe uma automação esperando um campo dele.
 *
 * Isto é uma varredura de UMA VEZ, não um processo. Depois dela, todo card novo
 * é avisado pelo caminho normal.
 *
 * O que NÃO faz: não gera proposta e não toca em card que já tem "Link
 * Proposta". Só escreve nota.
 *
 * Uso:
 *   node scripts/avisa-cards-parados.js            # mostra as notas que postaria
 *   node scripts/avisa-cards-parados.js --apply
 */
import 'dotenv/config';
import {
    SALES_PIPELINE_ID, ENVIO_PROPOSTA_STAGE_ID, PROPOSAL_DEAL_FIELDS as F,
    PRODUCT_PRICE_FIELDS as P, PRICED_PRODUCTS, CATALOGO_BBP_FIELD, PALAVRAS_BB_FIELD,
    PLATAFORMAS_VM_FIELD, parseServicoOferecido, getProductByPrincipalOptionId,
    PRODUCT_CASCADE_ORDER, resolveTemplate, idiomaDoDeal, bbSoAppStore,
} from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const T = process.env.PIPEDRIVE_API_TOKEN;
const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
const preenchido = (v) => v != null && v !== '' && Number(v) > 0;

const deals = [];
for (let start = 0; ; ) {
    const r = await pd(`/deals?stage_id=${ENVIO_PROPOSTA_STAGE_ID}&status=open&limit=500&start=${start}`);
    for (const d of r.data || []) if (d.pipeline_id === SALES_PIPELINE_ID) deals.push(d);
    if (!r.additional_data?.pagination?.more_items_in_collection) break;
    start = r.additional_data.pagination.next_start;
}

// A automação já foi ligada e já postou nota neste card? Então não repete. Sem
// esta checagem, rodar o script duas vezes duplica o aviso em card de cliente.
async function jaAvisado(dealId) {
    const notas = (await pd(`/notes?deal_id=${dealId}&limit=30&sort=${encodeURIComponent('add_time DESC')}`)).data || [];
    return notas.some((n) => /Proposta (não gerada|NÃO gerada|gerada automaticamente)/i.test(String(n.content).replace(/<[^>]*>/g, '')));
}

const planejadas = [];
for (const d of deals) {
    if (d[F.LINK_PROPOSTA]) continue;      // já tem proposta — não é assunto nosso

    const idioma = idiomaDoDeal(d);
    const { codes, semTemplate } = parseServicoOferecido(d[F.SERVICO_OFERECIDO]);
    let productCodes = PRODUCT_CASCADE_ORDER.filter((c) => codes.includes(c));
    if (!productCodes.length && !semTemplate.length) {
        const principal = getProductByPrincipalOptionId(d[F.PRODUTO_PRINCIPAL]);
        if (principal) productCodes = [principal.code];
    }

    let corpo = null;
    if (!productCodes.length) {
        corpo = [
            'Este card está em "Envio de proposta" mas a proposta não foi gerada: não consegui identificar o produto vendido.',
            '',
            'O que fazer:',
            '• preencha "Serviço oferecido" com o que foi vendido',
            '• confira Preço de cada produto, e Palavras-chave / Catálogo / Plataformas conforme o caso',
            '',
            'Assim que preencher, a proposta é gerada sozinha — não precisa mover o card.',
        ].join('\n');
    } else if (!resolveTemplate(idioma, productCodes.join('+'))) {
        corpo = `Este card está em "Envio de proposta" mas não existe modelo automatizado para ${productCodes.join(' + ')} no idioma pedido. Monte a proposta manualmente e avise o RevOps.`;
    } else {
        const falta = [];
        if (!(d.org_name || d.org_id?.name)) falta.push('Organização do negócio');
        for (const c of productCodes.filter((x) => PRICED_PRODUCTS.includes(x))) if (!preenchido(d[P[c]])) falta.push(`Preço ${c}`);
        if (productCodes.includes('BBP') && !preenchido(d[CATALOGO_BBP_FIELD])) falta.push('Catálogo BBP (SKUs)');
        if (productCodes.includes('BB') && !bbSoAppStore(d) && !preenchido(d[PALAVRAS_BB_FIELD])) falta.push('Palavras-chave BB (qtd)');
        if (productCodes.includes('VM') && !preenchido(d[PLATAFORMAS_VM_FIELD])) falta.push('Plataformas VM (qtd)');
        if (!falta.length) continue;       // geraria sozinho — nada a avisar
        corpo = [
            `Este card está em "Envio de proposta" mas a proposta (${productCodes.join(' + ')}) não foi gerada: falta preencher ${falta.join(', ')}.`,
            '',
            'Assim que preencher, a proposta é gerada sozinha — não precisa mover o card.',
        ].join('\n');
    }

    planejadas.push({ id: d.id, org: d.org_name || '(sem organização)', dono: d.owner_name, corpo });
}

console.log(`\n${deals.length} negócio(s) aberto(s) na fase — ${planejadas.length} receberia(m) aviso\n`);
let postadas = 0, puladas = 0;
for (const n of planejadas) {
    if (await jaAvisado(n.id)) { puladas++; console.log(`— #${n.id} ${n.org} — já tem nota da automação, pulando`); continue; }
    console.log(`${APPLY ? '✏️ ' : '  '} #${n.id} ${n.org} (${n.dono})`);
    for (const l of n.corpo.split('\n')) console.log(`      ${l}`);
    console.log('');
    if (APPLY) {
        const r = await pd('/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: n.id, content: n.corpo }) });
        if (r.success) postadas++;
        else console.log(`      ⚠️  falhou: ${JSON.stringify(r.error || r).slice(0, 120)}`);
    }
}
console.log(APPLY
    ? `\n✅ ${postadas} nota(s) postada(s), ${puladas} pulada(s)`
    : `\n[simulação] ${planejadas.length - puladas} nota(s) seriam postadas — rode com --apply`);
