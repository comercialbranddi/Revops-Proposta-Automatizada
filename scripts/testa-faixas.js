/**
 * Bateria da escada de preço do Brand Bidding.
 *
 * Parte das propostas de BB não cobra um valor: cobra por faixa de quantidade
 * de palavras-chave (Hotmilhas, 13/08/2026). É EXCEÇÃO — a maioria continua com
 * preço único, e o cenário de controle existe pra garantir isso: card sem faixa
 * preenchida tem que sair exatamente como sempre saiu.
 *
 * O que cada cenário protege:
 *   · 3 e 2 faixas — a escada monta em ordem, e a linha "Palavras-chave: Até N
 *     palavras." dá lugar a ela em vez de conviver;
 *   · BB+GD com faixas — em combo, só o bloco de BB vira escada; o de GD segue
 *     com preço único;
 *   · faixa pela metade — quantidade sem preço (e o contrário) NÃO gera. Sem
 *     isso sairia uma linha sem valor no documento, e o closer só descobriria
 *     depois de enviar;
 *   · sem faixa — o caminho de sempre, intocado.
 *
 * Confere também o que não é texto: fonte própria na linha nova (parágrafo
 * criado por código é onde a fonte cai pro padrão do arquivo), negrito só no
 * valor, e keepWithNext no bloco inteiro — parágrafo novo nasce sem ele e a
 * página volta a quebrar no meio da escada.
 *
 * Roda o generator local, com o card estacionado fora da fase pra não disputar
 * a trava com a versão publicada.
 *
 * Uso:
 *   node scripts/testa-faixas.js
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { generateProposalForDeal } from '../src/services/proposal-generator.js';
import {
    PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P, PALAVRAS_BB_FIELD,
    CATALOGO_BBP_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, CANAIS_FIELDS as C,
    FAIXAS_BB_FIELDS, IDIOMA_FIELD, ENVIO_PROPOSTA_STAGE_ID,
} from '../src/config/proposal.js';

const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = Number(process.env.PROPOSAL_TEST_DEAL_ID);
const PARADA = 13;
const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
const put = (d) => pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const notas = async () => ((await pd(`/notes?deal_id=${ID}&limit=40&sort=${encodeURIComponent('add_time DESC')}`)).data || []);

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
};

const CENARIOS = [
    { nome: 'BB com 3 faixas', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '152', [P.BB]: 24900, [PALAVRAS_BB_FIELD]: 10,
        [FAIXAS_BB_FIELDS[0].qtd]: 20, [FAIXAS_BB_FIELDS[0].preco]: 34900,
        [FAIXAS_BB_FIELDS[1].qtd]: 30, [FAIXAS_BB_FIELDS[1].preco]: 42900 },
      espera: ['Até 10 palavras-chave: R$ 24.900/mês', 'Até 20 palavras-chave: R$ 34.900/mês', 'Até 30 palavras-chave: R$ 42.900/mês'],
      naoEspera: ['Palavras-chave: Até 10 palavras.', 'Proposta: R$ 24.900/mês'] },
    { nome: 'BB com 2 faixas', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '152', [P.BB]: 24900, [PALAVRAS_BB_FIELD]: 10,
        [FAIXAS_BB_FIELDS[0].qtd]: 20, [FAIXAS_BB_FIELDS[0].preco]: 34900 },
      espera: ['Até 10 palavras-chave: R$ 24.900/mês', 'Até 20 palavras-chave: R$ 34.900/mês'],
      naoEspera: ['Até 30', 'Palavras-chave: Até 10 palavras.'] },
    { nome: 'BB+GD com faixas', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '152,153', [P.BB]: 24900, [P.GD]: 9900, [PALAVRAS_BB_FIELD]: 10,
        [FAIXAS_BB_FIELDS[0].qtd]: 20, [FAIXAS_BB_FIELDS[0].preco]: 34900 },
      espera: ['Até 10 palavras-chave: R$ 24.900/mês', 'Até 20 palavras-chave: R$ 34.900/mês', 'Proposta: R$ 9.900/mês'],
      naoEspera: ['Palavras-chave: Até 10 palavras.'] },
    { nome: 'faixa pela metade (só qtd)', gera: false,
      campos: { [F.SERVICO_OFERECIDO]: '152', [P.BB]: 24900, [PALAVRAS_BB_FIELD]: 10, [FAIXAS_BB_FIELDS[0].qtd]: 20 },
      nota: /faixas de BB/ },
    { nome: 'faixa pela metade (só preço)', gera: false,
      campos: { [F.SERVICO_OFERECIDO]: '152', [P.BB]: 24900, [PALAVRAS_BB_FIELD]: 10, [FAIXAS_BB_FIELDS[0].preco]: 34900 },
      nota: /faixas de BB/ },
    { nome: 'sem faixa (controle)', gera: true,
      campos: { [F.SERVICO_OFERECIDO]: '152', [P.BB]: 7900, [PALAVRAS_BB_FIELD]: 3 },
      espera: ['Proposta: R$ 7.900/mês', 'Palavras-chave: Até 3 palavras.'],
      naoEspera: ['Até 3 palavras-chave: R$'] },
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
        if (!c.gera && c.nota && novas.length && !novas.some((n) => c.nota.test(n))) probs.push(`nota não disse ${c.nota}`);

        if (c.gera && link.startsWith('http')) {
            const linhas = await linhasDoDoc(link);
            const txt = linhas.map((l) => l.txt);
            for (const e of c.espera || []) if (!txt.includes(e)) probs.push(`faltou "${e}"`);
            for (const e of c.naoEspera || []) if (txt.some((l) => l.includes(e))) probs.push(`não devia ter "${e}"`);
            const faixa = linhas.find((l) => /^Até \d+ palavras-chave:/.test(l.txt));
            if (faixa) {
                if (faixa.fontes.some((f) => f === '(herdada)')) probs.push(`linha de faixa sem fonte própria: ${faixa.fontes}`);
                if (!(faixa.negrito[0] === false && faixa.negrito.at(-1) === true)) probs.push(`negrito da faixa errado: ${JSON.stringify(faixa.negrito)}`);
            }
            const semKeep = linhas.filter((l, i) => l.txt && linhas[i + 1]?.txt && !l.keep
                && txt.slice(0, i).some((x) => /^Proposta Comercial/.test(x)));
            if (semKeep.length) probs.push(`${semKeep.length} parágrafo(s) sem keepWithNext na comercial`);
        }

        if (probs.length) falhas.push(`${c.nome}: ${probs.join('; ')}`);
        console.log(`${probs.length ? '❌' : '✅'} ${c.nome.padEnd(30)} ${probs.join('; ') || 'ok'}`);
    }
} finally {
    await put({ stage_id: PARADA }); await espera(1500);
    await put(snap);
    console.log('\ncard restaurado');
}
console.log(falhas.length ? `\n❌ ${falhas.length} problema(s)` : '\n✅ escada de preço passou');
process.exitCode = falhas.length ? 1 : 0;
