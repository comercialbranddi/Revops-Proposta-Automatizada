/**
 * Cria o campo "Formulário da proposta" no Pipedrive e o preenche.
 *
 * O link do formulário (/proposta/<id do card>) só existia como NOTA na
 * timeline, postada na entrada da etapa. Nota some no meio das outras — quem
 * volta ao card dias depois rola atrás dela. Como campo, fica sempre no mesmo
 * lugar, ao lado do "Link Proposta".
 *
 * O link é derivado do id do card, então não precisa esperar geração nenhuma:
 * dá pra preencher todo card que já está na etapa, de uma vez.
 *
 * Nasce no grupo "Proposta" e restrito ao funil de Vendas, como os outros —
 * ver grupo-proposta.js pro porquê.
 *
 * Uso:
 *   node scripts/campo-form-link.js              # simula
 *   node scripts/campo-form-link.js --apply      # cria o campo
 *   node scripts/campo-form-link.js --preencher --apply   # e preenche os cards da etapa
 */
import 'dotenv/config';
import {
    SALES_PIPELINE_ID, ETAPAS_COM_LINK_FORM, PALAVRAS_BB_FIELD,
    formUrlDoDeal, PROPOSAL_DEAL_FIELDS,
} from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const PREENCHER = process.argv.includes('--preencher');
const NOME = 'Formulário da proposta';
const T = process.env.PIPEDRIVE_API_TOKEN;

const api = async (p, o) => {
    const sep = p.includes('?') ? '&' : '?';
    const r = await fetch(`https://api.pipedrive.com/v1${p}${sep}api_token=${T}`, {
        ...o, headers: { 'Content-Type': 'application/json', ...(o?.headers || {}) },
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || b.success === false) throw new Error(`${o?.method || 'GET'} ${p} → ${r.status}: ${JSON.stringify(b).slice(0, 200)}`);
    return b.data;
};

const campos = await api('/dealFields?limit=500');
const molde = campos.find((c) => c.key === PALAVRAS_BB_FIELD);   // pega grupo e funil dos irmãos
let campo = campos.find((c) => c.name === NOME);

if (campo) {
    console.log(`✅ "${NOME}" já existe — ${campo.key}`);
} else if (!APPLY) {
    console.log(`[simulação] criaria "${NOME}" (varchar, grupo ${molde.group_id})`);
} else {
    campo = await api('/dealFields', {
        method: 'POST',
        // varchar e não `text`: é uma URL curta, e varchar aparece em lista e
        // filtro; `text` vira caixa grande e some do resumo do card.
        body: JSON.stringify({ name: NOME, field_type: 'varchar', group_id: molde.group_id }),
    });
    await api(`/dealFields/${campo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ show_in_pipelines: { show_in_all: false, pipeline_ids: [SALES_PIPELINE_ID] } }),
    });
    console.log(`✏️  criado "${NOME}" — ${campo.key}`);
    console.log(`\ncole em PROPOSAL_DEAL_FIELDS (src/config/proposal.js):`);
    console.log(`    FORM_PROPOSTA: '${campo.key}',`);
}

if (!PREENCHER || !campo) process.exit(0);

// Todo card ABERTO na etapa. O link é o mesmo sempre, então reescrever é
// inofensivo — mas pular quem já tem evita 300 escritas à toa.
// As duas etapas que entregam o link — quem já está em "Proposta enviada"
// também precisa dele, e é justamente quem nunca passou pela 257.
const deals = [];
for (const etapa of ETAPAS_COM_LINK_FORM) {
    for (let start = 0; ; ) {
        const r = await fetch(`https://api.pipedrive.com/v1/deals?stage_id=${etapa}&status=open&limit=500&start=${start}&api_token=${T}`);
        const b = await r.json();
        for (const d of b.data || []) if (d.pipeline_id === SALES_PIPELINE_ID) deals.push(d);
        if (!b.additional_data?.pagination?.more_items_in_collection) break;
        start = b.additional_data.pagination.next_start;
    }
}
const faltando = deals.filter((d) => !d[campo.key]);
console.log(`\n${deals.length} negócio(s) aberto(s) na etapa · ${faltando.length} sem o link`);
if (!APPLY) { console.log('[simulação] rode com --apply'); process.exit(0); }

let ok = 0;
for (const d of faltando) {
    try {
        await api(`/deals/${d.id}`, { method: 'PUT', body: JSON.stringify({ [campo.key]: formUrlDoDeal(d.id) }) });
        ok++;
    } catch (e) { console.log(`❌ #${d.id}: ${e.message.slice(0, 70)}`); }
}
console.log(`✅ ${ok} card(s) preenchido(s)`);
