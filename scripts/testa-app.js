/**
 * Bateria da frente de loja de aplicativos (APP).
 *
 * APP deixou de ser "serviço vendido sem modelo" e virou CANAL de Brand
 * Bidding em 12/08/2026 — a evidência são as propostas de App Store que o time
 * enviou pra Jusbrasil, que são a proposta de BB com a caixa de plataforma
 * trocada. Ver CANAL_BB_APP_STORE_ID na config.
 *
 * Isso partiu o teste em duas metades, e as duas importam:
 *
 *  1. O ESTADO ALVO — canal marcado em "Canais BB". A proposta sai completa, e
 *     em três pontos ela difere da de BB comum: a caixa de plataforma, o
 *     sufixo no título e a AUSÊNCIA da linha de palavras-chave. Por isso aqui
 *     se lê o texto do documento, não só o nome do arquivo: o nome é
 *     "..._BB_..." nos dois casos, e um teste que só olha o nome passaria com
 *     a proposta errada dentro.
 *
 *  2. O ESTADO LEGADO — "APP" ainda marcado em "Serviço oferecido", que é como
 *     os 18 cards do histórico estão. A proposta continua saindo, e o que muda
 *     é a nota: ela diz onde marcar o canal, ou avisa que já está coberto.
 *
 * Dois modos, e a diferença muda o que a bateria PROVA:
 *
 *   node scripts/testa-app.js              chama o generator DIRETO. Quem gera
 *                                          é o código deste diretório — valida
 *                                          alteração antes de publicar, e roda
 *                                          em ~3 min.
 *
 *   node scripts/testa-app.js --webhook    move o card pra fase de verdade e
 *                                          deixa o Pipedrive chamar a Vercel.
 *                                          Quem gera é a versão PUBLICADA. É o
 *                                          único modo que responde "está
 *                                          rodando certo no card?" — e não
 *                                          enxerga o que ainda não subiu.
 *
 * No modo local o card fica ESTACIONADO fora da fase o tempo todo, senão cada
 * update dispara o webhook e a versão publicada gera em paralelo, disputando a
 * trava. No modo webhook é o contrário: a entrada na fase é o próprio disparo.
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { generateProposalForDeal } from '../src/services/proposal-generator.js';
import {
    PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P, CATALOGO_BBP_FIELD,
    PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, CANAIS_FIELDS as C,
    CANAL_BB_APP_STORE_ID, linhasBBDoIdioma, SUFIXO_TITULO_APP_STORE,
    ENVIO_PROPOSTA_STAGE_ID, textosDoIdioma,
} from '../src/config/proposal.js';

const WEBHOOK = process.argv.includes('--webhook');
const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = Number(process.env.PROPOSAL_TEST_DEAL_ID);
// Fase neutra onde o card espera entre cenários. No modo webhook a volta pra
// ENVIO_PROPOSTA_STAGE_ID é o que dispara a geração.
const PARADA = 13;
const OPT = { BB: 152, BBP: 549, GD: 153, VM: 154, APP: 415, NOVOS: 697 };
const GOOGLE_ADS = 1592;
const APP_STORE = CANAL_BB_APP_STORE_ID;
const L = linhasBBDoIdioma('pt');
const TEXTOS = textosDoIdioma('pt');

const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
const put = (d) => pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
// Sem o sort, o Pipedrive devolve as notas MAIS ANTIGAS — as recentes, que são
// as que este teste precisa ver, nunca entrariam na lista.
const notas = async () => ((await pd(`/notes?deal_id=${ID}&limit=60&sort=${encodeURIComponent('add_time DESC')}`)).data || []);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Zera o "Link Proposta" e só volta quando uma LEITURA confirma que ficou
 * vazio.
 *
 * O Pipedrive devolve leitura levemente atrasada depois de um PUT. Sem esperar
 * a confirmação, o generator lia o link do cenário ANTERIOR, concluía "proposta
 * já existe" e voltava sem gerar — e este teste, que só checava se o campo
 * tinha algum link, ia ler o documento velho e dava o cenário por bom. Foi
 * assim que a bateria passou verde com 5 cenários que nunca rodaram.
 */
async function limpaLink() {
    for (let i = 0; i < 12; i++) {
        const v = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || '';
        if (!v) return true;
        await put({ [F.LINK_PROPOSTA]: '' });
        await espera(800 + 400 * i);
    }
    return false;
}

const gkey = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({
    email: gkey.client_email,
    key: gkey.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly'],
});
const docIdDe = (url) => (String(url).match(/document\/d\/([\w-]+)/) || [])[1] || null;

async function gapi(url) {
    const { token } = await gc.getAccessToken();
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? r.json() : null;
}
const nomeDoDoc = async (id) =>
    (await gapi(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`))?.name || null;

/** As linhas de texto do documento, já sem marcação — pra conferir conteúdo. */
async function linhasDoDoc(id) {
    const doc = await gapi(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`);
    if (!doc) return null;
    const corpos = [...(doc.body ? [doc.body] : []), ...(doc.tabs || []).map((t) => t.documentTab?.body).filter(Boolean)];
    const linhas = [];
    (function walk(ct) {
        for (const el of ct || []) {
            if (el.paragraph) linhas.push((el.paragraph.elements || []).map((e) => e.textRun?.content || '').join('').replace(/\n/g, '').trim());
            if (el.table) for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) walk(c.content);
        }
    })(corpos.flatMap((b) => b.content || []));
    return linhas;
}

// Todos os campos preenchidos: o foco aqui é o APP, não a validação de campo.
// Cada cenário sobrescreve o que precisa.
const COMPLETO = {
    [P.BB]: 8000, [P.BBP]: 6000, [P.GD]: 9000, [P.VM]: 4000,
    [PALAVRAS_BB_FIELD]: 3, [CATALOGO_BBP_FIELD]: 150, [PLATAFORMAS_VM_FIELD]: 4,
    [VALOR_PACOTE_FIELD]: null, [C.BB]: '', [C.BBP]: '', [C.GD]: '', [C.VM]: '',
};

// gera:     false, ou trecho que o nome do arquivo tem que conter
// sufixo:   true = título com "- App Store"; false = sem; null = não confere
// palavras: true = linha de palavras-chave presente; false = ausente
// nota:     regex que a nota nova tem que casar (quando houver nota nova)
// semNota:  regex que a nota NÃO pode casar
const CENARIOS = [
    // ── 1. estado alvo: canal marcado, "Serviço oferecido" limpo ──
    { nome: 'BB, canal App Store',        servicos: [OPT.BB], canais: [APP_STORE],
      gera: '_BB_', sufixo: true, palavras: false, plataforma: 'App Store (ASA e Play Store)' },
    { nome: 'BB, canal Google+App Store', servicos: [OPT.BB], canais: [GOOGLE_ADS, APP_STORE],
      gera: '_BB_', sufixo: false, palavras: true, plataforma: 'Google Search Ads + App Store (ASA e Play Store)' },
    { nome: 'BB, App Store, sem palavras', servicos: [OPT.BB], canais: [APP_STORE], campos: { [PALAVRAS_BB_FIELD]: null },
      gera: '_BB_', sufixo: true, palavras: false },
    // Os 8 modelos que contêm BB, todos com App Store como canal único. Em
    // combo há mais o que dar errado: o sufixo pode aparecer duas vezes, a
    // remoção da linha de palavras-chave pode levar junto a de outro produto, e
    // a linha de união do combo pode não incluir o canal de BB. Por isso cada
    // um passa por aqui, e não só um representante.
    { nome: 'BB+BBP, canal App Store',    servicos: [OPT.BB, OPT.BBP], canais: [APP_STORE],
      gera: '_BB+BBP_', sufixo: true, palavras: false, combo: ['App Store (ASA e Play Store)', 'Mercado Livre'] },
    { nome: 'BB+GD, canal App Store',     servicos: [OPT.BB, OPT.GD], canais: [APP_STORE],
      gera: '_BB+GD_', sufixo: true, palavras: false, combo: ['App Store (ASA e Play Store)', 'Google'] },
    { nome: 'BB+VM, canal App Store',     servicos: [OPT.BB, OPT.VM], canais: [APP_STORE],
      gera: '_BB+VM_', sufixo: true, palavras: false, combo: ['App Store (ASA e Play Store)', 'marketplaces'] },
    { nome: 'BB+BBP+GD, App Store',       servicos: [OPT.BB, OPT.BBP, OPT.GD], canais: [APP_STORE],
      gera: '_BB+BBP+GD_', sufixo: true, palavras: false, combo: ['App Store (ASA e Play Store)', 'Mercado Livre', 'Google'] },
    { nome: 'BB+BBP+VM, App Store',       servicos: [OPT.BB, OPT.BBP, OPT.VM], canais: [APP_STORE],
      gera: '_BB+BBP+VM_', sufixo: true, palavras: false, combo: ['App Store (ASA e Play Store)', 'Mercado Livre', 'marketplaces'] },
    { nome: 'BB+GD+VM, App Store',        servicos: [OPT.BB, OPT.GD, OPT.VM], canais: [APP_STORE],
      gera: '_BB+GD+VM_', sufixo: true, palavras: false, combo: ['App Store (ASA e Play Store)', 'Google', 'marketplaces'] },
    { nome: 'BB+BBP+GD+VM, App Store',    servicos: [OPT.BB, OPT.BBP, OPT.GD, OPT.VM], canais: [APP_STORE],
      gera: '_BB+BBP+GD+VM_', sufixo: true, palavras: false,
      combo: ['App Store (ASA e Play Store)', 'Mercado Livre', 'Google', 'marketplaces'] },

    // ── 2. estado legado: "APP" ainda em Serviço oferecido ──
    { nome: 'APP sozinho',                servicos: [OPT.APP], canais: [],
      gera: false, nota: /marque "Brand Bidding" em "Serviço oferecido"/ },
    { nome: 'APP + Novos Termos',         servicos: [OPT.APP, OPT.NOVOS], canais: [],
      gera: false, nota: /Novos Termos não tem modelo/ },
    { nome: 'BB + APP, canal marcado',    servicos: [OPT.BB, OPT.APP], canais: [APP_STORE],
      gera: '_BB_', sufixo: true, palavras: false, nota: /já está coberto/, semNota: /NÃO cobre/ },
    { nome: 'BB + APP, canal NÃO marcado', servicos: [OPT.BB, OPT.APP], canais: [GOOGLE_ADS],
      gera: '_BB_', sufixo: false, palavras: true, nota: /canal não está marcado no card/ },
    { nome: 'BB + APP + Novos Termos',    servicos: [OPT.BB, OPT.APP, OPT.NOVOS], canais: [APP_STORE],
      gera: '_BB_', nota: /NÃO cobre[^.]*Novos Termos/ },

    // ── 3. controle: nada de App Store, comportamento de sempre ──
    { nome: 'BB puro (controle)',         servicos: [OPT.BB], canais: [],
      gera: '_BB_', sufixo: false, palavras: true, plataforma: 'Google Search Ads', semNota: /App Store|NÃO cobre/ },
    { nome: 'BB sem palavras (controle)', servicos: [OPT.BB], canais: [GOOGLE_ADS], campos: { [PALAVRAS_BB_FIELD]: null },
      gera: false, nota: /Palavras-chave BB/ },
];

const inicial = (await pd(`/deals/${ID}`)).data;
const snapshot = {
    [F.SERVICO_OFERECIDO]: inicial[F.SERVICO_OFERECIDO] || '',
    [F.LINK_PROPOSTA]: '',
    ...Object.fromEntries(Object.keys(COMPLETO).map((k) => [k, inicial[k] ?? null])),
};

// Tira o card da fase "Envio de proposta" enquanto a bateria roda.
//
// Sem isso o teste corre CONTRA A PRODUÇÃO: cada PUT daqui dispara o webhook, a
// automação publicada na Vercel gera o documento com o código ANTIGO e ganha a
// trava — o generator local desiste e o teste vai ler o documento da versão
// deployada. Foi assim que 5 cenários de App Store "falharam" com o código
// local certo, e os únicos que passaram foram justamente os que a versão
// publicada recusou (sem palavras-chave, ela não gera).
//
// O generator local não olha a fase; quem olha é o webhook. Então basta o card
// estar fora dela pra este teste ter o card só pra si.
async function estacionaForaDaFase() {
    if (inicial.stage_id !== ENVIO_PROPOSTA_STAGE_ID) return null;
    const stages = (await pd(`/stages?pipeline_id=${inicial.pipeline_id}`)).data || [];
    const outra = stages.find((s) => s.id !== ENVIO_PROPOSTA_STAGE_ID);
    if (!outra) {
        console.log('⚠️  não achei outra fase no funil — o teste vai correr junto com a automação publicada');
        return null;
    }
    await pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: outra.id }) });
    console.log(`card estacionado em "${outra.name}" (#${outra.id}) — webhook de produção fora do caminho\n`);
    return inicial.stage_id;
}
// No modo webhook o card também sai da fase entre cenários, mas por outro
// motivo: a ENTRADA nela é o disparo, e só conta como entrada quem estava fora.
const faseOriginal = await estacionaForaDaFase();

/** Dispara a geração do jeito do modo escolhido e devolve quando o link chegar. */
async function dispara() {
    if (!WEBHOOK) {
        await generateProposalForDeal(ID, { notifyOnEntry: true });
        return;
    }
    // Quem gera é a Vercel. Entre o PUT e o documento pronto passam o webhook,
    // a cópia no Drive e a gravação do link — daí a espera bem mais longa que
    // no modo local, onde a chamada já volta com tudo feito.
    await put({ stage_id: ENVIO_PROPOSTA_STAGE_ID });
    for (let i = 0; i < 25; i++) {
        await espera(3000);
        const v = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || '';
        if (v.startsWith('http')) return;
    }
}

const falhas = [];
console.log(WEBHOOK
    ? '>>> modo WEBHOOK — quem gera é a versão PUBLICADA na Vercel\n'
    : '>>> modo LOCAL — quem gera é o código deste diretório\n');
console.log('cenário                         gerou   título       palavras   nota');
console.log('─'.repeat(88));

try {
    for (const c of CENARIOS) {
        // No modo webhook o cenário anterior deixou o card DENTRO da fase.
        // Montar os campos ali dispararia a geração antes da hora, com estado
        // meio trocado — e o cenário mediria a mistura dos dois.
        if (WEBHOOK) { await put({ stage_id: PARADA }); await espera(2000); }
        await put({
            ...COMPLETO, ...(c.campos || {}),
            [C.BB]: (c.canais || []).join(','),
            [F.SERVICO_OFERECIDO]: c.servicos.join(','),
            [F.LINK_PROPOSTA]: '',
        });
        const problemas = [];
        if (!await limpaLink()) problemas.push('não consegui zerar o "Link Proposta" antes de gerar');
        const antes = await notas();
        await dispara();

        // O campo pode estar com a sentinela da trava ("gerando proposta") se a
        // geração ainda não fechou. Sentinela não é documento — esperar aqui
        // evita ler o campo no meio do caminho e concluir errado.
        let link = '';
        for (let i = 0; i < 5; i++) {
            link = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || '';
            if (!link.includes('gerando proposta')) break;
            await espera(2000);
        }
        if (link.includes('gerando proposta')) link = '';
        const novas = (await notas()).filter((n) => !antes.some((a) => a.id === n.id))
            .map((n) => n.content.replace(/<[^>]*>/g, ''));
        const texto = novas.join('\n');

        // A nota pode ter sido legitimamente suprimida: o generator não repete
        // a mesma mensagem em 5 min, e rodar a bateria duas vezes seguidas cai
        // nisso. Então o que se exige sempre é o RESULTADO (gerou ou não); o
        // texto só é cobrado quando alguma nota foi de fato postada agora.
        const houveNota = texto.trim().length > 0;
        let temSufixo = null, temPalavras = null;

        if (c.gera === false) {
            if (link) problemas.push('gerou quando não devia');
        } else if (!link) {
            problemas.push('NÃO gerou');
        } else {
            const docId = docIdDe(link);
            // O Drive leva um instante pra indexar a cópia recém-criada, e o
            // tempo varia — uma tentativa só deixa o teste instável.
            let nome = null;
            for (let i = 0; i < 4 && !nome; i++) {
                if (i) await espera(1500 * i);
                nome = await nomeDoDoc(docId);
            }
            if (!nome) problemas.push('não consegui ler o nome do documento');
            else if (!nome.includes(c.gera)) problemas.push(`modelo errado: ${nome}`);

            // O nome do arquivo é igual com e sem App Store — o que separa os
            // dois casos está DENTRO do documento.
            const linhas = await linhasDoDoc(docId);
            if (!linhas) problemas.push('não consegui ler o conteúdo do documento');
            else {
                // Uma vez, não "pelo menos uma": em combo o título de BB não
                // pode ganhar o sufixo em dois lugares.
                const vezes = linhas.filter((l) => l.includes(`${L.titulo}${SUFIXO_TITULO_APP_STORE}`)).length;
                temSufixo = vezes > 0;
                temPalavras = linhas.some((l) => l.startsWith(L.palavras));
                if (c.sufixo != null && temSufixo !== c.sufixo) problemas.push(`sufixo no título: esperava ${c.sufixo}`);
                if (c.sufixo && vezes !== 1) problemas.push(`sufixo aparece ${vezes}x (esperava 1)`);
                if (c.palavras != null && temPalavras !== c.palavras) problemas.push(`linha de palavras-chave: esperava ${c.palavras}`);

                // A linha de união do combo. CUIDADO: em BB+GD e BB+VM existem
                // DUAS linhas "Plataformas:" — a do produto, dentro do item
                // comercial ({{CANAIS_GD}}), e a do combo ({{CANAIS_COMBO}}),
                // que vem por último. Pegar a primeira acusa falsamente "combo
                // sem App Store" em 6 dos 8 modelos com BB.
                if (c.combo) {
                    const uniao = linhas.filter((l) => l.startsWith(`${TEXTOS.plataformas} `)).at(-1);
                    if (!uniao) problemas.push(`sem linha "${TEXTOS.plataformas}" do combo`);
                    else for (const canal of c.combo) {
                        if (!uniao.includes(canal)) problemas.push(`união do combo sem "${canal}": ${uniao.slice(0, 70)}`);
                    }
                }
                if (c.palavras === false && linhas.some((l) => l.includes('{{PALAVRAS_BB}}'))) problemas.push('placeholder de palavras vazou');
                if (c.plataforma && !linhas.some((l) => l === c.plataforma)) problemas.push(`caixa de plataforma: esperava "${c.plataforma}"`);
                if (linhas.some((l) => /\{\{[A-Z_]+\}\}/.test(l))) problemas.push('placeholder solto no documento');
            }
        }

        if (houveNota) {
            if (c.nota && !c.nota.test(texto)) problemas.push(`nota não disse ${c.nota}`);
            if (c.semNota && c.semNota.test(texto)) problemas.push(`nota disse o que não devia (${c.semNota})`);
        }

        if (problemas.length) falhas.push(`${c.nome}: ${problemas.join('; ')}`);
        const fmt = (v) => (v === null ? '—' : v ? 'sim' : 'não');
        console.log(`${problemas.length ? '❌' : '✅'} ${c.nome.padEnd(30)} ${(link ? 'sim' : 'não').padEnd(7)} ${fmt(temSufixo).padEnd(12)} ${fmt(temPalavras).padEnd(10)} ${houveNota ? 'nova' : 'dedupe'}`);
        if (problemas.length) console.log(`   ↳ ${problemas.join('; ')}`);
    }
} finally {
    await put(snapshot);
    if (faseOriginal) {
        // Voltar pra fase conta como ENTRADA pro webhook, então a automação
        // publicada vai gerar uma proposta no card de teste logo depois. É o
        // comportamento normal dela — só não é resultado desta bateria.
        await pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: faseOriginal }) });
        console.log('\ncard restaurado (campos e fase) — a automação publicada deve gerar uma proposta pela reentrada na fase');
    } else {
        console.log('\ncard restaurado');
    }
}

console.log(falhas.length ? `\n❌ ${falhas.length} problema(s):\n   ${falhas.join('\n   ')}` : '\n✅ toda a frente de App Store passou');
process.exitCode = falhas.length ? 1 : 0;
