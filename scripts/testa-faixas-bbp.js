/**
 * Bateria da escada de preço do Buy Box Protection.
 *
 * Mesma ideia de scripts/testa-faixas.js (BB), com as duas diferenças da
 * escada de BBP: 4 faixas com preço (não 3), e uma 5ª linha sem preço
 * numérico ("Sob Consulta") controlada por um campo separado, sim/não.
 *
 * Formato atualizado em 17/08/2026 (pedido da Jessica, olhando uma proposta
 * real editada pelo time): cada faixa é "Proposta: R$ X/mês  -  Até N SKUs" —
 * sempre "Até", nunca "Entre X e Y" (isso existiu numa versão anterior e foi
 * tirado por não ser como o time escreve à mão).
 *
 * O que cada cenário protege:
 *   · 4 faixas — a escada monta em ordem, cada linha com "Proposta:" própria
 *     e sempre "Até N SKUs" (nunca "Entre X e Y");
 *   · Sob Consulta — a última linha usa a faixa mais alta como teto e não
 *     tem preço; sem faixa nenhuma, marcar Sob Consulta não faz nada (não
 *     existe "faixa mais alta" pra servir de teto);
 *   · BBP+GD com faixas — em combo, só o bloco de BBP vira escada;
 *   · faixa pela metade — quantidade sem preço (e o contrário) NÃO gera;
 *   · sem faixa — o caminho de sempre, intocado.
 *
 * Uso:
 *   node scripts/testa-faixas-bbp.js
 */
import 'dotenv/config';
import { generateProposalForDeal } from '../src/services/proposal-generator.js';
import {
    PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P, PALAVRAS_BB_FIELD,
    CATALOGO_BBP_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, CANAIS_FIELDS as C,
    FAIXAS_BB_FIELDS, FAIXAS_BBP_FIELDS, SOB_CONSULTA_BBP_FIELD, SOB_CONSULTA_BBP_OPTION_SIM,
    IDIOMA_FIELD,
} from '../src/config/proposal.js';

const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = Number(process.env.PROPOSAL_TEST_DEAL_ID);
const PARADA = 13;
const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
const put = (d) => pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const notas = async () => ((await pd(`/notes?deal_id=${ID}&limit=40&sort=${encodeURIComponent('add_time DESC')}`)).data || []);

const { JWT } = await import('google-auth-library');
const k = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: k.client_email, key: k.private_key, scopes: ['https://www.googleapis.com/auth/documents.readonly'] });
async function linhasDoDoc(link) {
    const id = link.match(/document\/d\/([\w-]+)/)[1];
    const { token } = await gc.getAccessToken();
    const doc = await (await fetch(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const tab = doc.tabs?.[0]?.documentTab || doc;
    const out = [];
    (function walk(ct) {
        for (const el of ct || []) {
            if (el.paragraph) {
                const runs = (el.paragraph.elements || []).filter((e) => e.textRun);
                out.push({
                    txt: runs.map((e) => e.textRun.content).join('').replace(/\n/g, '').trim(),
                    negrito: runs.filter((e) => e.textRun.content.trim()).map((e) => !!e.textRun.textStyle?.bold),
                    riscado: runs.filter((e) => e.textRun.content.trim()).map((e) => !!e.textRun.textStyle?.strikethrough),
                    fontes: [...new Set(runs.filter((e) => e.textRun.content.trim()).map((e) => e.textRun.textStyle?.weightedFontFamily?.fontFamily || '(herdada)'))],
                    keep: el.paragraph.paragraphStyle?.keepWithNext === true,
                });
            }
            if (el.table) for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) walk(c.content);
        }
    })(tab.body.content);
    return out;
}

const LIMPO = {
    [P.BB]: null, [P.BBP]: null, [P.GD]: null, [P.VM]: null,
    [PALAVRAS_BB_FIELD]: null, [CATALOGO_BBP_FIELD]: null, [PLATAFORMAS_VM_FIELD]: null,
    [VALOR_PACOTE_FIELD]: null, [C.BB]: '', [C.BBP]: '', [C.GD]: '', [C.VM]: '', [IDIOMA_FIELD]: '',
    [FAIXAS_BB_FIELDS[0].qtd]: null, [FAIXAS_BB_FIELDS[0].preco]: null,
    [FAIXAS_BB_FIELDS[1].qtd]: null, [FAIXAS_BB_FIELDS[1].preco]: null,
    [FAIXAS_BBP_FIELDS[0].qtd]: null, [FAIXAS_BBP_FIELDS[0].preco]: null,
    [FAIXAS_BBP_FIELDS[1].qtd]: null, [FAIXAS_BBP_FIELDS[1].preco]: null,
    [FAIXAS_BBP_FIELDS[2].qtd]: null, [FAIXAS_BBP_FIELDS[2].preco]: null,
    [SOB_CONSULTA_BBP_FIELD]: '',
};

const CENARIOS = [
    { nome: 'BBP com 4 faixas', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '549', [P.BBP]: 8900, [CATALOGO_BBP_FIELD]: 25,
        [FAIXAS_BBP_FIELDS[0].qtd]: 50, [FAIXAS_BBP_FIELDS[0].preco]: 12900,
        [FAIXAS_BBP_FIELDS[1].qtd]: 100, [FAIXAS_BBP_FIELDS[1].preco]: 16900,
        [FAIXAS_BBP_FIELDS[2].qtd]: 200, [FAIXAS_BBP_FIELDS[2].preco]: 19900 },
      espera: ['Proposta: R$ 8.900/mês  -  Até 25 SKUs', 'Proposta: R$ 12.900/mês  -  Até 50 SKUs', 'Proposta: R$ 16.900/mês  -  Até 100 SKUs', 'Proposta: R$ 19.900/mês  -  Até 200 SKUs'],
      naoEspera: ['Entre ', 'Sob consulta'] },
    { nome: 'BBP com Sob Consulta', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '549', [P.BBP]: 8900, [CATALOGO_BBP_FIELD]: 25,
        [FAIXAS_BBP_FIELDS[0].qtd]: 50, [FAIXAS_BBP_FIELDS[0].preco]: 12900,
        [FAIXAS_BBP_FIELDS[1].qtd]: 100, [FAIXAS_BBP_FIELDS[1].preco]: 16900,
        [FAIXAS_BBP_FIELDS[2].qtd]: 200, [FAIXAS_BBP_FIELDS[2].preco]: 19900,
        [SOB_CONSULTA_BBP_FIELD]: String(SOB_CONSULTA_BBP_OPTION_SIM) },
      espera: ['Proposta: R$ 19.900/mês  -  Até 200 SKUs', 'Proposta: Sob consulta  -  Acima de 200 SKUs'] },
    { nome: 'BBP+GD com faixas', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '549,153', [P.BBP]: 8900, [P.GD]: 9900, [CATALOGO_BBP_FIELD]: 25,
        [FAIXAS_BBP_FIELDS[0].qtd]: 50, [FAIXAS_BBP_FIELDS[0].preco]: 12900 },
      espera: ['Proposta: R$ 8.900/mês  -  Até 25 SKUs', 'Proposta: R$ 12.900/mês  -  Até 50 SKUs', 'Proposta: R$ 9.900/mês', '2 - Proteção Golpes Digitais'],
      // "Fraude"/"Fraudes" sozinho aparece em prosa legítima ("Prevenir
      // Fraudes"), e "Impersonação" também tem uso legítimo em campo técnico
      // ("Métodos de Impersonação Monitorados:", nas Especificações do GD) —
      // o que não pode existir é o NOME do produto errado no título/cabeçalho.
      naoEspera: ['Até {{CATALOGO_BBP}}', 'Entre ', 'Proteção Fraude', 'Impersonação de Marca'] },
    { nome: 'BBP+GD com desconto (De riscado)', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '549,153', [P.BBP]: 8900, [P.GD]: 9900, [CATALOGO_BBP_FIELD]: 25, [VALOR_PACOTE_FIELD]: 15800 },
      espera: ['De R$ 18.800/mês', 'Por: R$ 15.800/mês'],
      riscado: 'De R$ 18.800/mês',
      naoRiscado: 'Por: R$ 15.800/mês' },
    { nome: 'faixa pela metade (só qtd)', gera: false,
      campos: { [F.SERVICO_OFERECIDO]: '549', [P.BBP]: 8900, [CATALOGO_BBP_FIELD]: 25, [FAIXAS_BBP_FIELDS[0].qtd]: 50 },
      nota: /BBP faixa 2 - preço/ },
    { nome: 'faixa pela metade (só preço)', gera: false,
      campos: { [F.SERVICO_OFERECIDO]: '549', [P.BBP]: 8900, [CATALOGO_BBP_FIELD]: 25, [FAIXAS_BBP_FIELDS[1].preco]: 16900 },
      nota: /BBP faixa 3 - SKUs/ },
    { nome: 'sem faixa (controle)', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '549', [P.BBP]: 9900, [CATALOGO_BBP_FIELD]: 30 },
      espera: ['Proposta: R$ 9.900/mês', 'Até 30 SKUs'],
      naoEspera: ['Entre 2', 'Sob consulta'] },
    { nome: 'Sob Consulta sem escada não faz nada', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '549', [P.BBP]: 9900, [CATALOGO_BBP_FIELD]: 30, [SOB_CONSULTA_BBP_FIELD]: String(SOB_CONSULTA_BBP_OPTION_SIM) },
      espera: ['Proposta: R$ 9.900/mês', 'Até 30 SKUs'],
      naoEspera: ['Sob consulta', 'Acima de'] },
];

const inicial = (await pd(`/deals/${ID}`)).data;
const snap = { stage_id: inicial.stage_id, [F.SERVICO_OFERECIDO]: inicial[F.SERVICO_OFERECIDO] || '', [F.LINK_PROPOSTA]: '', ...LIMPO };

const falhas = [];
try {
    await put({ stage_id: PARADA }); await espera(2000);
    for (const c of CENARIOS) {
        await put({ ...LIMPO, ...c.campos, [F.LINK_PROPOSTA]: '' });
        for (let i = 0; i < 12; i++) { const v = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || ''; if (!v) break; await put({ [F.LINK_PROPOSTA]: '' }); await espera(800); }
        const antes = await notas();
        await generateProposalForDeal(ID, { notifyOnEntry: true });
        let link = '';
        for (let i = 0; i < 8; i++) { link = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || ''; if (link.startsWith('http')) break; await espera(2000); }
        const novas = (await notas()).filter((n) => !antes.some((a) => a.id === n.id)).map((n) => n.content.replace(/<[^>]*>/g, ''));

        const probs = [];
        if (c.gera && !link.startsWith('http')) probs.push('não gerou');
        if (!c.gera && link.startsWith('http')) probs.push('gerou quando não devia');
        if (c.nota) {
            if (!novas.length) probs.push('nota esperada não veio');
            else if (!novas.some((n) => c.nota.test(n))) probs.push(`nota não disse ${c.nota}`);
        }

        if (c.gera && link.startsWith('http')) {
            const linhas = await linhasDoDoc(link);
            const txt = linhas.map((l) => l.txt);
            for (const e of c.espera || []) if (!txt.includes(e)) probs.push(`faltou "${e}"`);
            for (const e of c.naoEspera || []) if (txt.some((l) => l.includes(e))) probs.push(`não devia ter "${e}"`);
            if (c.riscado) {
                const l = linhas.find((x) => x.txt === c.riscado);
                if (!l) probs.push(`linha "${c.riscado}" não achada pra checar riscado`);
                else if (!l.riscado.length || l.riscado.some((r) => !r)) probs.push(`linha "${c.riscado}" devia estar toda riscada: ${JSON.stringify(l.riscado)}`);
            }
            if (c.naoRiscado) {
                const l = linhas.find((x) => x.txt === c.naoRiscado);
                if (!l) probs.push(`linha "${c.naoRiscado}" não achada pra checar riscado`);
                else if (l.riscado.some((r) => r)) probs.push(`linha "${c.naoRiscado}" não devia estar riscada: ${JSON.stringify(l.riscado)}`);
            }
        }

        if (probs.length) falhas.push(`${c.nome}: ${probs.join('; ')}`);
        console.log(`${probs.length ? '❌' : '✅'} ${c.nome.padEnd(35)} ${probs.join('; ') || 'ok'}`);
    }
} finally {
    await put({ stage_id: PARADA }); await espera(1500);
    await put(snap);
    console.log('\ncard restaurado');
}
console.log(falhas.length ? `\n❌ ${falhas.length} problema(s)` : '\n✅ escada de preço do BBP passou');
process.exitCode = falhas.length ? 1 : 0;
