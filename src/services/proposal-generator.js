/**
 * Proposta Automatizada — orquestração (piloto, card de teste apenas).
 *
 * Fluxo: deal entra em "Envio de proposta" (pipe Vendas) → busca dados do
 * deal → resolve a combinação de produtos selecionados → copia o modelo
 * certo (1 produto = modelo simples; 2+ produtos = modelo pré-mesclado) →
 * preenche placeholders → escreve o link de volta no campo "Link Proposta"
 * → nota no card.
 *
 * O modelo é escolhido por DOIS eixos: a combinação de produtos e o idioma
 * pedido no card ("Idioma da proposta"). Se não houver modelo naquele idioma,
 * a proposta NÃO é gerada e o card recebe nota explicando — mandar português
 * pra quem pediu inglês é pior que não mandar.
 *
 * Combinações de 2+ produtos usam um modelo PRÉ-GERADO (mesma pasta do
 * Drive, cadastrado em PROPOSAL_TEMPLATES com a chave "BB+GD" etc.) — a
 * prosa de transição entre produtos foi escrita uma vez, na criação desse
 * modelo, não em tempo real. Isso evita qualquer dependência de IA (custo/
 * quota) no caminho de produção — é sempre copyTemplate + replaceAllText,
 * igual pra 1 ou N produtos. Se a combinação do deal não tiver modelo
 * cadastrado ainda, a automação pula e o card segue no fluxo manual.
 */
import { pdGet, pdPut, pdPost } from './pipedrive.js';
import { copyTemplate, replacePlaceholders, shareWithDomain, getDocUrl, findOrCreateFolder } from './google-docs-client.js';
import {
    PROPOSAL_OUTPUT_FOLDER_ID, PROPOSAL_DEAL_FIELDS, PRODUCT_PRICE_FIELDS, PRICED_PRODUCTS,
    CATALOGO_BBP_FIELD, PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD,
    canaisDoDeal, CANAL_VM_COM_CONTAGEM, SERVICO_QUE_VIROU_CANAL, SERVICO_OFERECIDO_SEM_TEMPLATE,
    getProductByPrincipalOptionId, parseServicoOferecido, PRODUCT_CASCADE_ORDER,
    idiomaDoDeal, resolveTemplate, IDIOMA_PADRAO, IDIOMA_LABEL,
} from '../config/proposal.js';
import { getContextLogger } from '../lib/logger.js';
import supabase from './supabase-client.js';

const log = getContextLogger('services:proposal-generator');

// A Vercel roda em UTC. Sem fixar o fuso, toda proposta emitida depois das 21h
// no Brasil sairia datada do dia seguinte — no texto e no nome do arquivo.
const TZ = 'America/Sao_Paulo';

// A data é escrita no idioma da proposta. O fuso continua sendo o de São
// Paulo em todos eles: quem emite está no Brasil, então o "hoje" da proposta
// é o hoje daqui, independente da língua do documento.
const DATA_LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

function formatDate(date = new Date(), idioma = IDIOMA_PADRAO) {
    const locale = DATA_LOCALE[idioma] || DATA_LOCALE[IDIOMA_PADRAO];
    const partes = Object.fromEntries(
        new Intl.DateTimeFormat(locale, { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric' })
            .formatToParts(date).map((p) => [p.type, p.value]),
    );
    const mes = partes.month.charAt(0).toUpperCase() + partes.month.slice(1);
    // Inglês escreve "August 11, 2025"; português e espanhol usam a mesma
    // forma "11 de Agosto de 2025" / "11 de Agosto de 2025".
    if (idioma === 'en') return `${mes} ${Number(partes.day)}, ${partes.year}`;
    return `${partes.day} de ${mes} de ${partes.year}`;
}

/** AAAA-MM-DD no fuso de São Paulo (en-CA já devolve nesse formato). */
function isoDateBR(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(date);
}

// SEMPRE em reais, inclusive em proposta EN/ES. Não é esquecimento: em que
// moeda sai uma proposta em outro idioma (BRL? USD? moeda local?) e de onde
// esse dado vem (campo novo no Pipedrive? o currency do deal?) é decisão
// comercial, não técnica — ainda não foi tomada. Quando for, este é o ponto.
function formatBRL(value) {
    const n = Number(value);
    if (value == null || !Number.isFinite(n)) return null;
    // Preço redondo não mostra centavos; 7900,5 mostra "R$ 7.900,50/mês".
    const casas = Number.isInteger(n) ? 0 : 2;
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}/mês`;
}

/** Valor de campo numérico que conta como "preenchido": número > 0. */
function isPreenchido(value) {
    const n = Number(value);
    return value != null && value !== '' && Number.isFinite(n) && n > 0;
}

// ─── Trava contra geração duplicada ─────────────────────────────────
// O webhook reage a QUALQUER update do card na fase, então dois eventos quase
// simultâneos (troca de fase + alteração de campo, ou retry do Pipedrive)
// chegavam juntos: os dois liam "Link Proposta" vazio, os dois passavam pela
// checagem e os dois geravam um documento. Aconteceu de verdade no piloto —
// dois pares de propostas com 1 segundo de diferença em 05/08/2026.
//
// A trava é o próprio campo "Link Proposta": quem vai gerar escreve antes uma
// sentinela com token único e relê o campo. Como o Pipedrive é last-write-wins,
// só uma das execuções encontra o próprio token na releitura — as outras
// desistem. Não depende do Supabase estar configurado.
const CLAIM_PREFIX = '⏳ gerando proposta';
const CLAIM_RE = /^⏳ gerando proposta \| (\S+) \| (\S+)$/;
// Se uma execução morrer no meio (timeout da Vercel, por exemplo), a sentinela
// fica pra trás. Depois desta janela ela é considerada abandonada e o próximo
// update no card retoma a geração.
const STALE_CLAIM_MS = 5 * 60 * 1000;

const claimValue = (token) => `${CLAIM_PREFIX} | ${new Date().toISOString()} | ${token}`;

function parseClaim(value) {
    const m = typeof value === 'string' && value.match(CLAIM_RE);
    if (!m) return null;
    const at = Date.parse(m[1]);
    return { token: m[2], at, stale: !Number.isFinite(at) || Date.now() - at > STALE_CLAIM_MS };
}

/**
 * Tenta virar o dono da geração deste deal. Devolve true só pra UMA execução
 * concorrente. Escreve a sentinela e confirma relendo o card.
 */
async function claimDeal(dealId) {
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: claimValue(token) });
    const check = await pdGet(`/deals/${dealId}`);
    const claim = parseClaim(check?.data?.[PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]);
    return claim?.token === token;
}

/** Libera a trava (volta o campo pra vazio) quando a geração não vai acontecer. */
async function releaseClaim(dealId) {
    await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: '' })
        .catch((err) => log.warn(`falha ao liberar trava do deal #${dealId}: ${err.message}`));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Posta nota no card. Falha aqui nunca derruba a geração — a nota é aviso,
 * não parte do produto.
 */
async function postNote(dealId, content) {
    try {
        await pdPost('/notes', { deal_id: dealId, content });
    } catch (err) {
        log.warn(`não consegui postar nota no deal #${dealId}: ${err.message}`);
    }
}

// Janela em que uma nota com o mesmo texto é considerada repetida.
const NOTE_DEDUPE_MS = 5 * 60 * 1000;

/**
 * Posta nota evitando repetir a mesma mensagem em janela curta.
 *
 * As notas de entrada ("falta preencher", "proposta já existe") não passam
 * pela trava de geração — ela só é pega bem depois, na hora de copiar o
 * modelo. Se o Pipedrive mandar mais de um evento de entrada pro mesmo fato,
 * o card recebe a nota duas vezes. Este dedupe fecha esse caminho.
 *
 * Falha aqui nunca impede a nota: no erro, posta assim mesmo.
 */
async function postNoteOnce(dealId, content) {
    try {
        const res = await pdGet(`/notes?deal_id=${dealId}&limit=20&sort=add_time%20DESC`);
        const cutoff = Date.now() - NOTE_DEDUPE_MS;
        const key = content.slice(0, 60);
        const repeated = (res?.data || []).some((n) => {
            // add_time vem como "2026-08-07 09:52:42" (UTC, sem marcador).
            const at = Date.parse(`${String(n.add_time).replace(' ', 'T')}Z`);
            const plain = String(n.content || '').replace(/<[^>]*>/g, '');
            return plain.includes(key) && Number.isFinite(at) && at >= cutoff;
        });
        if (repeated) {
            log.info(`deal #${dealId}: nota repetida ignorada ("${key.slice(0, 40)}...")`);
            return;
        }
    } catch (err) {
        log.warn(`dedupe de nota falhou, postando mesmo assim: ${err.message}`);
    }
    await postNote(dealId, content);
}

// Auditoria opcional. A equipe optou por rodar sem Supabase (07/08/2026), então
// na prática isto é no-op: o card é o ÚNICO registro do que aconteceu. É por
// isso que as notas de falha e de "pulei por causa de X" importam tanto aqui.
async function logAttempt(dealId, status, extra = {}) {
    if (!supabase) return;
    try {
        await supabase.from('proposal_generation_log').insert({ deal_id: dealId, status, ...extra });
    } catch (err) {
        log.warn(`falha ao gravar audit log: ${err.message}`);
    }
}

/**
 * Resolve os produtos do deal, na ordem de cascata, junto com os serviços
 * selecionados que não têm modelo automatizado.
 */
function resolveProductCodes(deal) {
    const { codes, semTemplate, idsSemTemplate } = parseServicoOferecido(deal[PROPOSAL_DEAL_FIELDS.SERVICO_OFERECIDO]);
    // Qualquer coisa marcada em "Serviço oferecido" manda — inclusive quando é
    // só serviço sem modelo. Cair pro Produto Principal nesse caso produziria
    // uma proposta que ignora o que o SDR marcou.
    const principal = getProductByPrincipalOptionId(deal[PROPOSAL_DEAL_FIELDS.PRODUTO_PRINCIPAL]);

    if (codes.length > 0 || semTemplate.length > 0) {
        const ordenados = PRODUCT_CASCADE_ORDER.filter((code) => codes.includes(code));
        // Divergência entre os dois campos não muda o resultado (o multi-select
        // manda), mas quase sempre significa "Produto Principal" desatualizado.
        if (principal && ordenados.length && !ordenados.includes(principal.code)) {
            log.warn(`deal #${deal.id}: "Produto Principal" (${principal.code}) não está em "Serviço oferecido" (${ordenados.join('+')}) — usando o Serviço oferecido`);
        }
        return { codes: ordenados, semTemplate, idsSemTemplate, origem: 'servico' };
    }
    // Fallback: sem "Serviço oferecido" preenchido, usa o Produto Principal (single).
    return { codes: principal ? [principal.code] : [], semTemplate: [], idsSemTemplate: [], origem: 'principal' };
}

/**
 * Gera a proposta pro deal informado e escreve o link de volta no Pipedrive.
 * Nunca lança — qualquer falha é logada e o card segue no fluxo manual normal.
 *
 * Se faltar campo obrigatório (preço/catálogo), NÃO gera documento nenhum —
 * só avisa por nota (quando notifyOnEntry=true). O deal fica "pendente"
 * (sem Link Proposta) até alguém preencher o campo; nesse momento, uma nova
 * chamada (disparada por qualquer update no card enquanto ele está na fase
 * "Envio de proposta", ver webhook) encontra os campos completos e gera.
 *
 * notifyOnEntry liga as notas explicativas (falta campo / proposta já existe).
 * Só vem true na ENTRADA na fase, pra não encher o card de nota a cada update.
 */
export async function generateProposalForDeal(dealId, { notifyOnEntry = false } = {}) {
    let claimed = false;
    try {
        const dealRes = await pdGet(`/deals/${dealId}`);
        const deal = dealRes?.data;
        if (!deal) {
            log.warn(`deal #${dealId} não encontrado`);
            await logAttempt(dealId, 'error', { error: 'deal_not_found' });
            return;
        }

        const existingLink = deal[PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA];
        const existingClaim = parseClaim(existingLink);
        if (existingLink && !existingClaim) {
            // Já gerada antes — não regera. Mas avisa na entrada: sem a nota,
            // quem move o card e não vê nada acontecer não consegue distinguir
            // "já existe" de "a automação quebrou".
            if (notifyOnEntry) {
                await postNoteOnce(dealId, 'Proposta já existe neste card (ver o campo "Link Proposta") — não foi gerada de novo. Para gerar outra, limpe o campo "Link Proposta".');
                await logAttempt(dealId, 'skipped_already_generated', { doc_url: existingLink });
            }
            return;
        }
        if (existingClaim && !existingClaim.stale) {
            log.info(`deal #${dealId}: outra execução já está gerando — ignorando este evento`);
            return;
        }
        if (existingClaim) {
            // Limpa já: se este evento parar antes de gerar (falta preço, por
            // exemplo), o card não fica exibindo a sentinela no "Link Proposta".
            log.warn(`deal #${dealId}: trava abandonada há mais de ${STALE_CLAIM_MS / 60000} min — retomando`);
            await releaseClaim(dealId);
        }

        const { codes: productCodes, semTemplate, idsSemTemplate = [], origem } = resolveProductCodes(deal);

        // Serviço vendido sem modelo automatizado (Bing, APP, Violação
        // Comercial, Novos Termos): gerar assim mesmo produziria uma proposta
        // que não cobre o que foi vendido. Vai pro fluxo manual, avisando.
        // Isto BLOQUEAVA a geração inteira, pra não mandar proposta que deixa
        // de fora algo vendido. Na prática era pior: um card "BB + APP" ficava
        // sem nada e o closer refazia à mão o Brand Bidding que já existia
        // pronto — acrescentar um bloco num documento gerado dá muito menos
        // trabalho que montar a proposta do zero.
        //
        // Só bloqueia quando NENHUM produto tem modelo (card só com APP, por
        // exemplo): aí realmente não há o que gerar.
        if (semTemplate.length > 0 && productCodes.length === 0) {
            log.warn(`deal #${dealId}: só "${semTemplate.join(', ')}" no card, nenhum produto com modelo — fluxo manual`);
            if (notifyOnEntry) {
                // A nota é o único canal com o closer, então diz o problema em
                // uma linha e as ações em lista — a versão anterior emendava
                // tudo num parágrafo só e repetia "desmarque de Serviço
                // oferecido" uma vez por item.
                const viraramCanal = idsSemTemplate
                    .map((id) => [SERVICO_OFERECIDO_SEM_TEMPLATE[id], SERVICO_QUE_VIROU_CANAL[id]])
                    .filter(([, canal]) => canal);
                const semSaida = semTemplate.filter((rot) => !viraramCanal.some(([r]) => r === rot));

                const acoes = viraramCanal.map(([, v]) => `• marque "${v.canal}" no campo "${v.campo}"`);
                if (viraramCanal.length) {
                    acoes.push(`• desmarque ${viraramCanal.map(([rot]) => rot).join(' e ')} de "Serviço oferecido"`);
                }
                for (const rot of semSaida) acoes.push(`• ${rot} não tem modelo — essa parte da proposta precisa ser montada à mão`);

                const motivo = viraramCanal.length && !semSaida.length
                    ? `${semTemplate.join(' e ')} não são serviços separados: são canais de monitoramento, e agora têm campo próprio.`
                    : `${semTemplate.join(' e ')} não tem modelo automatizado.`;

                await postNoteOnce(dealId, [
                    'Proposta não gerada automaticamente.',
                    '',
                    `O card tem ${semTemplate.join(', ')} marcado em "Serviço oferecido". ${motivo}`,
                    '',
                    'O que fazer:',
                    ...acoes,
                ].join('\n'));
            }
            await logAttempt(dealId, 'skipped_servico_sem_template', { sem_template: semTemplate });
            return;
        }

        const templateKey = productCodes.join('+'); // "BB" (1 produto) ou "BB+GD" (combinação)
        const idioma = idiomaDoDeal(deal);
        const template = productCodes.length > 0 && resolveTemplate(idioma, templateKey);

        if (!template) {
            log.warn(`deal #${dealId}: sem template pra "${templateKey || 'nenhum produto'}" em ${idioma} — fica no fluxo manual`);
            if (notifyOnEntry) {
                // Antes este caminho era mudo: o card não gerava proposta e não
                // dizia nada, e quem moveu não conseguia distinguir de "a
                // automação quebrou". A nota nomeia o motivo certo dos dois.
                const existeEmPt = templateKey && resolveTemplate(IDIOMA_PADRAO, templateKey);
                const idiomaNome = IDIOMA_LABEL[idioma] || idioma;
                await postNoteOnce(dealId, !templateKey
                    ? 'Proposta NÃO gerada — o card não tem produto identificável em "Serviço oferecido" nem em "Produto Principal". Preencha um dos dois.'
                    : existeEmPt
                        ? [
                            // O idioma e a combinação vêm na PRIMEIRA linha de
                            // propósito: postNoteOnce deduplica pelos 60
                            // primeiros caracteres, e um cabeçalho genérico
                            // faria a nota de espanhol ser engolida como
                            // repetição da de inglês num card que trocasse de
                            // idioma dentro da janela de 5 minutos.
                            `Proposta em ${idiomaNome} NÃO gerada — ainda não existe modelo de ${templateKey} nesse idioma.`,
                            '',
                            'O que fazer:',
                            `• monte esta proposta à mão em ${idiomaNome}, ou`,
                            '• mude o campo "Idioma da proposta" para Português, se ela puder sair em português',
                        ].join('\n')
                        : `Proposta NÃO gerada — não existe modelo automatizado para a combinação ${templateKey}. Monte a proposta manualmente e avise o RevOps.`);
            }
            await logAttempt(dealId, 'skipped_no_template', { product_code: templateKey || null, idioma });
            return;
        }

        // A organização vira {{MARCA}} no corpo da proposta e dá nome à pasta do
        // cliente no Drive. Sem ela o documento sai dizendo "monitoramento da
        // marca Cliente" — por isso é obrigatória, igual preço, em vez de ter um
        // valor padrão.
        const orgName = deal.org_name || deal.org_id?.name || null;
        // O "Para:" da proposta leva o nome da EMPRESA, não o do contato
        // (decisão do time em 10/08/2026). É como os modelos antigos sempre
        // funcionaram: o mesmo marcador "XXX" servia pro destinatário e pra
        // marca no corpo do texto. {{DECISOR}} segue mapeado porque os modelos
        // combinados ainda o contêm — assim eles já saem certos, antes mesmo de
        // serem regerados.

        // Preço é negociado por cliente (não é tabela fixa), então cada
        // produto tem seu próprio campo no Pipedrive (preenchido pelo SDR) e
        // seu próprio placeholder no doc ({{PRECO_BB}}, {{PRECO_BBP}},
        // {{PRECO_GD}}, {{PRECO_VM}}) — vale igual pra proposta de produto
        // único ou combinação.
        const pricedCodes = productCodes.filter((code) => PRICED_PRODUCTS.includes(code));
        const priceReplacements = Object.fromEntries(pricedCodes.map((code) => [
            `{{PRECO_${code}}}`,
            formatBRL(deal[PRODUCT_PRICE_FIELDS[code]]),
        ]));
        // "Preenchido" é número > 0: zero não é preço nem tamanho de catálogo,
        // e antes passava na checagem e saía "R$ 0/mês" na proposta.
        const missingFields = [];
        if (!orgName) missingFields.push('Organização do negócio (o nome dela vai no texto da proposta)');
        missingFields.push(...pricedCodes
            .filter((code) => !isPreenchido(deal[PRODUCT_PRICE_FIELDS[code]]))
            .map((code) => `Preço ${code}`));

        // Catálogo (nº de SKUs) só aparece no bloco de BBP ("até XX SKUs")
        // e varia por cliente, então também vem do card (preenchido pelo SDR).
        const catalogoBBP = productCodes.includes('BBP') ? deal[CATALOGO_BBP_FIELD] : null;
        if (productCodes.includes('BBP') && !isPreenchido(catalogoBBP)) missingFields.push('Catálogo BBP (SKUs)');

        // Mesma ideia pro bloco de BB ("Até XX palavras"): o modelo trazia 3
        // fixo, mas as propostas reais saem com 2 ou 3 conforme a negociação.
        const palavrasBB = productCodes.includes('BB') ? deal[PALAVRAS_BB_FIELD] : null;
        if (productCodes.includes('BB') && !isPreenchido(palavrasBB)) missingFields.push('Palavras-chave BB (qtd)');

        // E no VM ("Até N marketplaces monitorados simultaneamente").
        const plataformasVM = productCodes.includes('VM') ? deal[PLATAFORMAS_VM_FIELD] : null;
        if (productCodes.includes('VM') && !isPreenchido(plataformasVM)) missingFields.push('Plataformas VM (qtd)');

        // Canais monitorados de cada produto. O canal de marketplaces do VM é o
        // único que carrega a contagem, então se junta ao campo de quantidade;
        // os demais entram como estão. Campo vazio cai no padrão do produto,
        // que é o texto que o modelo já trazia — por isso nunca é obrigatório.
        const canaisPorProduto = Object.fromEntries(productCodes.map((code) => {
            const labels = canaisDoDeal(deal, code).map((label) => (
                code === 'VM' && label === CANAL_VM_COM_CONTAGEM
                    ? `Até ${Number(plataformasVM) || 3} ${label.charAt(0).toLowerCase()}${label.slice(1)}`
                    : label
            ));
            return [code, labels];
        }));
        // No combo, a união dos canais de todos os produtos, sem repetir.
        const canaisCombo = [...new Set(productCodes.flatMap((c) => canaisPorProduto[c]))].join(' + ');

        // Bloco do combo — só existe em proposta combinada, e ocupa duas linhas
        // ("De …" / "Por: …") como nos modelos que o time montava à mão. Sem
        // valor fechado no card não há desconto: a primeira linha leva a soma e
        // a segunda some. Nunca é obrigatório preencher.
        const soma = pricedCodes.reduce((n, code) => n + Number(deal[PRODUCT_PRICE_FIELDS[code]] || 0), 0);
        const valorPacote = deal[VALOR_PACOTE_FIELD];
        const comDesconto = productCodes.length > 1 && isPreenchido(valorPacote);
        const totalDe = productCodes.length > 1
            ? (comDesconto ? `De ${formatBRL(soma)}` : formatBRL(soma))
            : null;
        const totalPor = productCodes.length > 1
            ? (comDesconto ? `Por: ${formatBRL(valorPacote)}` : '')
            : null;

        if (missingFields.length > 0) {
            log.warn(`deal #${dealId}: falta ${missingFields.join(', ')} — proposta não gerada ainda`);
            if (notifyOnEntry) {
                await postNoteOnce(dealId, `Proposta NÃO gerada — falta preencher ${missingFields.join(', ')} no card. Assim que for preenchido, a proposta é gerada automaticamente.`);
            }
            await logAttempt(dealId, 'skipped_missing_fields', { missing: missingFields, notified: notifyOnEntry });
            return;
        }

        // A trava só é pega aqui, depois de todas as checagens baratas — assim
        // um card com preço faltando não fica escrevendo no campo a cada update.
        claimed = await claimDeal(dealId);
        if (!claimed) {
            log.info(`deal #${dealId}: outra execução ganhou a trava — ignorando este evento`);
            await logAttempt(dealId, 'skipped_concurrent', { template_used: templateKey });
            return;
        }

        // Uma pasta por cliente, e o nº do card no nome — quem abre o doc pelo
        // Drive consegue voltar pro Pipedrive sem caçar.
        // Sufixo de idioma só quando não é português, pra não renomear o padrão
        // do que já está no Drive.
        const sufixoIdioma = idioma === IDIOMA_PADRAO ? '' : `_${idioma}`;
        const newName = `Proposta_${orgName}_${templateKey}${sufixoIdioma}_${isoDateBR()}_deal${dealId}`;
        let destFolderId = PROPOSAL_OUTPUT_FOLDER_ID;
        try {
            destFolderId = await findOrCreateFolder(orgName, PROPOSAL_OUTPUT_FOLDER_ID) || PROPOSAL_OUTPUT_FOLDER_ID;
        } catch (err) {
            // Problema de pasta não pode custar a proposta — cai pra raiz.
            log.warn(`pasta do cliente "${orgName}" falhou, salvando na raiz: ${err.message}`);
        }
        const copyId = await copyTemplate(template.docId, newName, destFolderId);

        // "XX de [mês] de [ano]" é substituído como frase única — o "XX" de
        // catálogo já foi trocado por {{CATALOGO_BBP}} nos templates, então
        // não colide mais com a data.
        //
        // As duas chaves de data vão juntas de propósito. A frase literal é o
        // que os 15 modelos em português trazem hoje; {{DATA}} é a convenção
        // pros modelos novos, em qualquer idioma — a frase em português
        // obviamente não existe num documento em inglês, e sem {{DATA}} a data
        // simplesmente não seria substituída, em silêncio. Mandar as duas é
        // seguro: replacePlaceholders só descarta valor null, e a chave que não
        // existir no documento vira um replaceAllText sem ocorrência.
        const dataProposta = formatDate(new Date(), idioma);
        await replacePlaceholders(copyId, {
            'XX de [mês] de [ano]': dataProposta,
            '{{DATA}}': dataProposta,
            '{{MARCA}}': orgName,
            '{{DECISOR}}': orgName,
            // Number() evita "150.0" virar texto no documento.
            '{{CATALOGO_BBP}}': catalogoBBP != null ? String(Number(catalogoBBP)) : null,
            '{{PALAVRAS_BB}}': palavrasBB != null ? String(Number(palavrasBB)) : null,
            '{{PLATAFORMAS_VM}}': plataformasVM != null ? String(Number(plataformasVM)) : null,
            ...Object.fromEntries(productCodes.map((code) => [`{{CANAIS_${code}}}`, canaisPorProduto[code].join(' + ')])),
            '{{CANAIS_COMBO}}': productCodes.length > 1 ? canaisCombo : null,
            '{{TOTAL_DE}}': totalDe,
            '{{TOTAL_POR}}': totalPor,
            ...priceReplacements,
        });

        await shareWithDomain(copyId).catch((err) => {
            log.warn(`shareWithDomain falhou (não bloqueante): ${err.message}`);
        });

        const docUrl = getDocUrl(copyId);

        // Gravar o link é o passo que não pode falhar em silêncio: enquanto ele
        // não entra, o campo ainda tem a sentinela da trava, que vence em 5 min
        // e faz o próximo update gerar uma segunda proposta.
        let linkSaved = false;
        for (let attempt = 1; attempt <= 3 && !linkSaved; attempt++) {
            try {
                await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: docUrl });
                linkSaved = true;
            } catch (err) {
                log.warn(`deal #${dealId}: tentativa ${attempt}/3 de gravar o link falhou — ${err.message}`);
                if (attempt < 3) await sleep(500 * attempt);
            }
        }

        if (!linkSaved) {
            // O documento existe; quem falhou foi o Pipedrive. Entrega o link
            // pela nota pra ninguém precisar refazer a proposta. Colar o link
            // no campo também desarma a sentinela e evita a segunda geração.
            log.error(`deal #${dealId}: proposta gerada mas o link não foi gravado — ${docUrl}`);
            await postNote(dealId, `Proposta gerada, mas NÃO consegui gravar o campo "Link Proposta" (falha no Pipedrive). Cole o link abaixo no campo manualmente — isso também evita que uma segunda proposta seja gerada:\n${docUrl}`);
            await logAttempt(dealId, 'error', { error: 'link_write_failed', template_used: templateKey, doc_url: docUrl });
            return;
        }

        // Quando o produto veio do "Produto Principal" (porque "Serviço
        // oferecido" estava vazio), a nota diz de onde saiu — é o caso em que a
        // automação tem mais chance de escolher o modelo errado sem ninguém ver.
        const origemAviso = origem === 'principal'
            ? `\n\nAtenção: o produto foi deduzido do campo "Produto Principal" porque "Serviço oferecido" está vazio. Confira se ${templateKey} é mesmo o que foi vendido.`
            : '';
        // Servico vendido sem modelo: a proposta saiu, mas incompleta. O aviso
        // fica na MESMA nota do link — em nota separada corre o risco de o
        // closer ler so a do link e mandar faltando um bloco.
        // Serviço vendido sem modelo: a proposta saiu, mas incompleta. O aviso
        // fica na MESMA nota do link — em nota separada corre o risco de o
        // closer ler só a do link e mandar faltando um bloco.
        const faltaAviso = semTemplate.length
            ? `\n\nAtenção: esta proposta NÃO cobre ${semTemplate.join(' e ')}, que não tem modelo automatizado. Acrescente esse bloco à mão antes de enviar.`
            : '';
        await postNote(dealId, `Proposta gerada automaticamente (piloto) — revisar conteúdo antes de enviar.\n${docUrl}${origemAviso}${faltaAviso}`);

        log.info(`✅ Proposta gerada pro deal #${dealId} (${templateKey}, ${idioma}): ${docUrl}`);
        await logAttempt(dealId, 'success', { template_used: templateKey, idioma, doc_url: docUrl });
    } catch (err) {
        log.error(`deal #${dealId} falhou: ${err.message}`);
        // Sem isso a sentinela ficaria no card até a janela de abandono vencer —
        // liberando na hora, o próximo update do card já pode tentar de novo.
        if (claimed) await releaseClaim(dealId);
        // Sem banco de auditoria, o card é o único lugar onde o time enxerga
        // que deu errado. Sem esta nota, falha é indistinguível de "não fez
        // nada" pra quem está olhando o Pipedrive.
        await postNoteOnce(dealId, `Proposta NÃO gerada — erro técnico na automação: ${String(err.message).slice(0, 200)}. Monte a proposta manualmente e avise o RevOps.`);
        await logAttempt(dealId, 'error', { error: err.message });
    }
}
