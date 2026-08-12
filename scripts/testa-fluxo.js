/**
 * Bateria ponta a ponta pelo card de teste: monta cada cenário com o card
 * estacionado fora da fase, traz de volta pra "Envio de proposta" (o que gera
 * uma ENTRADA real no webhook) e confere o resultado — nota, link e conteúdo
 * do documento gerado.
 *
 * Restaura o estado original do card no fim, mesmo se algo falhar. As notas
 * postadas durante os testes NÃO são apagadas — ficam no card.
 *
 * ATENÇÃO ao que cada modo testa. No modo padrão quem gera é a versão
 * PUBLICADA na Vercel, porque o disparo é o webhook do Pipedrive. Alteração
 * que ainda não subiu não aparece aqui — o teste passa ou falha sobre o código
 * antigo. Pra validar o que está neste diretório antes de publicar, use
 * --local, que chama o generator direto (e ainda corta os 30s de espera por
 * cenário).
 *
 * DEIXE 5 MINUTOS ENTRE DUAS RODADAS. O generator deduplica nota repetida numa
 * janela de 5 min (NOTE_DEDUPE_MS), então uma segunda rodada logo em seguida
 * não posta as mesmas notas e os cenários acusam "nota esperada não veio" —
 * falso negativo. No modo webhook a própria duração (~9 min) já dá esse
 * espaçamento; no --local, que roda em ~1 min, não dá.
 *
 * O Pipedrive também limita 100 notas POR NEGÓCIO. Como esta bateria posta
 * notas e não as apaga, o card satura depois de algumas rodadas e a API passa a
 * recusar toda nota com HTTP 403 — que o generator engole como warning. O
 * sintoma é idêntico ao do dedupe: todo cenário que espera nota falha de uma
 * vez. Se isso acontecer, limpe as notas antigas do card.
 *
 * Uso:
 *   node scripts/testa-fluxo.js             # via webhook, testa o que está no ar
 *   node scripts/testa-fluxo.js --local     # testa o código deste diretório
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import {
    PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P, CATALOGO_BBP_FIELD,
    PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, CANAIS_FIELDS as C,
    IDIOMA_FIELD,
} from '../src/config/proposal.js';
import { generateProposalForDeal } from '../src/services/proposal-generator.js';

const LOCAL = process.argv.includes('--local');

// IDs das opções dos campos de canal (ver CANAIS_OPTION_TO_LABEL na config).
const CANAL = {
    // Loja de aplicativos já foi 1603, sob GD — foi a primeira aposta de que
    // era canal de Golpes Digitais. As propostas de App Store que o time enviou
    // mostraram que é canal de BRAND BIDDING, e a opção foi recriada sob BB em
    // 12/08/2026. O id 1603 não existe mais no Pipedrive.
    BB: { google: 1592, shopping: 1593, bing: 1594, amazonAds: 1595, appStore: 1609 },
    BBP: { ml: 1596, amazon: 1597, marketplaces: 1598 },
    GD: { google: 1599, meta: 1600, tld: 1601, marketplaces: 1602 },
    VM: { marketplaces: 1604, shopping: 1605 },
};

const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = Number(process.env.PROPOSAL_TEST_DEAL_ID);
const PARADA = 13, FASE = 257;
// Faz as vezes da proposta que o closer montou à mão e colou no campo. Tem cara
// de link de documento de propósito: o que a automação olha é se o campo está
// preenchido com algo que NÃO é a sentinela da trava.
const LINK_MANUAL = 'https://docs.google.com/document/d/PROPOSTA-FEITA-A-MAO-PELO-CLOSER/edit';
const OPT = { BB: 152, BBP: 549, GD: 153, VM: 154 };
// Opções do campo "Idioma da proposta" (ver IDIOMA_OPTION_TO_CODE na config).
const IDIOMA_OPT = { pt: 1588, en: 1589, es: 1590 };

const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
/**
 * Grava campos no card e RECLAMA se o Pipedrive recusar.
 *
 * O PUT é tudo-ou-nada: um único valor inválido — uma opção de multi-select que
 * foi removida do campo, por exemplo — faz a chamada inteira voltar
 * `success: false` e NENHUM dos outros campos é aplicado. O cenário então roda
 * com os valores do cenário anterior e falha por um motivo que não tem nada a
 * ver com o que ele testa. Foi o que escondeu, por dias, que o cenário de Bing
 * era impossível de montar pela API.
 */
async function put(d) {
    const res = await pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    if (res?.success === false) {
        console.log(`   ⚠️  Pipedrive RECUSOU o update — nenhum campo foi aplicado: ${JSON.stringify(res.error || res).slice(0, 160)}`);
    }
    return res;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const notas = async () => ((await pd(`/notes?deal_id=${ID}&limit=100`)).data || []);

const key = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
async function docInfo(url) {
    const id = (String(url).match(/document\/d\/([\w-]+)/) || [])[1];
    if (!id) return null;
    const { token } = await gc.getAccessToken();
    const H = { Authorization: `Bearer ${token}` };
    const meta = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`, { headers: H })).json();
    const txt = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain&supportsAllDrives=true`, { headers: H })).text();
    return { nome: meta.name, txt };
}

// Estado neutro entre cenários: tudo limpo, pra um teste não herdar do outro.
const LIMPO = {
    [F.SERVICO_OFERECIDO]: '', [F.LINK_PROPOSTA]: '',
    [P.BB]: null, [P.BBP]: null, [P.GD]: null, [P.VM]: null,
    [CATALOGO_BBP_FIELD]: null, [PALAVRAS_BB_FIELD]: null,
    [PLATAFORMAS_VM_FIELD]: null, [VALOR_PACOTE_FIELD]: null,
    [C.BB]: '', [C.BBP]: '', [C.GD]: '', [C.VM]: '',
    // Sem zerar o idioma, um cenário herdaria o do anterior e o teste mentiria:
    // depois do cenário em inglês, todos os seguintes rodariam em inglês.
    [IDIOMA_FIELD]: '',
    // "Produto Principal" é o fallback de quando "Serviço oferecido" está
    // vazio. Precisa estar AQUI, e não só nos campos de um cenário: o snapshot
    // que restaura o card é montado a partir das chaves do LIMPO, então um
    // campo limpo fora dele seria apagado do card de vez.
    [F.PRODUTO_PRINCIPAL]: null,
};

const CENARIOS = [
    {
        nome: 'BB só, completo',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 4 },
        espera: { gera: true, nome: /_BB_/, contem: ['R$ 8.000/mês', 'Até 4 palavras'], naoContem: ['De R$'] },
    },
    {
        nome: 'VM só, sem Plataformas VM',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.VM}`, [P.VM]: 4000 },
        espera: { gera: false, nota: /falta preencher.*Plataformas VM/i },
    },
    {
        nome: 'BB+GD, sem Preço GD',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.GD}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3 },
        espera: { gera: false, nota: /falta preencher Preço GD/i },
    },
    {
        nome: 'BB+BBP+VM sem valor de pacote',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.BBP},${OPT.VM}`,
            [P.BB]: 8000, [P.BBP]: 6000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 3, [CATALOGO_BBP_FIELD]: 150, [PLATAFORMAS_VM_FIELD]: 5,
        },
        espera: { gera: true, nome: /_BB\+BBP\+VM_/, contem: ['R$ 18.000/mês', 'Até 150 SKUs', 'Até 5 marketplaces'], naoContem: ['De R$'] },
    },
    {
        nome: 'BB+BBP+VM com valor de pacote',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.BBP},${OPT.VM}`,
            [P.BB]: 8000, [P.BBP]: 6000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 3, [CATALOGO_BBP_FIELD]: 150, [PLATAFORMAS_VM_FIELD]: 5,
            [VALOR_PACOTE_FIELD]: 15000,
        },
        espera: { gera: true, nome: /_BB\+BBP\+VM_/, contem: ['De R$ 18.000/mês', 'Por: R$ 15.000/mês'] },
    },
    {
        nome: 'os quatro produtos',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.BBP},${OPT.GD},${OPT.VM}`,
            [P.BB]: 8000, [P.BBP]: 6000, [P.GD]: 9000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 2, [CATALOGO_BBP_FIELD]: 300, [PLATAFORMAS_VM_FIELD]: 3,
            [VALOR_PACOTE_FIELD]: 22000,
        },
        espera: { gera: true, nome: /_BB\+BBP\+GD\+VM_/, contem: ['De R$ 27.000/mês', 'Por: R$ 22.000/mês', 'Até 2 palavras', 'Até 300 SKUs', 'Até 3 marketplaces'] },
    },
    {
        nome: 'BB com Bing marcado no canal',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3,
            [C.BB]: `${CANAL.BB.google},${CANAL.BB.bing}` },
        espera: { gera: true, nome: /_BB_/, contem: ['Google Search Ads + Bing'] },
    },
    {
        // O contrato com o closer: a automação NUNCA substitui proposta que já
        // está no card. Se ele preferir o processo antigo, monta à mão, cola o
        // link no campo e a automação sai da frente. Pra gerar outra, limpa o
        // campo — e é isso que a nota explica, porque é a única forma de ele
        // descobrir.
        //
        // Estava sem teste, sendo a garantia que mais importa aqui: uma
        // regressão nela sobrescreve proposta negociada, em card de cliente.
        nome: 'proposta existente NÃO é substituída',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3,
            [F.LINK_PROPOSTA]: LINK_MANUAL,
        },
        espera: { mantemLink: LINK_MANUAL, nota: /Proposta já existe.*limpe o campo "Link Proposta"/is },
    },
    {
        // Serviço que na verdade é canal, ainda marcado em "Serviço oferecido".
        //
        // Este cenário era com Bing (opção 416) e nunca teve como passar: a
        // opção foi REMOVIDA do campo, e o Pipedrive recusa o PUT inteiro que
        // tenta gravá-la — o card ficava só com BB e a nota saía sem aviso
        // nenhum. Os 7 cards antigos que ainda carregam 416 existem, mas não dá
        // pra reproduzi-los pela API.
        //
        // APP (415) continua selecionável e percorre exatamente o mesmo caminho
        // (SERVICO_QUE_VIROU_CANAL), então é ele quem cobre a regra aqui.
        //
        // A expectativa também mudou de "não gera" pra "gera parcial": o card
        // sai com o Brand Bidding pronto e a nota dizendo o que fazer, em vez
        // de deixar o closer montar tudo à mão.
        nome: 'APP ainda em "Serviço oferecido"',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB},415`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3 },
        espera: { gera: true, nome: /_BB_/, nota: /APP.*canal de monitoramento.*não está marcado no card/is },
    },
    {
        // Loja de aplicativos como canal de BB. A frente inteira (sufixo no
        // título, linha de palavras-chave, nota) está em testa-app.js; aqui só
        // se confere que a caixa de plataforma recebe o canal, igual aos outros.
        nome: 'BB com App Store no canal',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3,
            [C.BB]: `${CANAL.BB.google},${CANAL.BB.appStore}` },
        espera: { gera: true, nome: /_BB_/, contem: ['Google Search Ads + App Store (ASA e Play Store)'] },
    },
    {
        nome: 'BBP com Amazon somado',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BBP}`, [P.BBP]: 6000, [CATALOGO_BBP_FIELD]: 150,
            [C.BBP]: `${CANAL.BBP.ml},${CANAL.BBP.amazon}` },
        espera: { gera: true, nome: /_BBP_/, contem: ['Mercado Livre + Amazon'] },
    },
    {
        nome: 'combo BB+VM com união de canais',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.VM}`, [P.BB]: 8000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 3, [PLATAFORMAS_VM_FIELD]: 4,
            [C.BB]: `${CANAL.BB.google},${CANAL.BB.bing}`,
            [C.VM]: `${CANAL.VM.marketplaces},${CANAL.VM.shopping}` },
        espera: { gera: true, nome: /_BB\+VM_/,
            contem: ['Google Search Ads + Bing + Até 4 marketplaces monitorados simultaneamente + Google Shopping'] },
    },
    {
        nome: 'canal vazio cai no padrão do produto',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BBP}`, [P.BBP]: 6000, [CATALOGO_BBP_FIELD]: 200 },
        espera: { gera: true, contem: ['Mercado Livre'], naoContem: ['Amazon'] },
    },
    // ─── Idioma ─────────────────────────────────────────────────────
    // Desde 11/08/2026 os três idiomas têm os 15 modelos, então o esperado
    // passou a ser GERAR. Cada cenário confere três coisas de uma vez: que o
    // arquivo levou o sufixo do idioma no nome, que o texto saiu no idioma
    // certo, e — o que mais importa — que o preço saiu com o sufixo daquele
    // idioma. Esse último pega a regressão silenciosa: se a camada de
    // TEXTOS_POR_IDIOMA quebrar, o documento continua em inglês mas o preço
    // volta a dizer "/mês", e só uma asserção assim percebe.
    {
        nome: 'card completo pedindo inglês',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3,
            [IDIOMA_FIELD]: IDIOMA_OPT.en,
        },
        espera: {
            gera: true, nome: /_BB_en_/,
            contem: ['R$ 8.000/month', 'Keywords: up to 3 keywords', 'Commercial Terms'],
            naoContem: ['/mês', 'Condições Comerciais'],
        },
    },
    {
        nome: 'combo em inglês leva From/To no total',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.GD}`, [P.BB]: 8000, [P.GD]: 9000,
            [PALAVRAS_BB_FIELD]: 3, [VALOR_PACOTE_FIELD]: 15000,
            [IDIOMA_FIELD]: IDIOMA_OPT.en,
        },
        espera: {
            gera: true, nome: /_BB\+GD_en_/,
            contem: ['From: R$ 17.000/month', 'To: R$ 15.000/month'],
            naoContem: ['De R$', 'Por: R$'],
        },
    },
    {
        nome: 'card completo pedindo espanhol',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.GD}`, [P.BB]: 8000, [P.GD]: 9000,
            [PALAVRAS_BB_FIELD]: 3, [IDIOMA_FIELD]: IDIOMA_OPT.es,
        },
        espera: {
            gera: true, nome: /_BB\+GD_es_/,
            contem: ['R$ 8.000/mes', 'Condiciones Comerciales', 'Palabras clave'],
            naoContem: ['/mês', 'Condições Comerciais'],
        },
    },
    // O caminho de "não há modelo neste idioma" continua existindo e ainda
    // precisa funcionar — só que agora a única forma de alcançá-lo é uma
    // COMBINAÇÃO sem modelo, não um idioma inteiro. Sem este cenário, aquele
    // ramo do generator fica sem cobertura nenhuma.
    {
        nome: 'produto nenhum identificável avisa por nota',
        campos: { [F.SERVICO_OFERECIDO]: '', [P.BB]: 8000 },
        espera: { gera: false, nota: /não tem produto identificável|Preencha um dos dois/i },
    },
    // O fallback pro "Produto Principal" quando "Serviço oferecido" está vazio
    // não tinha cobertura nenhuma, e é o caso em que a automação tem mais
    // chance de escolher o modelo errado sem ninguém ver — por isso ele avisa
    // na nota. Agora que o LIMPO zera esse campo, dá pra testá-lo isolado.
    {
        nome: 'sem Serviço oferecido, cai no Produto Principal',
        campos: {
            [F.PRODUTO_PRINCIPAL]: 756, // BB
            [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3,
        },
        espera: { gera: true, nome: /_BB_\d{4}-\d{2}-\d{2}_deal/ },
    },
    // O campo é novo: a maioria esmagadora dos cards está com ele vazio. Se o
    // default de português quebrar, tudo para de gerar — este é o cenário que
    // pega isso.
    {
        nome: 'idioma vazio gera em português',
        // O regex exige a data logo depois de "_BB_": é assim que ele prova a
        // AUSÊNCIA do sufixo de idioma no nome do arquivo.
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 4 },
        espera: { gera: true, nome: /_BB_\d{4}-\d{2}-\d{2}_deal/, contem: ['R$ 8.000/mês'] },
    },
    // Português explícito tem que se comportar igual ao vazio — e o nome do
    // arquivo NÃO ganha sufixo, senão renomearia o padrão do que está no Drive.
    {
        nome: 'português explícito, sem sufixo no nome',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 4,
            [IDIOMA_FIELD]: IDIOMA_OPT.pt,
        },
        espera: { gera: true, nome: /_BB_\d{4}-\d{2}-\d{2}_deal/, contem: ['R$ 8.000/mês'] },
    },
];

// O modo --local chama o generator direto, o que passa por cima da trava de
// piloto que protege o endpoint HTTP (isProposalAutomationEnabledForDeal). Sem
// esta guarda, um PROPOSAL_TEST_DEAL_ID vazio viraria deal NaN — e um valor
// errado apontaria a bateria pra um card de cliente, que teria os campos
// zerados e uma proposta gerada por cima.
if (!Number.isFinite(ID) || ID <= 0) {
    console.error('PROPOSAL_TEST_DEAL_ID ausente ou inválido — esta bateria reescreve os campos do card, então recusa rodar sem saber qual é.');
    process.exit(1);
}

console.log(LOCAL
    ? `>>> modo LOCAL — quem gera é o código deste diretório (card ${ID})`
    : `>>> modo WEBHOOK — quem gera é a versão publicada na Vercel (card ${ID})`);
console.log(`    ${CENARIOS.length} cenários\n`);

const inicial = (await pd(`/deals/${ID}`)).data;
const snapshot = {
    stage_id: inicial.stage_id,
    ...Object.fromEntries(Object.keys(LIMPO).map((k) => [k, inicial[k] ?? null])),
};

/**
 * Espera o Pipedrive devolver o que acabou de ser gravado.
 *
 * A leitura logo após o PUT ainda traz o valor antigo, e no modo --local não há
 * os 30s do webhook pra encobrir isso. O sintoma é o cenário rodar com os
 * campos do ANTERIOR: o card marcado "BB + Bing" gerava proposta de BB porque o
 * generator lia "Serviço oferecido" desatualizado, e o "Link Proposta" recém
 * apagado ainda voltava preenchido, fazendo o generator concluir "já existe".
 *
 * Pausa fixa aqui é chute — confirmar a escrita é determinístico e mais rápido
 * no caso comum.
 */
async function confirmarEscrita(campos, tentativas = 20) {
    // Os campos que mais importam: o que escolhe o modelo e o que trava a
    // geração. LIMPO zera os dois em todo cenário.
    const chaves = [F.SERVICO_OFERECIDO, F.LINK_PROPOSTA];
    // O Pipedrive devolve o multi-select reordenado ("152,416" volta "416,152"),
    // então comparar a string crua nunca casa e a confirmação estoura o tempo à
    // toa. Comparar como conjunto é o que responde a pergunta de verdade.
    const conjunto = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean).sort().join(',');
    const esperado = (k) => conjunto(campos[k] ?? LIMPO[k] ?? '');
    for (let i = 0; i < tentativas; i++) {
        const d = (await pd(`/deals/${ID}`)).data || {};
        if (chaves.every((k) => conjunto(d[k]) === esperado(k))) return;
        await espera(400);
    }
    console.log('   ⚠️  campos não confirmaram a tempo — o cenário pode ler valor velho');
}

/**
 * Monta o cenário no card e dispara a geração. Devolve as notas que existiam
 * ANTES do disparo, pra quem chama saber quais são novas.
 *
 * Dois modos, e a diferença é quem executa o código:
 *
 *  - padrão: move o card pra fora da fase e de volta, o que faz o Pipedrive
 *    chamar o webhook. Quem gera é a versão PUBLICADA na Vercel. É o teste
 *    honesto do sistema inteiro, e o único que cobre a inscrição do webhook —
 *    mas não enxerga mudança que ainda não subiu.
 *
 *  - --local: chama generateProposalForDeal() aqui mesmo. Quem gera é o código
 *    DESTE diretório, contra o Pipedrive e o Drive de verdade. É como validar
 *    alteração antes de publicar, e dispensa os 30s de espera por evento.
 */
async function preparar(c) {
    if (LOCAL) {
        // O card VIVE na fase 257, e o webhook do Pipedrive reage a qualquer
        // update de deal que esteja nela. Atualizar os campos sem tirar o card
        // de lá faria a versão PUBLICADA gerar em paralelo com a local — dois
        // geradores no mesmo card, disputando a trava. Aconteceu: sentinela
        // presa no "Link Proposta" e proposta gerada em cenário que não devia.
        //
        // Estacionar em PARADA fecha isso: a rota descarta o evento na
        // checagem de stage antes de chamar o generator.
        await put({ stage_id: PARADA });
        await put({ ...LIMPO, ...c.campos });
        await confirmarEscrita(c.campos);
        const antes = await notas();
        // notifyOnEntry=true reproduz a ENTRADA na fase, que é quando as notas
        // explicativas são postadas — é justamente o que os cenários conferem.
        await generateProposalForDeal(ID, { notifyOnEntry: true });
        return antes;
    }
    await put({ stage_id: PARADA }); await espera(2500);
    await put({ ...LIMPO, ...c.campos }); await espera(2500);
    const antes = await notas();
    await put({ stage_id: FASE });
    await espera(30000);
    return antes;
}

const falhas = [];
// Cenários cuja nota o dedupe engoliu — não são falha, são não-verificados.
const suprimidas = [];
try {
    for (const c of CENARIOS) {
        const antes = await preparar(c);

        const novas = (await notas()).filter((n) => !antes.some((a) => a.id === n.id))
            .map((n) => n.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' '));
        const link = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || '';
        const problemas = [];

        if (c.espera.mantemLink) {
            // A garantia mais importante do fluxo: proposta que já existe nunca
            // é substituída. Vale pro documento que a automação gerou e pro que
            // o closer montou à mão e colou no campo — a automação não sabe (nem
            // precisa saber) a diferença: campo preenchido significa "já tem".
            if (link !== c.espera.mantemLink) problemas.push(`SUBSTITUIU a proposta existente: "${link.slice(0, 60)}"`);
        } else if (c.espera.gera) {
            const info = link ? await docInfo(link) : null;
            if (!link) problemas.push('não gerou');
            // O campo tem algo que não é link de documento — quase sempre a
            // sentinela da trava ("⏳ gerando proposta | ..."), que fica pra
            // trás quando a gravação do link falha. Mostra o valor cru: sem
            // isso, o teste morria com "Cannot read properties of null".
            else if (!info) problemas.push(`campo não tem link de documento: ${JSON.stringify(link.slice(0, 70))}`);
            else {
                if (c.espera.nome && !c.espera.nome.test(info.nome)) problemas.push(`modelo errado: ${info.nome}`);
                for (const s of c.espera.contem || []) if (!info.txt.includes(s)) problemas.push(`faltou "${s}"`);
                for (const s of c.espera.naoContem || []) if (info.txt.includes(s)) problemas.push(`não devia ter "${s}"`);
                if (/\{\{[A-Z_]+\}\}/.test(info.txt)) problemas.push('placeholder solto');
            }
        } else if (link) {
            problemas.push(`gerou quando não devia: ${link.slice(-12)}`);
        }

        // A nota vale nos DOIS ramos. Esta checagem só rodava no "não gera", e
        // cenário que gera parcial — proposta sai, nota diz o que ficou de fora
        // — passava sem ninguém ler a nota, que é justamente o que separa uma
        // proposta incompleta avisada de uma incompleta calada.
        if (c.espera.nota) {
            if (!novas.length) suprimidas.push(c.nome);
            else if (!novas.some((n) => c.espera.nota.test(n))) {
                problemas.push(`nota esperada não veio (veio: ${novas.join(' | ').slice(0, 80)})`);
            }
        }

        if (problemas.length) falhas.push(`${c.nome}: ${problemas.join('; ')}`);
        console.log(`${problemas.length ? '❌' : '✅'} ${c.nome.padEnd(34)} ${problemas.join('; ') || 'ok'}`);
    }
} finally {
    await put({ stage_id: PARADA }); await espera(2000);
    await put(snapshot);
    console.log('\ncard restaurado ao estado inicial');
}

// Nota nenhuma postada não é o mesmo que nota errada: o generator não repete a
// mesma mensagem em 5 min, então numa segunda rodada seguida o cenário fica sem
// o que conferir. Antes isso entrava como FALHA e mandava caçar bug que não
// existe — agora aparece separado, dizendo que o cenário não foi verificado.
if (suprimidas.length) {
    console.log(`\n⚠️  ${suprimidas.length} cenário(s) sem nota nova — dedupe de 5 min, NÃO foram verificados:`);
    console.log(`   ${suprimidas.join(', ')}`);
    console.log('   espere 5 minutos e rode de novo pra cobrir esses.');
}
console.log(falhas.length ? `\n❌ ${falhas.length} cenário(s) com problema` : '\n✅ todos os cenários passaram');
process.exitCode = falhas.length ? 1 : 0;
