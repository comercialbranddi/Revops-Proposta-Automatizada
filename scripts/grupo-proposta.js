/**
 * Junta os campos da automação de proposta num grupo próprio ("Proposta") e
 * restringe a exibição ao funil de Vendas.
 *
 * Por que: os 17 campos criados por este projeto foram parar no grupo "Closer",
 * misturados com os 16 que já viviam lá. O closer precisava caçar preço, canal
 * e faixa no meio de tudo — e o Pipedrive não deixa reordenar campo por API
 * (aceita order_nr e ignora, verificado em 13/08/2026), então agrupar é o que
 * resta pra organizar a tela.
 *
 * O que NÃO se move, de propósito:
 *   · "Serviço oferecido" e "Produto Principal" — são de 2024/2026-04, vieram
 *     antes deste projeto e alimentam qualificação em outros funis. Tirar do
 *     Closer mexeria na tela de quem não tem nada a ver com proposta.
 *
 * ANTES de esconder, varre os negócios: campo escondido num funil onde alguém
 * já digitou algo faz o dado sumir da tela sem aviso. Se achar uso fora de
 * Vendas, o script para e mostra onde.
 *
 * A API de grupos é a não documentada: POST /v1/fieldGroups/deal com ARRAY no
 * corpo, DELETE com {ids:[…]}. Não existe PUT — grupo não se renomeia por API.
 *
 * Uso:
 *   node scripts/grupo-proposta.js
 *   node scripts/grupo-proposta.js --apply
 *   node scripts/grupo-proposta.js --sem-escopo --apply   # só agrupa
 */
import 'dotenv/config';
import {
    SALES_PIPELINE_ID, PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P,
    CATALOGO_BBP_FIELD, PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD,
    CANAIS_FIELDS as C, FAIXAS_BB_FIELDS, FAIXAS_BBP_FIELDS, SOB_CONSULTA_BBP_FIELD,
    IDIOMA_FIELD,
} from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const SEM_ESCOPO = process.argv.includes('--sem-escopo');
const GRUPO = 'Proposta';
const T = process.env.PIPEDRIVE_API_TOKEN;

const api = async (p, o) => {
    const r = await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o?.headers || {}) } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || b.success === false) throw new Error(`${o?.method || 'GET'} ${p} → ${r.status}: ${JSON.stringify(b).slice(0, 200)}`);
    return b;
};

// Só o que ESTE projeto criou, NA ORDEM EM QUE DEVE APARECER no card.
//
// A ordem é por PRODUTO, não por tipo de campo: o closer preenche uma venda de
// cada vez, e ter preço, quantidade e canal do mesmo produto juntos é o que
// evita rolar a tela três vezes pra fechar um card. As faixas de BB vêm logo
// abaixo do preço de BB, que é o que elas substituem quando existem.
//
// "Link Proposta" entra no grupo porque é o campo que o closer abre pra pegar
// o documento — deixá-lo no Closer separaria justamente o que ele mais usa.
// Ele e o "Formulário da proposta" ficam por último, nessa ordem: são os dois
// LINKS do card, e ficam juntos no pé em vez de espalhados no meio dos campos
// que se preenche.
const CHAVES = [
    PALAVRAS_BB_FIELD, P.BB,
    FAIXAS_BB_FIELDS[0].qtd, FAIXAS_BB_FIELDS[0].preco,
    FAIXAS_BB_FIELDS[1].qtd, FAIXAS_BB_FIELDS[1].preco,
    C.BB,
    P.BBP, CATALOGO_BBP_FIELD,
    // Faixas do BBP na mesma lógica das de BB: logo abaixo do par que é a
    // faixa 1 (Preço BBP + Catálogo BBP), em ordem crescente, e "Sob
    // Consulta?" por último — é a faixa final da escada.
    FAIXAS_BBP_FIELDS[0].qtd, FAIXAS_BBP_FIELDS[0].preco,
    FAIXAS_BBP_FIELDS[1].qtd, FAIXAS_BBP_FIELDS[1].preco,
    FAIXAS_BBP_FIELDS[2].qtd, FAIXAS_BBP_FIELDS[2].preco,
    SOB_CONSULTA_BBP_FIELD,
    C.BBP,
    P.GD, C.GD,
    P.VM, PLATAFORMAS_VM_FIELD, C.VM,
    IDIOMA_FIELD, VALOR_PACOTE_FIELD, F.LINK_PROPOSTA, F.FORM_PROPOSTA,
];

const campos = (await api('/dealFields?limit=500')).data;
const alvos = CHAVES.map((k) => campos.find((c) => c.key === k)).filter(Boolean);
console.log(`${alvos.length} campo(s) da automação:\n`);
for (const c of alvos) console.log(`   ${c.name.padEnd(36)} grupo=${String(c.group_id ?? '—').padStart(3)}  funis=${c.show_in_pipelines?.show_in_all === false ? JSON.stringify(c.show_in_pipelines.pipeline_ids) : 'todos'}`);

// Campos que a varredura mostrar em uso fora de Vendas ficam sem restrição.
const naoRestringir = new Set();

// ── varredura: alguém usa estes campos fora do funil de Vendas? ──
if (!SEM_ESCOPO) {
    process.stdout.write('\nvarrendo negócios fora de Vendas… ');
    const fora = {};
    let start = 0, total = 0;
    for (;;) {
        const r = await api(`/deals?limit=500&start=${start}&status=all_not_deleted`);
        for (const d of r.data || []) {
            total++;
            if (d.pipeline_id === SALES_PIPELINE_ID) continue;
            for (const c of alvos) {
                const v = d[c.key];
                if (v == null || v === '') continue;
                (fora[c.name] ||= []).push(`#${d.id} (funil ${d.pipeline_id})`);
            }
        }
        if (!r.additional_data?.pagination?.more_items_in_collection) break;
        start = r.additional_data.pagination.next_start;
        process.stdout.write('.');
    }
    console.log(` ${total} negócio(s) lidos`);
    if (Object.keys(fora).length) {
        // Campo com dado fora de Vendas NÃO é restringido: esconder faria o
        // valor sumir da tela de quem já preencheu, sem aviso e sem apagar
        // nada — o pior tipo de mudança, porque parece perda de dado.
        console.log('\n⚠️  com dado fora de Vendas — agrupo, mas NÃO restrinjo:');
        for (const [nome, ds] of Object.entries(fora)) {
            console.log(`   ${nome.padEnd(36)} ${ds.length} negócio(s): ${ds.slice(0, 4).join(', ')}${ds.length > 4 ? '…' : ''}`);
            naoRestringir.add(nome);
        }
    }
    const limpos = alvos.length - naoRestringir.size;
    console.log(`\n✅ ${limpos} campo(s) sem uso fora de Vendas — esses podem ser restritos`);
}

if (!APPLY) { console.log(`\n[simulação] criaria/usaria o grupo "${GRUPO}", moveria ${alvos.length} campo(s)${SEM_ESCOPO ? '' : ' e restringiria ao funil de Vendas'} — rode com --apply`); process.exit(0); }

const grupos = (await api('/fieldGroups/deal')).data || [];
// ONDE os campos já estão manda mais que o NOME do grupo.
//
// Procurar por nome parecia inofensivo até alguém reorganizar o Pipedrive: em
// 27/08/2026 os grupos foram todos renomeados — "Closer" virou "Operação:
// donos e contatos", e o nosso "Proposta" virou "Proposta e precificação".
// Este script não achou "Proposta", CRIOU um grupo novo e levou 26 campos pra
// ele, no fim do card. Nada se perdeu, mas o closer abriu o card e os campos
// tinham sumido do lugar de sempre.
//
// Agora o grupo é decidido por voto: se a maioria dos campos já mora num
// grupo, é nele que os outros entram — com o nome que os humanos tiverem
// dado. Criar só acontece quando NENHUM está agrupado, que é a primeira vez.
const votos = {};
for (const c of alvos) if (c.group_id) votos[c.group_id] = (votos[c.group_id] || 0) + 1;
const maioria = Object.entries(votos).sort((a, b) => b[1] - a[1])[0];

let grupo = maioria ? grupos.find((g) => g.id === Number(maioria[0])) : null;
if (grupo) {
    console.log(`
📁 usando "${grupo.name}" (id ${grupo.id}) — onde ${maioria[1]} dos ${alvos.length} campos já estão`);
} else if ((grupo = grupos.find((g) => g.name === GRUPO))) {
    console.log(`
📁 grupo "${GRUPO}" já existe — id ${grupo.id}`);
} else {
    // Corpo em ARRAY — objeto solto devolve 400 "body must be array".
    grupo = (await api('/fieldGroups/deal', { method: 'POST', body: JSON.stringify([{ name: GRUPO }]) })).data[0];
    console.log(`
📁 grupo "${GRUPO}" criado — id ${grupo.id}`);
}

// Campo que JÁ está num grupo fica onde está.
//
// Este script foi escrito pra uma organização inicial e passou a ser rodado de
// novo a cada campo novo — arrastando junto tudo que alguém já tinha
// posicionado à mão. Em 27/08/2026 foi exatamente isso: os dois links tinham
// sido postos em "Proposta e precificação" a pedido da Jessica, e a rodada
// seguinte os levaria de volta.
//
// Por padrão, então, só campo SEM grupo é colocado. --reagrupar traz de volta o
// comportamento antigo, pra quando a intenção for mesmo reorganizar tudo.
const REAGRUPAR = process.argv.includes('--reagrupar');
const forasteiros = alvos.filter((c) => c.group_id && c.group_id !== grupo.id);
if (forasteiros.length && !REAGRUPAR) {
    console.log(`
${forasteiros.length} campo(s) em outro grupo — deixo onde estão (use --reagrupar pra trazer):`);
    for (const c of forasteiros) console.log(`   ${c.name.padEnd(36)} ${grupos.find((g) => g.id === c.group_id)?.name || c.group_id}`);
}

let movidos = 0, escopados = 0;
for (const c of alvos) {
    const patch = {};
    const podeMover = REAGRUPAR || !c.group_id;
    if (c.group_id !== grupo.id && podeMover) patch.group_id = grupo.id;
    if (!SEM_ESCOPO && !naoRestringir.has(c.name) && c.show_in_pipelines?.show_in_all !== false) {
        patch.show_in_pipelines = { show_in_all: false, pipeline_ids: [SALES_PIPELINE_ID] };
    }
    if (!Object.keys(patch).length) { console.log(`   ${c.name.padEnd(36)} já está certo`); continue; }
    await api(`/dealFields/${c.id}`, { method: 'PUT', body: JSON.stringify(patch) });
    if (patch.group_id) movidos++;
    if (patch.show_in_pipelines) escopados++;
    console.log(`✏️  ${c.name.padEnd(36)} ${patch.group_id ? '→ Proposta' : ''} ${patch.show_in_pipelines ? '· só Vendas' : ''}`);
}
console.log(`\n✅ ${movidos} movido(s)${SEM_ESCOPO ? '' : `, ${escopados} restrito(s) ao funil de Vendas`}`);

// ── ordem ────────────────────────────────────────────────────────────
// order_nr é somente leitura na prática: o PUT devolve 200 e mantém o valor
// antigo, em v1 e em v2, campo a campo ou em lote. Mas a ordem NÃO é imutável:
// campo que ENTRA no grupo vai pro topo. Então tirar e devolver, na sequência
// inversa da desejada, deixa o grupo na ordem certa — o último a entrar é o
// primeiro da tela.
const ordemAtual = async () => (await api('/dealFields?limit=500')).data
    .filter((c) => c.group_id === grupo.id)
    .sort((a, b) => Number(a.order_nr) - Number(b.order_nr))
    .map((c) => c.key);

// Só reordena o que está no grupo alvo — puxar de fora pra ordenar seria mover
// campo que alguém posicionou, pela porta dos fundos.
const noGrupo = new Set((await api('/dealFields?limit=500')).data.filter((c) => c.group_id === grupo.id).map((c) => c.key));
const desejada = alvos.map((c) => c.key).filter((k) => noGrupo.has(k));
if (JSON.stringify(await ordemAtual()) === JSON.stringify(desejada)) {
    console.log('✅ ordem na tela já está certa');
} else {
    console.log('\nreordenando (sai do grupo e volta, do último pro primeiro)…');
    const outroGrupo = (await api('/fieldGroups/deal')).data.find((g) => g.id !== grupo.id).id;
    for (const c of [...alvos].filter((x) => noGrupo.has(x.key)).reverse()) {
        await api(`/dealFields/${c.id}`, { method: 'PUT', body: JSON.stringify({ group_id: outroGrupo }) });
        await api(`/dealFields/${c.id}`, { method: 'PUT', body: JSON.stringify({ group_id: grupo.id }) });
    }
    const final = await ordemAtual();
    const bateu = JSON.stringify(final) === JSON.stringify(desejada);
    console.log(bateu ? '\n✅ ordem na tela:' : '\n⚠️  ordem saiu diferente do pedido:');
    const porChave = Object.fromEntries(alvos.map((c) => [c.key, c.name]));
    for (const k of final) console.log(`   ${porChave[k] || k}`);
}
