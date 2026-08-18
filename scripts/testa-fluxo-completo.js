/**
 * Bateria de ponta a ponta, no card de teste.
 *
 * A testa-render.js confere o documento em memória. Esta aqui percorre o
 * caminho de verdade — grava na planilha, lê pelo slug, renderiza do que foi
 * lido, escreve o link no card, fecha a atividade — porque é onde moram os
 * defeitos que não aparecem em teste de função: coluna trocada na planilha,
 * slug que não volta, campo do Pipedrive que recusa o valor.
 *
 * ESCREVE em produção: linhas na planilha e o campo "Link Proposta" do card.
 * Por isso trava no card de teste, guarda o valor original do campo e limpa
 * tudo no fim, inclusive se um caso estourar.
 *
 * Uso: node scripts/testa-fluxo-completo.js
 */
import 'dotenv/config';
import { salvarSpec, porSlug } from '../src/services/spec-store.js';
import { renderProposta } from '../src/services/render-proposta.js';
import { closeProposalActivity } from '../src/services/proposal-activity.js';
import { authedFetch } from '../src/services/google-docs-client.js';
import { pdGet, pdPut } from '../src/services/pipedrive.js';
import { PROPOSAL_DEAL_FIELDS, PROPOSAL_FORM_BASE_URL } from '../src/config/proposal.js';

// Trava no card de teste. Sem isto um erro de digitação sobrescreve o
// "Link Proposta" de um negócio real.
const DEAL_ID = Number(process.env.PROPOSAL_TEST_DEAL_ID || 60956);
const SHEET = process.env.PROPOSAL_SPEC_SHEET_ID;

const prod = (extra = {}) => ({ modalidade: 'Monitoria + Atuação', canais: [], quantidade: null, preco: 8900, faixas: [], sobConsulta: false, ...extra });

const CASOS = [
    {
        nome: 'BB só monitoria, com escada de 3 faixas',
        spec: {
            marcas: ['Marca E2E'], idioma: 'pt', produtos: ['BB'], pacote: null, observacoes: 'teste e2e',
            porProduto: { BB: prod({ modalidade: 'Monitoria', canais: [1592], quantidade: 10, preco: 24900, faixas: [{ qtd: 20, preco: 34900 }, { qtd: 30, preco: 42900 }] }) },
        },
        checa: (h) => [
            h.includes('Entrega de evidências') || 'faltou "Entrega de evidências"',
            !h.includes('Aprovação') || 'sobrou "Aprovação" numa venda de monitoria',
            h.includes('R$ 42.900,00') || 'faltou o preço da 3ª faixa',
            h.includes('Até 10 palavras') || 'faltou o limite de palavras',
        ],
    },
    {
        nome: 'BBP + VM com pacote fechado',
        spec: {
            marcas: ['Marca E2E'], idioma: 'pt', produtos: ['BBP', 'VM'], pacote: 15800, observacoes: '',
            porProduto: { BBP: prod({ modalidade: null, canais: [1598], quantidade: 25 }), VM: prod({ canais: [1604], quantidade: 3 }) },
        },
        checa: (h) => [
            h.includes('R$ 15.800,00') || 'faltou o valor do pacote',
            h.includes('Subtotal') || 'faltou o subtotal',
            h.includes('Monitoria e inteligência') || 'BBP devia sair como monitoria e inteligência',
        ],
    },
    {
        nome: 'os quatro, modalidades misturadas',
        spec: {
            marcas: ['Marca E2E', 'Segunda Marca'], idioma: 'pt', produtos: ['BB', 'BBP', 'GD', 'VM'], pacote: null, observacoes: '',
            porProduto: {
                BB: prod({ modalidade: 'Monitoria', canais: [1592], quantidade: 5 }),
                BBP: prod({ modalidade: null, canais: [1598], quantidade: 40 }),
                GD: prod({ modalidade: 'Monitoria + Atuação', canais: [1599, 1600] }),
                VM: prod({ modalidade: 'Monitoria', canais: [1604], quantidade: 2 }),
            },
        },
        checa: (h) => [
            h.includes('Limite de denúncias') || 'GD em atuação devia manter o limite de denúncias',
            h.includes('Marca E2E, Segunda Marca') || 'faltou alguma marca',
            h.includes('R$ 35.600,00') || 'total dos quatro errado',
        ],
    },
    {
        nome: 'BB só em App Store — sem linha de palavras',
        spec: {
            marcas: ['Marca E2E'], idioma: 'pt', produtos: ['BB'], pacote: null, observacoes: '',
            porProduto: { BB: prod({ canais: [1609], quantidade: null }) },
        },
        checa: (h) => [
            h.includes('App Store') || 'faltou o canal App Store',
            !h.includes('Palavras-chave') || 'sobrou linha de palavras-chave numa venda de App Store',
        ],
    },
];

const criados = [];
let linkOriginal = null;
let ok = 0; const falhas = [];

async function limpar() {
    console.log('\n─── limpando ───');
    if (linkOriginal !== null) {
        try {
            await pdPut(`/deals/${DEAL_ID}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: linkOriginal });
            console.log(`  "Link Proposta" restaurado para ${linkOriginal || '(vazio)'}`);
        } catch (e) { console.log(`  ⚠️ não consegui restaurar o link: ${e.message}`); }
    }
    if (!criados.length) return;
    try {
        const meta = await (await authedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?fields=sheets.properties`)).json();
        const abaId = meta.sheets.find((s) => s.properties.title === 'specs').properties.sheetId;
        const v = await (await authedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/specs!A1:H500`)).json();
        const rows = v.values || [];
        // De baixo pra cima: apagar de cima desloca o índice das de baixo.
        const alvos = rows.map((r, i) => (criados.includes(r[7]) ? i : -1)).filter((i) => i >= 0).sort((a, b) => b - a);
        if (alvos.length) {
            await authedFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests: alvos.map((i) => ({ deleteDimension: { range: { sheetId: abaId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } })) }),
            });
        }
        console.log(`  ${alvos.length} linha(s) de teste removida(s) da planilha`);
    } catch (e) { console.log(`  ⚠️ não consegui limpar a planilha: ${e.message}`); }
}

try {
    const deal = (await pdGet(`/deals/${DEAL_ID}`))?.data;
    if (!deal) throw new Error(`card de teste #${DEAL_ID} não encontrado`);
    linkOriginal = deal[PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA] || '';
    const dados = { id: DEAL_ID, organizacao: deal.org_name || deal.org_id?.name, contato: deal.person_name || deal.person_id?.name };
    console.log(`card de teste #${DEAL_ID} — ${dados.organizacao}\n`);

    for (const caso of CASOS) {
        const problemas = [];
        try {
            // 1. grava — é o que o POST do formulário faz
            const { revisao, slug } = await salvarSpec(DEAL_ID, 'bateria@branddi.com', caso.spec);
            criados.push(slug);
            if (!slug || slug.length < 20) problemas.push('slug não veio');

            // 2. lê pelo slug — é o que a página pública faz
            const lido = await porSlug(slug);
            if (!lido) problemas.push('porSlug não encontrou o que acabou de gravar');
            else {
                if (lido.revisao !== revisao) problemas.push(`revisão voltou ${lido.revisao}, gravei ${revisao}`);
                if (JSON.stringify(lido.spec) !== JSON.stringify(caso.spec)) problemas.push('o spec voltou diferente do que foi gravado');

                // 3. renderiza do que foi lido, não do que está em memória
                const html = renderProposta({ deal: dados, spec: lido.spec, emitidaEm: new Date(lido.registrado_em) });
                if (/\{\{/.test(html)) problemas.push('placeholder vazado');
                problemas.push(...caso.checa(html).filter((r) => r !== true));

                // 4. link no card
                const url = `${PROPOSAL_FORM_BASE_URL}/p/${slug}`;
                await pdPut(`/deals/${DEAL_ID}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: url });
                const conf = (await pdGet(`/deals/${DEAL_ID}`))?.data;
                if (conf[PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA] !== url) problemas.push('o card não guardou o link');

                // 5. atividade
                await closeProposalActivity(DEAL_ID);
            }
        } catch (e) { problemas.push(`estourou: ${e.message}`); }

        if (problemas.length) { falhas.push([caso.nome, problemas.join(' | ')]); console.log(`❌ ${caso.nome}`); }
        else { ok++; console.log(`✅ ${caso.nome}`); }
    }
} finally {
    await limpar();
}

console.log('');
if (falhas.length) {
    console.log(`❌ ${falhas.length} caso(s) falharam:`);
    falhas.forEach(([n, e]) => console.log(`   ${n}\n      ${e}`));
    process.exit(1);
}
console.log(`✅ ${ok} casos de ponta a ponta, todos passaram`);
