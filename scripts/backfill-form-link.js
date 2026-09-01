/**
 * Preenche o campo "FORM_PROPOSTA" (link do formulário) em TODO card aberto do
 * pipe de vendas, não só nos que já passaram por "Proposta enviada".
 *
 * Por que precisa existir: hoje o campo só é escrito por
 * `proposal-form-note.js`, na ENTRADA da etapa "Proposta enviada" — pedido da
 * Jessica em 25/08/2026. Card que nunca (re)entrou nessa etapa depois disso
 * nunca recebeu o link, e o closer que quer montar a proposta de um card
 * antigo não tem de onde tirar o ID pra montar a URL na mão (ver conversa de
 * 01/09/2026). Isto é uma varredura de UMA VEZ para os cards já abertos —
 * cards novos continuam recebendo o campo pelo caminho normal quando
 * entrarem em "Proposta enviada".
 *
 * O link é derivado só do ID do card (`formUrlDoDeal`) — não depende de
 * nenhum outro campo estar preenchido, então roda em QUALQUER card aberto do
 * pipe de vendas, em qualquer etapa.
 *
 * Uso:
 *   node scripts/backfill-form-link.js            # mostra o que escreveria
 *   node scripts/backfill-form-link.js --apply
 */
import 'dotenv/config';
import { SALES_PIPELINE_ID, PROPOSAL_DEAL_FIELDS as F, formUrlDoDeal } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const T = process.env.PIPEDRIVE_API_TOKEN;
const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());

// O filtro pipeline_id da API é ignorado (responde 200 e devolve a base
// inteira) — confirmado em uso anterior deste mesmo endpoint. Filtra no
// cliente, como os outros scripts da casa já fazem.
const deals = [];
for (let start = 0; ; ) {
    const r = await pd(`/deals?status=open&limit=500&start=${start}`);
    for (const d of r.data || []) if (d.pipeline_id === SALES_PIPELINE_ID) deals.push(d);
    if (!r.additional_data?.pagination?.more_items_in_collection) break;
    start = r.additional_data.pagination.next_start;
}

const faltando = deals.filter((d) => !d[F.FORM_PROPOSTA]);

console.log(`\n${deals.length} negócio(s) aberto(s) no pipe de vendas — ${faltando.length} sem o campo do link\n`);

let escritos = 0, falhados = 0;
for (const d of faltando) {
    const url = formUrlDoDeal(d.id);
    console.log(`${APPLY ? '✏️ ' : '  '} #${d.id} ${d.org_name || '(sem organização)'} (${d.owner_name || '—'}) → ${url}`);
    if (APPLY) {
        const r = await pd(`/deals/${d.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [F.FORM_PROPOSTA]: url }),
        });
        if (r.success) escritos++;
        else { falhados++; console.log(`      ⚠️  falhou: ${JSON.stringify(r.error || r).slice(0, 120)}`); }
    }
}

console.log(APPLY
    ? `\n✅ ${escritos} campo(s) escrito(s), ${falhados} falha(s)`
    : `\n[simulação] ${faltando.length} campo(s) seriam escritos — rode com --apply`);
