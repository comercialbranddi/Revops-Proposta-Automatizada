/**
 * Config da Proposta Automatizada — produtos, templates, campos do Pipedrive,
 * flags. Ver handoff 27/07/2026 (memory da Jessica) pro histórico da decisão.
 *
 * Piloto: trava por PROPOSAL_TEST_DEAL_ID enquanto o conteúdo dos blocos
 * (BB/BBP/GD/VM) não está validado com Sérgio/DT/Miriam.
 */

// ─── Produtos Branddi (mesmos códigos/option IDs do Prospecting Engine —
// ver Lia/src/config/pipelines.js — duplicado aqui de propósito: este repo
// é isolado e não importa nada do Lia). ─────────────────────────────
export const PRODUCTS = {
    BB:  { code: 'BB',  label: 'Brand Bidding',       productPrincipalOptionId: 756 },
    BBP: { code: 'BBP', label: 'Buy Box Protection',  productPrincipalOptionId: 757 },
    GD:  { code: 'GD',  label: 'Golpes Digitais',     productPrincipalOptionId: 758 },
    VM:  { code: 'VM',  label: 'Violação de Marca',   productPrincipalOptionId: 759 },
};

export function getProductByPrincipalOptionId(optionId) {
    if (optionId == null) return null;
    return Object.values(PRODUCTS).find(p => p.productPrincipalOptionId === Number(optionId)) || null;
}

// Ordem de cascata pra escolher o produto-âncora quando há mais de um
// selecionado (mesma lógica do Lia — BB primeiro, produto fundador).
export const PRODUCT_CASCADE_ORDER = ['BB', 'BBP', 'GD', 'VM'];

// ─── Campo "Serviço oferecido" (multi-select) — option IDs confirmados
// via GET /dealFields em 31/07/2026.
export const SERVICO_OFERECIDO_OPTION_TO_CODE = {
    152: 'BB',
    549: 'BBP',
    153: 'GD',
    154: 'VM',
    // "Violação Comercial" é o nome ANTIGO do Buy Box Protection (confirmado
    // com a Jessica em 10/08/2026). A opção continua existindo no campo e ainda
    // é marcada, então aponta pro mesmo modelo. Card com as duas marcadas não
    // vira "BBP+BBP": parseServicoOferecido remove repetição.
    361: 'BBP',
};

// Opções do campo que não têm modelo — não existe proposta escrita pra elas em
// lugar nenhum (procurei nos 33 arquivos da pasta "Modelo Propostas" em
// 11/08/2026: zero ocorrência). Ficam mapeadas só pra conseguir NOMEAR o que
// está fora do fluxo na nota do card; antes eram descartadas em silêncio e um
// deal "BB + Bing" virava proposta só de BB.
export const SERVICO_OFERECIDO_SEM_TEMPLATE = {
    415: 'APP',
    416: 'Bing',
    697: 'Novos Termos',
};

// Duas dessas opções não são serviço, são CANAL de um produto que já existe —
// e agora têm campo próprio. Uso real (57.771 negócios varridos em 11/08/2026):
// APP 18 cards, Bing 7, os dois pela última vez em 28/07/2026. Pouco, mas vivo.
//
// Continuam bloqueando a geração de propósito: gerar ignorando produziria uma
// proposta que não cobre o que foi vendido — o mesmo defeito que já corrigimos.
// O que muda é a nota, que passa a dizer onde marcar em vez de só mandar pro
// manual. Quando ninguém mais marcar aqui, a opção pode sair do campo.
export const SERVICO_QUE_VIROU_CANAL = {
    416: { canal: 'Bing', campo: 'Canais BB' },
    415: { canal: 'Lojas de aplicativos (Apple Store e Play Store)', campo: 'Canais GD' },
};

/**
 * Parseia o valor bruto do campo "Serviço oferecido" (string com IDs
 * separados por vírgula, ex: "152,549").
 *
 * Devolve { codes, semTemplate }: os produtos automatizados e os rótulos dos
 * serviços que não têm modelo. Quem chama PRECISA olhar semTemplate — gerar a
 * proposta ignorando esses itens produz um documento que não cobre o que foi
 * vendido.
 */
export function parseServicoOferecido(rawValue) {
    if (!rawValue) return { codes: [], semTemplate: [], idsSemTemplate: [] };
    const codes = [];
    const semTemplate = [];
    const idsSemTemplate = [];
    for (const raw of String(rawValue).split(',')) {
        const id = Number(raw.trim());
        if (!Number.isFinite(id)) continue;
        const code = SERVICO_OFERECIDO_OPTION_TO_CODE[id];
        // Sem repetir: "Buy Box Protection" e "Violação Comercial" apontam pro
        // mesmo produto, e um card com as duas marcadas viraria "BBP+BBP".
        if (code) { if (!codes.includes(code)) codes.push(code); } else {
            const rotulo = SERVICO_OFERECIDO_SEM_TEMPLATE[id] || `opção ${id}`;
            if (!semTemplate.includes(rotulo)) { semTemplate.push(rotulo); idsSemTemplate.push(id); }
        }
    }
    return { codes, semTemplate, idsSemTemplate };
}

// ─── Feature flags ──────────────────────────────────────────────────
export const PROPOSAL_AUTOMATION_ENABLED = process.env.PROPOSAL_AUTOMATION_ENABLED === 'true';

// Enquanto true (default), só o deal abaixo dispara a geração — trava de piloto.
export const PROPOSAL_TEST_ONLY = process.env.PROPOSAL_TEST_ONLY !== 'false';
export const PROPOSAL_TEST_DEAL_ID = process.env.PROPOSAL_TEST_DEAL_ID
    ? Number(process.env.PROPOSAL_TEST_DEAL_ID)
    : null;

// Secret simples pro endpoint manual de teste (não é o mesmo sistema de auth
// do Lia — este repo é dedicado e pequeno, não precisa de JWT completo).
export const PROPOSAL_ADMIN_TOKEN = process.env.PROPOSAL_ADMIN_TOKEN || null;

// Secret do webhook, passado na query pelo Pipedrive (?secret=...), mesmo
// padrão do webhook do branddi-prospeccao. Sem ele a URL é pública: quem
// souber o endereço dispara geração em qualquer deal.
//
// Enquanto não estiver configurado, o webhook segue aceitando tudo e só loga
// aviso — assim dá pra subir o código antes de mexer na inscrição do
// Pipedrive, sem derrubar o fluxo. Configure a env var e acrescente
// ?secret=<valor> na URL do webhook pra ativar a checagem.
export const PROPOSAL_WEBHOOK_SECRET = process.env.PROPOSAL_WEBHOOK_SECRET || null;

// ─── Pipeline "5. Vendas" ───────────────────────────────────────────
export const SALES_PIPELINE_ID = 1;
export const ENVIO_PROPOSTA_STAGE_ID = 257;

// ─── Templates (Google Doc ID) por chave — chave é o código do produto
// pra 1 produto ("BB") ou os códigos ordenados unidos por "+" pra uma
// combinação ("BB+GD"). Modelos de combinação são PRÉ-GERADOS uma vez
// (prosa de transição escrita na criação, não em tempo real — sem
// dependência de IA no caminho de produção) e cadastrados aqui igual aos
// de produto único. Se o deal tiver uma combinação sem modelo cadastrado,
// a automação pula e o card segue no fluxo manual.
export const PROPOSAL_TEMPLATES = {
    // Bases trocados em 10/08/2026: o time optou por voltar aos modelos que já
    // usava manualmente (pasta "Modelo Propostas"), em vez dos redigidos pro
    // piloto. Estes são cópias daqueles, importadas pro Drive Compartilhado e
    // com os placeholders inseridos — os originais do time seguem intactos.
    // No vocabulário antigo, Fraude (FR) = Golpes Digitais e Violação
    // Comercial (VC) era o nome anterior do Buy Box Protection.
    BB:  { docId: '1HCk8jYDW3TeGMkw_XsIrUY95wZIM4-JdAWq6zBo-Q2Y', label: 'Brand Bidding' },
    BBP: { docId: '1VcqZiITQnPhMdFhceOtYVPCXVuwY8lrXFSE848TOxL8', label: 'Buy Box Protection' },
    GD:  { docId: '1WOIoQHsjKDlGixola3WblqfxgHotINaWiN7Y6u2dbNA', label: 'Golpes Digitais' },
    VM:  { docId: '1iE20XbTEuFXBJw3t2EtXERqwC1ard3yIGrVX0Oi4lxA', label: 'Violação de Marca' },
    // Combinados montados por scripts/monta-combos.js a partir dos quatro
    // bases. Cada um nasce como cópia do base do primeiro produto — é o que
    // traz cabeçalho (logo), rodapé, estilos e configuração de página.
    // Mudou um base? Roda o script de novo e os onze se refazem.
    'BB+BBP': { docId: '1GeVNz340pIh7kRuV2vxsHUxUHmeyHYEbTy5ybB0n22Y', label: 'Brand Bidding + Buy Box Protection' },
    'BB+GD':  { docId: '1VeCzKKjyDHNs6wYX--amaOrnQeg7ZKZzprUgLTl3pzE', label: 'Brand Bidding + Golpes Digitais' },
    'BB+VM':  { docId: '1yH17eXLypVxxk1hBBkYm78MezsVOb34GbpkCbp2QVuE', label: 'Brand Bidding + Violação de Marca' },
    'BBP+GD': { docId: '1aJlaZpm9dnbYIJBlOqlTzEsfppq4seTmmTNBfbpAkR4', label: 'Buy Box Protection + Golpes Digitais' },
    'BBP+VM': { docId: '1UNceMug4sGVaNeK116Rzu5Od7Otf38oi98TL83BYIAA', label: 'Buy Box Protection + Violação de Marca' },
    'GD+VM':  { docId: '1nLaeHqlzbrJo9M-aIAYO3HWZxZLKUYi317f70X7hqz0', label: 'Golpes Digitais + Violação de Marca' },
    'BB+BBP+GD': { docId: '1TLOcEuOz_Ag_lbXX_86r-CI_X5BmJTgThphW6QfyFak', label: 'Brand Bidding + Buy Box Protection + Golpes Digitais' },
    'BB+BBP+VM': { docId: '1jwfNL071JBCqhOX4l2xnu-r5rB6z6_M0uactC0ldo0Y', label: 'Brand Bidding + Buy Box Protection + Violação de Marca' },
    'BB+GD+VM':  { docId: '13RKkuQnCDXIFHUQF9sPnWA-ax5Hg3w8TT8ccGPa1Bz8', label: 'Brand Bidding + Golpes Digitais + Violação de Marca' },
    'BBP+GD+VM': { docId: '1JFz5gWd35cB6ZS8NUXSK_2rsr_Nm7sIorFTchHzRBJw', label: 'Buy Box Protection + Golpes Digitais + Violação de Marca' },
    'BB+BBP+GD+VM': { docId: '1lH_XV-2ncfj0I_55nS7AH-ZsFwT7PFAxSmCC00VPYGQ', label: 'Brand Bidding + Buy Box Protection + Golpes Digitais + Violação de Marca' },
};

export const PROPOSAL_OUTPUT_FOLDER_ID = process.env.PROPOSAL_OUTPUT_FOLDER_ID || null;

// ─── Deal fields (Pipedrive) usados na geração ──────────────────────
// Keys confirmadas via API em 2026-07-27.
export const PROPOSAL_DEAL_FIELDS = {
    PRODUTO_PRINCIPAL:  '94c71c03a56e9f3d6a4f29552b0c9c8c3c4fe3c4',
    SERVICO_OFERECIDO:  'aecc449abaf3039aee8a1c1604fce32ccfc33cc3',
    PRODUTO_PRECO:      '4581d05e90d5af756eb515115ecc9bd1c5caf2a3',
    LINK_PROPOSTA:      '7a8bf5b63b03f730da58a97b1b67c0b5560f9eb4',
    // VALOR_MENSAL / CARENCIA: ainda não existem no Pipedrive — adicionar
    // as keys aqui quando forem criados.
};

// ─── Preço por produto (Pipedrive) — preço é negociado por cliente (não é
// tabela fixa — confirmado com Jessica em 05/08/2026), então o SDR preenche
// o preço de cada produto antes do card chegar em "Envio de proposta".
// Campos criados via API em 05/08/2026 (os 4, pra já deixar pronto se GD/VM
// ganharem preço de tabela no futuro — ver PRICED_PRODUCTS abaixo).
export const PRODUCT_PRICE_FIELDS = {
    BB:  'f687fc2369944a2e91ea7f27e8245ac98aaa9de1',
    BBP: 'be55b1efd1ae499f650cc0439be915b90103416e',
    GD:  '1246a7be1c155e2c87b33cc3c37e4e9739359b24',
    VM:  '6452627c3f1a8e54d47f38477ef7ecdf92f6428f',
};

// Todos os 4 produtos têm preço vindo do card — o SDR preenche o campo de
// cada produto antes de "Envio de proposta" (decisão de 06/08/2026: GD e VM
// entraram junto com BB/BBP, não ficam mais com "preço a confirmar" estático
// no doc). Cada código aqui vira placeholder {{PRECO_<código>}} no template e
// passa a ser obrigatório: sem o campo preenchido, a proposta não é gerada
// (ver generateProposalForDeal).
export const PRICED_PRODUCTS = ['BB', 'BBP', 'GD', 'VM'];

// Tamanho do catálogo do cliente (nº de SKUs monitorados) — só o bloco de
// BBP cita isso ("até XX SKUs na Proposta Comercial"). Varia muito por
// cliente (não é limite fixo de plano, diferente do "até 3 palavras-chave"
// do BB), então também é preenchido pelo SDR antes de "Envio de proposta".
// Campo criado via API em 05/08/2026.
export const CATALOGO_BBP_FIELD = '730d76b0c20d2ab3a62665569899646b9cad143d';

// Quantidade de palavras-chave monitoradas — só o bloco de BB cita ("Até XX
// palavras"). O modelo antigo trazia "Até 3 palavras" fixo, mas as propostas
// reais de agosto/2026 saíram com 2 e com 3: é negociado, igual ao catálogo do
// BBP. Campo criado via API em 10/08/2026.
export const PALAVRAS_BB_FIELD = '0d5efa1df20cbf097c23364d5ea69124f6c126ac';

// Quantidade de marketplaces monitorados — só o bloco de VM cita ("Até N
// marketplaces monitorados simultaneamente"), em dois pontos do documento.
// Campo criado via API em 10/08/2026.
export const PLATAFORMAS_VM_FIELD = '8d6b50fbd2064b2b942f75100aeb432a6a063632';

// ─── Canais monitorados, por produto ────────────────────────────────
// A linha "Plataforma(s) Monitorada(s)" era texto fixo no modelo. Só que as
// propostas reais do time variam MUITO nesse ponto — 18 valores distintos nos
// 33 arquivos da pasta do comercial: "Mercado Livre e Amazon", "… + Google
// Shopping", "Google + Meta + TLD's + Amazon Ads". É assim que Bing e loja de
// aplicativos entram sem precisar de modelo próprio: como canal, não como
// produto. Campos criados via API em 11/08/2026.
export const CANAIS_FIELDS = {
    BB:  '9c5b5764b4a3e138e263bed5bdc65e125465c760',
    BBP: '5fa38fdf8a1eb844324298a8ffa291fc3c71b003',
    GD:  '4b28d56bf13bcb0da4e3d9e4023a54afaa2ff072',
    VM:  '2200631ef8b36b4f7af84c60115f976c00b36575',
};

export const CANAIS_OPTION_TO_LABEL = {
    1592: 'Google Search Ads', 1593: 'Google Shopping', 1594: 'Bing', 1595: 'Amazon Ads',
    1596: 'Mercado Livre', 1597: 'Amazon', 1598: 'Marketplaces',
    1599: 'Google', 1600: 'Meta (Facebook e Instagram)', 1601: "TLD's (Domínios)",
    1602: 'Marketplaces', 1603: 'Lojas de aplicativos (Apple Store e Play Store)',
    1604: 'Marketplaces monitorados simultaneamente', 1605: 'Google Shopping',
    1606: 'Amazon', 1607: 'Mercado Livre',
};

// Usado quando o campo do card está vazio — mantém o que o modelo dizia antes,
// então não preencher nunca piora a proposta. Por isso canal não é obrigatório.
export const CANAIS_PADRAO = {
    BB:  ['Google Search Ads'],
    BBP: ['Mercado Livre'],
    GD:  ['Google', 'Meta (Facebook e Instagram)', "TLD's (Domínios)"],
    VM:  ['Marketplaces monitorados simultaneamente'],
};

// O canal de marketplaces do VM carrega a contagem ("Até 3 marketplaces
// monitorados simultaneamente"), então é o único que se combina com o campo
// de quantidade em vez de aparecer solto.
export const CANAL_VM_COM_CONTAGEM = 'Marketplaces monitorados simultaneamente';

/** Rótulos dos canais escolhidos no card, ou o padrão do produto se vazio. */
export function canaisDoDeal(deal, code) {
    const bruto = deal?.[CANAIS_FIELDS[code]];
    if (!bruto) return CANAIS_PADRAO[code] || [];
    const labels = String(bruto).split(',')
        .map((id) => CANAIS_OPTION_TO_LABEL[Number(id.trim())])
        .filter(Boolean);
    return labels.length ? labels : (CANAIS_PADRAO[code] || []);
}

// Valor fechado do pacote, usado no bloco "De R$ X / Por: R$ Y" das propostas
// combinadas: o "De" é a soma dos preços dos produtos (a automação calcula) e o
// "Por" é o negociado. NÃO é obrigatório — vazio significa "sem desconto", e o
// combo sai listando os produtos com o preço cheio de cada um.
export const VALOR_PACOTE_FIELD = '798658c516d673cf29f1c1cd17e9c56e46977ddf';

// Idioma da proposta. Criado junto com os demais pra já entrar no fluxo de
// preenchimento do closer, mas ainda sem uso: só existe modelo em português.
// Quando houver EN/ES, é esta chave que escolhe o conjunto de modelos.
export const IDIOMA_FIELD = '9c95729a15906d4c92843a4fc2c6e79615f103b8';
export const IDIOMA_OPTION_TO_CODE = { 1588: 'pt', 1589: 'en', 1590: 'es' };

/** True se a automação deve rodar para este deal, dado o estado atual do piloto. */
export function isProposalAutomationEnabledForDeal(dealId) {
    if (!PROPOSAL_AUTOMATION_ENABLED) return false;
    if (!PROPOSAL_TEST_ONLY) return true;
    return PROPOSAL_TEST_DEAL_ID != null && Number(dealId) === PROPOSAL_TEST_DEAL_ID;
}
