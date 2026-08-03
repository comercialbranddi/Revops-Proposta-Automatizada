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
// via GET /dealFields em 31/07/2026. Só mapeia os 4 produtos automatizados;
// outras opções do campo (Violação Comercial, APP, Bing, Novos Termos)
// não têm template e ficam fora do fluxo automático.
export const SERVICO_OFERECIDO_OPTION_TO_CODE = {
    152: 'BB',
    549: 'BBP',
    153: 'GD',
    154: 'VM',
};

/**
 * Parseia o valor bruto do campo "Serviço oferecido" (string com IDs
 * separados por vírgula, ex: "152,549") pros nossos códigos de produto.
 * Ignora opções sem mapeamento (produto não automatizado ainda).
 */
export function parseServicoOferecido(rawValue) {
    if (!rawValue) return [];
    return String(rawValue)
        .split(',')
        .map(id => SERVICO_OFERECIDO_OPTION_TO_CODE[Number(id.trim())])
        .filter(Boolean);
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
    BB:  { docId: '1HLLwQgcidwtfHAf1C2Jgo7yOXDkqOzqzNon-52XC9x4', label: 'Brand Bidding' },
    BBP: { docId: '1GS_3YCW0zgfPhCrEp_u8to6l4uJ4hlk2h4D3572bb_E', label: 'Buy Box Protection' },
    GD:  { docId: '1J00b_DjEcDincmgvscMG28XoJNWu_XcWTqsGvy_jeXM', label: 'Golpes Digitais' },
    VM:  { docId: '15EyaxG9aBNQ2dnu6moiPm_okzY-C3Gw_l5pKJY_ykOA', label: 'Violação de Marca' },
    'BB+BBP': { docId: '1bg2tA4fjsVpl_Y-M4gHWwR137U4y718dDf3vHIbotd4', label: 'Brand Bidding + Buy Box Protection' },
    'BB+GD':  { docId: '1d8kmo07JoeNlB7TtzfwvnSJ2iQjTNlapxe8JvO_Digs', label: 'Brand Bidding + Golpes Digitais' },
    // Demais combinações (BB+VM, BBP+GD, BBP+VM, GD+VM, e as de 3/4 produtos)
    // entram aqui quando forem geradas — ver handoff do Ponto 4.
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

/** True se a automação deve rodar para este deal, dado o estado atual do piloto. */
export function isProposalAutomationEnabledForDeal(dealId) {
    if (!PROPOSAL_AUTOMATION_ENABLED) return false;
    if (!PROPOSAL_TEST_ONLY) return true;
    return PROPOSAL_TEST_DEAL_ID != null && Number(dealId) === PROPOSAL_TEST_DEAL_ID;
}
