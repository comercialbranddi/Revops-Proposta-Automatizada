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
// lugar nenhum. Ficam mapeadas só pra conseguir NOMEAR o que está fora do fluxo
// na nota do card; antes eram descartadas em silêncio e um deal "BB + Bing"
// virava proposta só de BB.
export const SERVICO_OFERECIDO_SEM_TEMPLATE = {
    415: 'APP',
    416: 'Bing',
    697: 'Novos Termos',
};

// Estas opções não são serviço, são CANAL de um produto que já existe — e agora
// têm campo próprio. Uso real (57.771 negócios varridos em 11/08/2026):
// APP 18 cards, Bing 7, os dois pela última vez em 28/07/2026. Pouco, mas vivo.
//
// Continuam bloqueando a geração de propósito: gerar ignorando produziria uma
// proposta que não cobre o que foi vendido — o mesmo defeito que já corrigimos.
// O que muda é a nota, que passa a dizer onde marcar em vez de só mandar pro
// manual. Quando ninguém mais marcar aqui, a opção pode sair do campo.
// A opção "Bing" foi REMOVIDA do campo em 11/08/2026 — ninguém consegue mais
// marcar. O mapeamento fica porque um card antigo ainda pode carregar o id 416
// gravado (o Pipedrive limpou a maioria, mas não todos), e nesse caso a nota
// ainda explica o que fazer em vez de dizer só "sem modelo".
//
// APP entrou aqui em 12/08/2026, e a evidência veio das propostas de App Store
// que o time enviou pra Jusbrasil (29/04 e 30/07/2026): são a proposta de Brand
// Bidding com a caixa "Plataforma(s) Monitorada(s)" trocada. Mesmo texto de
// proteções, mesmos entregáveis, mesmas condições. Antes disso APP ficava em
// SERVICO_OFERECIDO_SEM_TEMPLATE puro, e um card "BB + APP" gerava proposta de
// BB com um aviso pedindo pra escrever o bloco de APP à mão — bloco que não
// existia escrito em lugar nenhum.
//
// `produto` é o código do produto dono do canal. Sem ele a nota mandava marcar
// o canal e desmarcar o serviço, mas não dizia pra marcar o produto — num card
// só com "APP" o closer seguia a instrução ao pé da letra e ficava com o card
// vazio, sem proposta e sem entender por quê.
export const SERVICO_QUE_VIROU_CANAL = {
    415: { canal: 'App Store (ASA e Play Store)', canalId: 1609, campo: 'Canais BB', produto: 'BB' },
    416: { canal: 'Bing', canalId: 1594, campo: 'Canais BB', produto: 'BB' },
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

// "Proposta enviada". O card chega aqui vindo de "Envio de proposta", mas
// também direto de outras etapas — e nesses o closer ficava sem o link do
// formulário, que só era entregue na 257. Pedido da Jessica em 27/08/2026.
export const PROPOSTA_ENVIADA_STAGE_ID = 511;

// As etapas em que o link do formulário é entregue (campo + nota). NÃO é a
// lista que dispara a geração do documento antigo, que segue só na 257: gerar
// em "Proposta enviada" produziria proposta nova pra um card cuja proposta já
// foi mandada ao cliente.
export const ETAPAS_COM_LINK_FORM = [ENVIO_PROPOSTA_STAGE_ID, PROPOSTA_ENVIADA_STAGE_ID];

// ─── Templates (Google Doc ID) por IDIOMA e por chave — chave é o código
// do produto pra 1 produto ("BB") ou os códigos ordenados unidos por "+"
// pra uma combinação ("BB+GD"). Modelos de combinação são PRÉ-GERADOS uma
// vez (prosa de transição escrita na criação, não em tempo real — sem
// dependência de IA no caminho de produção) e cadastrados aqui igual aos
// de produto único. Se o deal tiver uma combinação sem modelo cadastrado,
// a automação pula e o card segue no fluxo manual.
//
// O primeiro nível é o idioma pedido no card (ver IDIOMA_FIELD). Só o
// português está completo; en/es começam vazios de propósito, pra deixar a
// cobertura real visível de bate e pro fluxo ter onde cair. Ver
// HANDOFF-IDIOMAS.md §3 pros arquivos que o comercial já tem em outro
// idioma.
export const PROPOSAL_TEMPLATES = {
    pt: {
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
        'BB+BBP': { docId: '1yDPQzS9-u5KVgKeYo7QUoPs1cDvpn2jV3BoAhSCTWUE', label: 'Brand Bidding + Buy Box Protection' },
        'BB+GD':  { docId: '1UIRSAKaw16u-ZVMA2Zat37FfdGXmFmDrQAUW2-4O22c', label: 'Brand Bidding + Golpes Digitais' },
        'BB+VM':  { docId: '1SHL-NOhQe6tznsoe9LyH5Z-auC6CMgh6Iiyj4WczZrE', label: 'Brand Bidding + Violação de Marca' },
        'BBP+GD': { docId: '1XoVyxAgHFMhUB1BK2HEw8_6eTGlwRrEdXJv7XnKEphc', label: 'Buy Box Protection + Golpes Digitais' },
        'BBP+VM': { docId: '19mGSpe1CeSxPOUkG7ldE78hc7WF9ToH-ngvT9rGCe20', label: 'Buy Box Protection + Violação de Marca' },
        'GD+VM':  { docId: '1cwVbT6tNs2xyc8h7JAT1tjHOWx-R1QwZzbPiBRGLosA', label: 'Golpes Digitais + Violação de Marca' },
        'BB+BBP+GD': { docId: '1bliDCtohNNk4N36yow-n8-VVqLyaQEzRGlXH5YrWdRQ', label: 'Brand Bidding + Buy Box Protection + Golpes Digitais' },
        'BB+BBP+VM': { docId: '12Zu1unrnEtZD6zjZzZtYkOu5xewvBKCY4npU92Xbshg', label: 'Brand Bidding + Buy Box Protection + Violação de Marca' },
        'BB+GD+VM':  { docId: '1sYyt35HguTEH2JXPg2YChPVmX1dFCOh8-1vfYiVPoFc', label: 'Brand Bidding + Golpes Digitais + Violação de Marca' },
        'BBP+GD+VM': { docId: '1apNwQXtAYpz5dsI9GwEL05iM0UWYCjOe3ljoIl0zObs', label: 'Buy Box Protection + Golpes Digitais + Violação de Marca' },
        'BB+BBP+GD+VM': { docId: '1kY_0K18VUWY86fcWzQ3lQD0i1M6RufArLvS7EzR38uc', label: 'Brand Bidding + Buy Box Protection + Golpes Digitais + Violação de Marca' },
    },
    // Traduzidos do português em 11/08/2026 por scripts/traduz-bases.js, não
    // importados dos documentos antigos do comercial: aqueles vendiam contrato
    // anual com fidelidade, que o time não pratica (ver AUDITORIA-IDIOMAS.md).
    // A prosa reaproveita o vocabulário deles; as condições vêm do português.
    en: {
        BB:  { docId: '1BVxDQuZD2efYKZsmpmPPnXKIURiho9udmLqkBpBkUZs', label: 'Brand Bidding' },
        BBP: { docId: '1WZUS5tkWsXPpKmyTVOcaCIEBxzbPLr710fcuggCxb04', label: 'Buy Box Protection' },
        GD:  { docId: '1piVics87KdnNwzsljEtw9LvZKvKmzgMth1nBKXbCpZY', label: 'Digital Fraud Protection' },
        VM:  { docId: '1sWr2iXyl_vSbKGEhVy72tw3n211OOxGb7xH4jAVlkac', label: 'Intellectual Property Infringement' },
        // Montados por monta-combos.js --idioma=en a partir dos quatro acima,
        // igual ao português. Mudou um base? Roda o script de novo.
        'BB+BBP': { docId: '1-lM6KdT1xvx3ohIROS4B8_K9scn-avc02L2jFLS1Joo', label: 'Brand Bidding + Buy Box Protection' },
        'BB+GD':  { docId: '1fkexxxxwSy_4YiN8lb15QB9uN5whBEQxcni2eKJYWS0', label: 'Brand Bidding + Digital Fraud Protection' },
        'BB+VM':  { docId: '1945ik2sP9uhkP6dTE5kQwJ0LifH3Leq5GVWvoHsi0Ss', label: 'Brand Bidding + Intellectual Property Infringement' },
        'BBP+GD': { docId: '1Yyhj4e5LnZhM24T9A0N9UpL8n3yQm46Gh1RIERSRwv8', label: 'Buy Box Protection + Digital Fraud Protection' },
        'BBP+VM': { docId: '1n7Vc-b9Bmhv_nHXRbozDqjCEug30is9Zjeq9Y-eO790', label: 'Buy Box Protection + Intellectual Property Infringement' },
        'GD+VM':  { docId: '1KdR3g4R0UBkemtk0_J2o4mnpDJk-5EQ_WUoIFtQtLhA', label: 'Digital Fraud Protection + Intellectual Property Infringement' },
        'BB+BBP+GD': { docId: '19fGnPkUUJrhrBh2Aly8iklC-hxBojVz_xhwgDSt_2yk', label: 'Brand Bidding + Buy Box Protection + Digital Fraud Protection' },
        'BB+BBP+VM': { docId: '1a_NgWKyIlRggUv5hMRj7KxqDU4kJbLcF4t1SsH10z-w', label: 'Brand Bidding + Buy Box Protection + Intellectual Property Infringement' },
        'BB+GD+VM':  { docId: '1-odqeSdLyaYYBboEFZPS0lxfgQdNHbD9xf9VrvKpDkc', label: 'Brand Bidding + Digital Fraud Protection + Intellectual Property Infringement' },
        'BBP+GD+VM': { docId: '1qqGQ_AfpNCurADsqBzz2Cvggl5BlRrq9sL7gDGb2PVo', label: 'Buy Box Protection + Digital Fraud Protection + Intellectual Property Infringement' },
        'BB+BBP+GD+VM': { docId: '1iBFKEWwYNmFzkDo23Pskh0Lw94oH5mwL7nCQ4usQbsA', label: 'Brand Bidding + Buy Box Protection + Digital Fraud Protection + Intellectual Property Infringement' },
    },
    // Mesmo caminho do inglês: traduzidos do português, com o vocabulário dos
    // documentos que o comercial já tinha em espanhol ("Nuestras Protecciones",
    // "Protección Brand Bidding", "Palabras clave: hasta N palabras").
    es: {
        BB:  { docId: '1UfM_IG8Di7QZ9wG9zvtc_z2UHLUYUu-L9sLvq0obL94', label: 'Brand Bidding' },
        BBP: { docId: '1ySn8KnhGhoYbgEIe5e_bQyvQaHXhP-nKw8dtg5jKvD4', label: 'Buy Box Protection' },
        GD:  { docId: '1TtiI-o0vzBvj9c2qNIwWv-psA9FEYO0tw2yg9dPyugM', label: 'Protección Fraude' },
        VM:  { docId: '1GWp5h_mMMJID53DnN2-G62BDqoXjxgfTPYgG9ETnKVM', label: 'Violación de Propiedad Intelectual' },
        // Montados por monta-combos.js --idioma=es a partir dos quatro acima.
        'BB+BBP': { docId: '1rbu9XKJmNLZSFvFwdljKhLx-Gih1b29X1b_cmwMTUXc', label: 'Brand Bidding + Buy Box Protection' },
        'BB+GD':  { docId: '19fi11C8qkIyCl60AZrgBzDUO06aOHOrafhuy5ikSEzs', label: 'Brand Bidding + Protección Fraude' },
        'BB+VM':  { docId: '11HV3aemOvApSW-AStD_JSv116wok2k3HgpZev9mk82M', label: 'Brand Bidding + Violación de Propiedad Intelectual' },
        'BBP+GD': { docId: '1Mh2HJcvkWeJUybDRbA6Ygo5t2BtYo7CoNFwynG2gQis', label: 'Buy Box Protection + Protección Fraude' },
        'BBP+VM': { docId: '1SS9VUEHZ8sUlhBEjLM0AYjICfPa8rqtyTrzgpEasyTU', label: 'Buy Box Protection + Violación de Propiedad Intelectual' },
        'GD+VM':  { docId: '1CM-cBy2G3CVn5uxORescFHbpGtv0UJ0r4nrcd6zVeFg', label: 'Protección Fraude + Violación de Propiedad Intelectual' },
        'BB+BBP+GD': { docId: '10WTQrjAzRIjps9Gv1pmjldVS8mVb3tTxRgbWWx8CPuU', label: 'Brand Bidding + Buy Box Protection + Protección Fraude' },
        'BB+BBP+VM': { docId: '1ORBImoBhT7_wMNjPK_LuCrX58WjwPs9r57rxcwMGjOs', label: 'Brand Bidding + Buy Box Protection + Violación de Propiedad Intelectual' },
        'BB+GD+VM':  { docId: '1ZAcUyry_vTjn9Hi83Mxw5AtdXE-JCWQ1uug7eprvZuU', label: 'Brand Bidding + Protección Fraude + Violación de Propiedad Intelectual' },
        'BBP+GD+VM': { docId: '1Idfyy9Tux7KxCvCc3a-dc1HjJqSzvU_K7TetvHBFZOA', label: 'Buy Box Protection + Protección Fraude + Violación de Propiedad Intelectual' },
        'BB+BBP+GD+VM': { docId: '1wwMkhDKIzh-Ay-NR5wDvspZFZi2tGu2TCngTYJiP0OE', label: 'Brand Bidding + Buy Box Protection + Protección Fraude + Violación de Propiedad Intelectual' },
    },
};

export const PROPOSAL_OUTPUT_FOLDER_ID = process.env.PROPOSAL_OUTPUT_FOLDER_ID || null;

// ─── Deal fields (Pipedrive) usados na geração ──────────────────────
// Keys confirmadas via API em 2026-07-27.
export const PROPOSAL_DEAL_FIELDS = {
    PRODUTO_PRINCIPAL:  '94c71c03a56e9f3d6a4f29552b0c9c8c3c4fe3c4',
    SERVICO_OFERECIDO:  'aecc449abaf3039aee8a1c1604fce32ccfc33cc3',
    PRODUTO_PRECO:      '4581d05e90d5af756eb515115ecc9bd1c5caf2a3',
    LINK_PROPOSTA:      '7a8bf5b63b03f730da58a97b1b67c0b5560f9eb4',
    // O link do formulário. Existia só como nota na timeline, postada na
    // entrada da etapa — e nota some no meio das outras: quem volta ao card
    // dias depois rola atrás dela. Como campo, fica ao lado do "Link Proposta".
    // Criado em 27/08/2026 por scripts/campo-form-link.js.
    FORM_PROPOSTA:      '02736dc5cf97f2de60267f177957fa00eb013097',
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

// ─── Faixas de preço do Brand Bidding ───────────────────────────────
// Parte das propostas de BB não tem preço único: tem escada por quantidade de
// palavras-chave. A primeira que apareceu foi a da Hotmilhas, em 13/08/2026:
//
//     Proposta:
//     Até 10 palavras-chave: R$ 24.900/mês
//     Até 20 palavras-chave: R$ 34.900/mês
//     Até 30 palavras-chave: R$ 42.900/mês
//
// A FAIXA 1 são os campos que já existiam — PALAVRAS_BB_FIELD e o preço de BB.
// Só as faixas 2 e 3 ganharam campo (via API, 13/08/2026), e as duas são
// OPCIONAIS: escada é exceção, não regra. Card sem elas gera com preço único e
// a linha "Palavras-chave: Até N palavras.", exatamente como sempre gerou.
//
// Três faixas porque é o que a única proposta real usa. Se aparecer uma com
// quatro, o caminho é acrescentar um par aqui — o resto do código não conta
// faixas, percorre a lista.
export const FAIXAS_BB_FIELDS = [
    { qtd: '39b216ad3018c93298bc322eed75727c96f05d5f', preco: '012cab9fadd1009b9d5abe8f32174e74473e1c5d' },
    { qtd: '4222fd021b4bde29d365cac259ef2134ebdd88f3', preco: '5a879c7502a72d1fcb9b5ce08a0254060ad2a1c0' },
];

/**
 * As faixas de preço de BB do card, da menor pra maior — sempre com a faixa 1
 * (campos antigos) na frente.
 *
 * Devolve também o que está pela metade: quantidade sem preço, ou preço sem
 * quantidade. Quem chama precisa barrar esses casos, senão a proposta sai com
 * uma linha faltando valor e ninguém percebe.
 */
export function faixasBBDoDeal(deal) {
    const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    // `nomeQtd`/`nomePreco` são os rótulos EXATOS dos campos no Pipedrive. A
    // nota de pendência cita o campo pelo nome que o closer vê na tela, em vez
    // de dizer "faixa 2 pela metade" e deixá-lo procurar qual metade.
    const pares = [
        {
            qtd: num(deal?.[PALAVRAS_BB_FIELD]), preco: num(deal?.[PRODUCT_PRICE_FIELDS.BB]),
            nomeQtd: 'Palavras-chave BB (qtd)', nomePreco: 'Preço BB',
        },
        ...FAIXAS_BB_FIELDS.map((f, i) => ({
            qtd: num(deal?.[f.qtd]), preco: num(deal?.[f.preco]),
            nomeQtd: `BB faixa ${i + 2} - palavras-chave (qtd)`, nomePreco: `BB faixa ${i + 2} - preço`,
        })),
    ];
    // Faixa em branco é faixa não usada — some sem reclamar. Só as tocadas
    // pela metade viram pendência.
    const usadas = pares.filter((p) => p.qtd != null || p.preco != null);
    return {
        faixas: usadas,
        // Nomes dos campos que faltam, não "faixa N pela metade". Além de dizer
        // ao closer onde clicar, faz a nota de cada faixa começar diferente —
        // postNoteOnce compara os 60 primeiros caracteres, e com o texto antigo
        // as pendências de faixa 2 e de faixa 3 saíam idênticas nesse trecho e
        // uma engolia a outra.
        incompletas: usadas.flatMap((p) => [
            ...(p.qtd > 0 ? [] : [p.nomeQtd]),
            ...(p.preco > 0 ? [] : [p.nomePreco]),
        ]),
        // Uma faixa só é o preço único de sempre; duas ou mais viram escada.
        escada: usadas.length > 1,
    };
}

// ─── Faixas de preço do Buy Box Protection ──────────────────────────
// Mesma ideia da escada do BB (ver FAIXAS_BB_FIELDS acima), com duas
// diferenças pedidas pela Jessica em 14/08/2026: 4 faixas com preço (não 3),
// e uma 5ª faixa SEM preço numérico — "Acima de 200 SKUs: Sob Consulta".
//
// A FAIXA 1 são os campos que já existiam — CATALOGO_BBP_FIELD e o preço de
// BBP. As faixas 2, 3 e 4 são campo novo (via API, 14/08/2026), e as três são
// OPCIONAIS: card sem elas gera com preço único, exatamente como sempre.
export const FAIXAS_BBP_FIELDS = [
    { qtd: '776d4e0493ef1a535f619f98216e76bc24dd2b06', preco: 'e1e2f26ad0db098de914e8259de3ab1fa5470353' }, // faixa 2
    { qtd: 'e1e70f631c0b4db55b4c91172aa5ed1546254167', preco: 'f1729108caa7368ac23498e25bfd9a7441064b58' }, // faixa 3
    { qtd: 'c2fd3dae1df1d5af28997bb53a03d8aeca291479', preco: '18f5ea6a2d5a376d5e03c2b801e684925c371f65' }, // faixa 4
];

// "Tem faixa Sob Consulta?" (sim/não, tipo `set`, mesmo padrão de "Persona é
// decisor?"). Se marcado, a proposta ganha uma última linha sem preço:
// "Acima de <qtd da faixa mais alta> SKUs: Sob consulta" — o texto é montado
// em código, não digitado, pra não variar de card pra card.
export const SOB_CONSULTA_BBP_FIELD = 'b3785205878173b540868075d2f7a1131022af9a';

// A opção "Sim" do campo Sob Consulta, pra checar se está marcada sem
// depender do rótulo (mesma cautela do resto do arquivo com campos `set`).
export const SOB_CONSULTA_BBP_OPTION_SIM = 1614;

/**
 * As faixas de preço de BBP do card, da menor pra maior — sempre com a
 * faixa 1 (campos antigos) na frente. Mesma forma de `faixasBBDoDeal`;
 * ver lá para o porquê de cada detalhe (pendência pela metade, nomes dos
 * campos na nota, etc.) — não repetido aqui.
 */
export function faixasBBPDoDeal(deal) {
    const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const pares = [
        {
            qtd: num(deal?.[CATALOGO_BBP_FIELD]), preco: num(deal?.[PRODUCT_PRICE_FIELDS.BBP]),
            nomeQtd: 'Catálogo BBP (SKUs)', nomePreco: 'Preço BBP',
        },
        ...FAIXAS_BBP_FIELDS.map((f, i) => ({
            qtd: num(deal?.[f.qtd]), preco: num(deal?.[f.preco]),
            nomeQtd: `BBP faixa ${i + 2} - SKUs (qtd)`, nomePreco: `BBP faixa ${i + 2} - preço`,
        })),
    ];
    const usadas = pares.filter((p) => p.qtd != null || p.preco != null);
    const sobConsultaBruto = String(deal?.[SOB_CONSULTA_BBP_FIELD] ?? '');
    const sobConsulta = SOB_CONSULTA_BBP_OPTION_SIM != null
        && sobConsultaBruto.split(',').includes(String(SOB_CONSULTA_BBP_OPTION_SIM));
    return {
        faixas: usadas,
        incompletas: usadas.flatMap((p) => [
            ...(p.qtd > 0 ? [] : [p.nomeQtd]),
            ...(p.preco > 0 ? [] : [p.nomePreco]),
        ]),
        // Sob Consulta só faz sentido junto de escada — sem faixa nenhuma não
        // há "faixa mais alta" pra servir de teto da linha final.
        escada: usadas.length > 1,
        sobConsulta: usadas.length > 1 && sobConsulta,
    };
}

// Rótulo de cada faixa de BBP, por idioma. Formato pedido pela Jessica em
// 17/08/2026, olhando uma proposta real editada pelo time: TODA faixa usa
// "Até N" (nunca "Entre X e Y" — a escada antiga tinha isso, foi tirado
// porque não é como o time escreve à mão) e a linha inteira leva "Proposta:"
// na frente, igual a linha de preço único ("Proposta: R$ X/mês  -  Até N
// SKUs"). Sob Consulta segue o mesmo desenho, só troca o preço pelo texto e
// "Até" por "Acima de".
export const ROTULO_FAIXA_BBP_POR_IDIOMA = {
    pt: { ate: (qtd) => `Até ${qtd} SKUs`, acima: (qtd) => `Acima de ${qtd} SKUs`, semPreco: 'Sob consulta' },
    en: { ate: (qtd) => `Up to ${qtd} SKUs`, acima: (qtd) => `Above ${qtd} SKUs`, semPreco: 'Upon request' },
    es: { ate: (qtd) => `Hasta ${qtd} SKUs`, acima: (qtd) => `Más de ${qtd} SKUs`, semPreco: 'Bajo consulta' },
};

export function rotuloFaixaBBPDoIdioma(idioma = IDIOMA_PADRAO) {
    return ROTULO_FAIXA_BBP_POR_IDIOMA[idioma] || ROTULO_FAIXA_BBP_POR_IDIOMA[IDIOMA_PADRAO];
}

// Texto EXATO do parágrafo que a escada substitui — com o placeholder ainda
// por dentro, não o número já preenchido. Diferente do BB ("Palavras-chave:",
// que sobra intacto mesmo depois do número entrar), aqui a linha é só isto,
// então o generator precisa pular a substituição normal de {{CATALOGO_BBP}}
// quando há escada — senão o prefixo vira "Até 30 SKUs" e alguma outra linha
// do documento que também comece com "Até" poderia colidir.
export const PREFIXO_CATALOGO_BBP_POR_IDIOMA = {
    pt: 'Até {{CATALOGO_BBP}} SKUs',
    en: 'Up to {{CATALOGO_BBP}} SKUs',
    es: 'Hasta {{CATALOGO_BBP}} SKUs',
};

export function prefixoCatalogoBBPDoIdioma(idioma = IDIOMA_PADRAO) {
    return PREFIXO_CATALOGO_BBP_POR_IDIOMA[idioma] || PREFIXO_CATALOGO_BBP_POR_IDIOMA[IDIOMA_PADRAO];
}

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
    1609: 'App Store (ASA e Play Store)',
    1596: 'Mercado Livre', 1597: 'Amazon', 1598: 'Marketplaces',
    1599: 'Google', 1600: 'Meta (Facebook e Instagram)', 1601: "TLD's (Domínios)",
    1602: 'Marketplaces',
    1604: 'Marketplaces monitorados simultaneamente', 1605: 'Google Shopping',
    1606: 'Amazon', 1607: 'Mercado Livre', 1644: 'Shopee',
};

// Loja de aplicativos é o único canal que muda o FORMATO da proposta, e não só
// a caixa de plataforma. Comparando as duas propostas de App Store da Jusbrasil
// com a de Brand Bidding padrão (assinada em 02/03/2026), a diferença é:
//   1. a caixa "Plataforma(s) Monitorada(s)" — que já vem de {{CANAIS_BB}};
//   2. o título vira "1 - Proteção Brand Bidding- App Store";
//   3. a linha "Palavras-chave: Até N palavras." não existe.
// Todo o resto é idêntico, palavra por palavra.
//
// O rótulo é o do time ("ASA" = Apple Search Ads), não uma invenção nossa.
export const CANAL_BB_APP_STORE_ID = 1609;

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
export const CANAL_VM_COM_CONTAGEM_ID = 1604;

/**
 * O rótulo desse canal no idioma pedido. O generator precisa dele pra saber
 * QUAL dos canais recebe a contagem — comparar com a string em português
 * falharia num documento em inglês e a proposta sairia sem o "Up to 3".
 */
export function labelCanalVmComContagem(idioma = IDIOMA_PADRAO) {
    return CANAIS_LABEL_POR_IDIOMA[idioma]?.[CANAL_VM_COM_CONTAGEM_ID] || CANAL_VM_COM_CONTAGEM;
}

/**
 * Rótulos dos canais escolhidos no card, ou o padrão do produto se vazio.
 *
 * O idioma só troca o rótulo do que tem tradução (ver CANAIS_LABEL_POR_IDIOMA,
 * mais abaixo) — nome próprio de plataforma fica como está em qualquer língua.
 */
export function canaisDoDeal(deal, code, idioma = IDIOMA_PADRAO) {
    const rotulo = (id) => CANAIS_LABEL_POR_IDIOMA[idioma]?.[id] || CANAIS_OPTION_TO_LABEL[id];
    const bruto = deal?.[CANAIS_FIELDS[code]];
    if (!bruto) {
        // O padrão é lista de rótulos em português; reencontra o id pra poder
        // traduzir, senão o fallback sairia em português num doc em inglês.
        const idPorLabel = Object.fromEntries(Object.entries(CANAIS_OPTION_TO_LABEL).map(([id, l]) => [l, Number(id)]));
        return (CANAIS_PADRAO[code] || []).map((l) => rotulo(idPorLabel[l]) || l);
    }
    const labels = String(bruto).split(',')
        .map((id) => rotulo(Number(id.trim())))
        .filter(Boolean);
    return labels.length ? labels : (CANAIS_PADRAO[code] || []);
}

/** Os ids de canal marcados no card pra esse produto (vazio = campo em branco). */
export function canaisIdsDoDeal(deal, code) {
    const bruto = deal?.[CANAIS_FIELDS[code]];
    if (!bruto) return [];
    return String(bruto).split(',').map((id) => Number(id.trim())).filter(Number.isFinite);
}

/**
 * True quando App Store é o ÚNICO canal de Brand Bidding do card.
 *
 * "Único" importa: num card "Google Search Ads + App Store" a venda ainda tem a
 * parte de buscador, então as palavras-chave continuam valendo e o título não
 * deve dizer que a proposta é de loja de aplicativos. Só quando App Store está
 * sozinho a proposta assume o formato das duas que o time enviou.
 */
export function bbSoAppStore(deal) {
    const ids = canaisIdsDoDeal(deal, 'BB');
    return ids.length === 1 && ids[0] === CANAL_BB_APP_STORE_ID;
}

// Valor fechado do pacote, usado no bloco "De R$ X / Por: R$ Y" das propostas
// combinadas: o "De" é a soma dos preços dos produtos (a automação calcula) e o
// "Por" é o negociado. NÃO é obrigatório — vazio significa "sem desconto", e o
// combo sai listando os produtos com o preço cheio de cada um.
export const VALOR_PACOTE_FIELD = '798658c516d673cf29f1c1cd17e9c56e46977ddf';

// ─── Idioma da proposta ─────────────────────────────────────────────
// O closer preenche este campo no card e ele escolhe o conjunto de modelos
// em PROPOSAL_TEMPLATES. Até 11/08/2026 era lido por ninguém: o card podia
// pedir inglês e receber proposta em português, sem aviso.
export const IDIOMA_FIELD = '9c95729a15906d4c92843a4fc2c6e79615f103b8';
export const IDIOMA_OPTION_TO_CODE = { 1588: 'pt', 1589: 'en', 1590: 'es' };

// Campo vazio cai aqui. Ele é novo e a esmagadora maioria dos cards é PT —
// exigir preenchimento pararia a geração de todo mundo por um campo que
// ninguém sabia que existia.
export const IDIOMA_PADRAO = 'pt';

// Pro texto das notas, que são o único canal com o closer.
export const IDIOMA_LABEL = { pt: 'português', en: 'inglês', es: 'espanhol' };

/** Código do idioma pedido no card ('pt'|'en'|'es'), ou o padrão se vazio. */
export function idiomaDoDeal(deal) {
    const bruto = deal?.[IDIOMA_FIELD];
    if (bruto == null || bruto === '') return IDIOMA_PADRAO;
    return IDIOMA_OPTION_TO_CODE[Number(String(bruto).trim())] || IDIOMA_PADRAO;
}

/** Os modelos cadastrados num idioma. Objeto vazio se o idioma não tem nenhum. */
export function templatesDoIdioma(idioma) {
    return PROPOSAL_TEMPLATES[idioma] || {};
}

/** O modelo de uma combinação num idioma, ou null se não existe. */
export function resolveTemplate(idioma, chave) {
    return templatesDoIdioma(idioma)[chave] || null;
}

// ─── Strings que o GENERATOR injeta no documento ────────────────────
// Traduzir o modelo não basta: parte do que sai na proposta é montada em
// código, não está no Google Doc. O preço leva "/mês", o bloco de combo leva
// "De"/"Por:", e o canal de marketplaces do VM leva "Até N …". Sem isto, um
// modelo em inglês sairia com "R$ 8.000/mês" e "De R$ 27.000/mês" no meio do
// texto em inglês.
//
// O sufixo do preço é IDIOMA, não moeda: mesmo mantendo o real (ver formatBRL),
// em inglês se escreve "R$ 7.900/month" — é assim nos documentos que o
// comercial já tem. As duas decisões são independentes.
// precoLinha e plataformas também são usados pelo monta-combos pra ACHAR a
// linha modelo dentro do documento — não são só texto de saída. Procurando
// "Proposta:" num modelo em inglês ele não achava nada e montava o combo sem
// preço total nenhum, calado.
export const TEXTOS_POR_IDIOMA = {
    pt: { porMes: '/mês',   de: 'De ',    por: 'Por: ', ate: 'Até',   precoLinha: 'Proposta:', plataformas: 'Plataformas:' },
    en: { porMes: '/month', de: 'From: ', por: 'To: ',  ate: 'Up to', precoLinha: 'Price:',    plataformas: 'Platforms:' },
    es: { porMes: '/mes',   de: 'De: ',   por: 'Por: ', ate: 'Hasta', precoLinha: 'Propuesta:', plataformas: 'Plataformas:' },
};

export function textosDoIdioma(idioma) {
    return TEXTOS_POR_IDIOMA[idioma] || TEXTOS_POR_IDIOMA[IDIOMA_PADRAO];
}

// Títulos que marcam as fronteiras das seções dentro do modelo. O
// monta-combos.js recorta o documento por eles pra montar as combinações —
// procurando "Nossas Proteções" num modelo em inglês ele não acha nada e
// aborta. São expressões, não texto exato, porque os modelos variam na
// acentuação e no nível de heading.
export const SECOES_POR_IDIOMA = {
    pt: { protecoes: /^Nossas Prote/i,  comercial: /^Proposta Comercial/i, condicoes: /^Condi..es Comerciais/i },
    en: { protecoes: /^Our Protections/i, comercial: /^Business Proposal/i, condicoes: /^Commercial Terms/i },
    es: { protecoes: /^Nuestras Protecciones/i, comercial: /^Propuesta Comercial/i, condicoes: /^Condiciones Comerciales/i },
};

export function secoesDoIdioma(idioma) {
    return SECOES_POR_IDIOMA[idioma] || SECOES_POR_IDIOMA[IDIOMA_PADRAO];
}

// Duas linhas do bloco de Brand Bidding que a proposta de App Store trata
// diferente. São texto EXATO do modelo, não expressão: o título é procurado
// literalmente pra ganhar o sufixo, e a linha de palavras-chave é procurada
// pelo começo pra ser apagada inteira.
//
// Se o texto do modelo mudar, isto silenciosamente para de casar — a bateria
// testa-modelos.js confere que as duas linhas existem em cada modelo com BB.
export const LINHAS_BB_POR_IDIOMA = {
    pt: { titulo: 'Proteção Brand Bidding',  palavras: 'Palavras-chave:' },
    en: { titulo: 'Brand Bidding Protection', palavras: 'Keywords:' },
    es: { titulo: 'Protección Brand Bidding', palavras: 'Palabras clave:' },
};

export function linhasBBDoIdioma(idioma) {
    return LINHAS_BB_POR_IDIOMA[idioma] || LINHAS_BB_POR_IDIOMA[IDIOMA_PADRAO];
}

// O sufixo que o título ganha quando a venda é só de loja de aplicativos. O
// time escreve "1 - Proteção Brand Bidding- App Store" (sem espaço antes do
// hífen); aqui sai com espaço, que é o certo e não muda o sentido.
export const SUFIXO_TITULO_APP_STORE = ' - App Store';

// A linha de cada faixa de preço de BB. O texto foi escolhido pela Jessica em
// 13/08/2026 entre as duas formas que aparecem nas propostas reais: "palavras-
// chave" (Hotmilhas) e "termos" (123Milhas). Venceu "palavras-chave", que é
// como o campo do card se chama — quem preenche vê a mesma palavra dos dois
// lados.
//
// O rótulo sai normal e o valor em negrito, que é o padrão de TODA linha de
// rótulo do modelo ("Setup:", "Limite de denúncias:", "Prazo para início:").
// A proposta da Hotmilhas traz a linha inteira em negrito; seguir o modelo
// mantém o documento coerente consigo mesmo.
export const LINHA_FAIXA_POR_IDIOMA = {
    pt: (qtd) => `Até ${qtd} palavras-chave: `,
    en: (qtd) => `Up to ${qtd} keywords: `,
    es: (qtd) => `Hasta ${qtd} palabras clave: `,
};

export function linhaFaixaDoIdioma(idioma = IDIOMA_PADRAO) {
    return LINHA_FAIXA_POR_IDIOMA[idioma] || LINHA_FAIXA_POR_IDIOMA[IDIOMA_PADRAO];
}

// Rótulo de canal por idioma. Só o que DIFERE do português entra aqui; o que
// faltar cai no rótulo em português, que é o comportamento certo pra nome
// próprio — "Google Search Ads", "Mercado Livre" e "Amazon" não se traduzem.
//
// Havia tradução pro id 1603 ("Lojas de aplicativos"), que foi a primeira
// tentativa de encaixar loja de aplicativos como canal de GD. A opção saiu do
// Pipedrive no 33b2744 mas a tradução ficou — id morto, e canaisDoDeal
// descartava em silêncio. Removida em 12/08/2026, junto com a entrada certa
// (1609, sob BB).
export const CANAIS_LABEL_POR_IDIOMA = {
    en: {
        // "Facebook e Instagram" com "e" é o vazamento de português que a
        // auditoria achou nos documentos antigos em inglês (AUDITORIA §4).
        1600: 'Meta (Facebook and Instagram)',
        1601: "TLD's (Domains)",
        1604: 'marketplaces monitored simultaneously',
        1609: 'App Store (ASA and Play Store)',
    },
    es: {
        // Em espanhol "Facebook e Instagram" está CERTO — a conjunção vira "e"
        // antes de som de i. Por isso 1600 não entra aqui.
        1601: "TLD's (Dominios)",
        1604: 'marketplaces monitoreados simultáneamente',
        1609: 'App Store (ASA y Play Store)',
        // A marca chama Mercado Libre fora do Brasil.
        1596: 'Mercado Libre',
        1607: 'Mercado Libre',
    },
};

/** Todos os docIds em uso, em todos os idiomas — usado pela faxina do Drive. */
export function todosOsDocIds() {
    return Object.values(PROPOSAL_TEMPLATES).flatMap((porChave) => Object.values(porChave).map((t) => t.docId));
}

/** True se a automação deve rodar para este deal, dado o estado atual do piloto. */
export function isProposalAutomationEnabledForDeal(dealId) {
    if (!PROPOSAL_AUTOMATION_ENABLED) return false;
    if (!PROPOSAL_TEST_ONLY) return true;
    return PROPOSAL_TEST_DEAL_ID != null && Number(dealId) === PROPOSAL_TEST_DEAL_ID;
}

// ─── Formulário de proposta ─────────────────────────────────────────
// Decisão da Jessica em 18/08/2026: a proposta deixa de ser gerada sozinha a
// partir dos campos do card. Quando o negócio entra em "Envio de proposta", o
// DONO DO NEGÓCIO recebe uma atividade com o link do formulário, e é lá que
// todos os dados da proposta são preenchidos.
//
// O motivo é medido, não opinião. Dos 359 negócios que chegaram nesta etapa ou
// passaram dela, "Serviço oferecido" está preenchido em 269 — e todo o resto
// aparece em menos de 10: idioma 7, palavras-chave BB 7, canais BB 5,
// plataformas VM 3, catálogo BBP 2, algum preço 9. Parte disso é idade (os
// campos nasceram em agosto/2026 e a automação nunca saiu do piloto), mas o
// efeito prático é o mesmo: não há o que pré-preencher. Construir sincronia
// pra puxar campo vazio seria trabalho jogado fora.
//
// Do card seguem sendo lidas só QUATRO coisas, e nenhuma delas é "campo da
// proposta": organização, contato e dono (identidade — errar o nome do cliente
// é o erro caro, e vem de graça do deal id) e "Serviço oferecido", que é o
// único com preenchimento real e serve pra já abrir o formulário com os
// produtos marcados. O resto é digitado.
//
// De volta pro card vão duas: "Link Proposta" e o valor.
export const PROPOSAL_FORM_BASE_URL = (process.env.PROPOSAL_FORM_BASE_URL
    || 'https://revops-proposta-automatizada.vercel.app').replace(/\/+$/, '');

// Domínio do Workspace que pode entrar no formulário. Estava só inline na rota
// /config; virou constante pra a nota do card citar o mesmo valor.
export const PROPOSAL_FORM_DOMAIN = process.env.PROPOSAL_FORM_DOMAIN || 'branddi.com';

// Nota com o link do formulário na entrada da etapa (Jessica, 25/08/2026).
// Chave PRÓPRIA, de propósito: a trava de piloto (PROPOSAL_TEST_ONLY) prende a
// GERAÇÃO ao card de teste, e pendurar a nota nela entregaria o link em um card
// só — o oposto do pedido. Aqui o risco é outro: a nota é um link, não escreve
// no card nem cria documento. Vem ligada; PROPOSAL_NOTA_LINK_ENABLED=false
// desliga sem tocar no resto.
export const PROPOSAL_NOTA_LINK_ENABLED = process.env.PROPOSAL_NOTA_LINK_ENABLED !== 'false';

/** URL do formulário desse negócio. */
export function formUrlDoDeal(dealId) {
    return `${PROPOSAL_FORM_BASE_URL}/proposta/${dealId}`;
}

// Tipo da atividade — "Enviar proposta comercial" (id 24) já existe e é
// exatamente isto. Não criar tipo novo: o funil já tem 56, metade inativos.
export const ATIVIDADE_PROPOSTA_TYPE = 'enviar_proposta_comercial';
export const ATIVIDADE_PROPOSTA_ASSUNTO = 'Gerar proposta pelo formulário';

// Prazo da atividade, em dias úteis a partir da entrada na etapa. Curto de
// propósito: proposta parada é o que a etapa mede.
export const ATIVIDADE_PROPOSTA_PRAZO_DIAS = 1;

// Liga a criação da atividade. Separado de PROPOSAL_AUTOMATION_ENABLED de
// propósito: dá pra ligar a atividade (que só cria tarefa, não manda nada pro
// cliente) muito antes de ligar a geração do documento.
export const PROPOSAL_ACTIVITY_ENABLED = process.env.PROPOSAL_ACTIVITY_ENABLED === 'true';

// ─── Catálogos que o formulário precisa ─────────────────────────────
// Front e back leem daqui pra não divergir: opção que existe na tela e não
// no Pipedrive vira proposta com canal inventado.

/** Opções de canal de cada produto — os ids são os do campo real no Pipedrive. */
export const CANAIS_POR_PRODUTO = {
    BB:  [1592, 1593, 1594, 1595, 1609],
    BBP: [1596, 1597, 1598],
    // 1602 (Marketplaces) saiu em 19/08/2026: Golpes Digitais não olha
    // marketplace. A opção segue existindo no campo do Pipedrive, então card
    // antigo pode ter o id gravado — some da tela e do documento, sem quebrar.
    GD:  [1599, 1600, 1601],
    VM:  [1604, 1605, 1606, 1607, 1644],
};

// Duas modalidades, não três, e só em três dos quatro produtos — decidido em
// 18/08/2026 lendo o que cada bloco promete em "Formas de atuação":
//
//   BB  → envia notificação extrajudicial e protocola denúncia
//   GD  → executa denúncias e remoções, e disputa de domínio
//   VM  → envia aviso ao infrator e protocola denúncia
//   BBP → "apoio à identificação", "cruzamento de bases", "suporte à atuação
//         comercial DA MARCA" — quem atua é o cliente, não a Branddi
//
// Por isso BBP não tem modalidade: não há atuação da Branddi ali pra tirar,
// o serviço é monitoria e inteligência por definição. Marcar "só monitoria"
// num BBP não mudaria uma linha do documento.
//
// "Só Atuação" saiu: sem monitoria não existe de onde vir a ocorrência. Se
// aparecer venda real assim (cliente que já monitora e quer só o enforcement),
// acrescentar aqui e escrever o bloco — não antes.
export const MODALIDADES = ['Monitoria + Atuação', 'Monitoria'];
export const MODALIDADE_PADRAO = MODALIDADES[0];

/** As modalidades de cada produto. `null` = o produto não tem essa dimensão. */
export const MODALIDADE_POR_PRODUTO = { BB: MODALIDADES, BBP: null, GD: MODALIDADES, VM: MODALIDADES };

// A quantidade que cada bloco cita no documento. GD não tem — o texto dele
// não cita número nenhum, lista as plataformas monitoradas.
export const QUANTIDADE_POR_PRODUTO = {
    BB:  { rotulo: 'Palavras-chave', unidade: 'palavras' },
    BBP: { rotulo: 'Catálogo', unidade: 'SKUs' },
    // `null` de propósito: Golpes Digitais não tem quantidade contratada.
    // Nenhum modelo antigo cita número nele, é vendido no valor cheio, e por
    // isso também não tem escada de preço (ver MAX_FAIXAS).
    GD:  null,
    VM:  { rotulo: 'Plataformas', unidade: 'marketplaces simultâneos' },
};

// Quantas faixas de preço cada produto aceita, contando a primeira (que é a
// quantidade + preço principais).
//
// Dez em todos os quatro, a pedido da Jessica em 19/08/2026. Antes eram 3 no BB
// e 4 no BBP, números que vinham dos CAMPOS que existiam no Pipedrive — e o
// Pipedrive deixou de ser a fonte quando o formulário virou a interface. Aqui o
// limite é só pra tela não crescer sem fim.
//
// VM ganhou escada agora; GD NÃO tem, e é decisão (19/08/2026): escada precisa
// de uma unidade pra dizer "até N do quê", e Golpes Digitais não conta nada —
// nenhum modelo antigo cita número nele, é vendido no valor cheio. Chutar uma
// unidade só pra caber na tabela colocaria no documento do cliente um limite
// contratual que ninguém definiu.
export const MAX_FAIXAS = { BB: 10, BBP: 10, VM: 10 };

// Idiomas com catálogo de blocos ESCRITO. Os 45 Google Docs antigos tinham
// en e es traduzidos; o catálogo novo (content/blocos-pt.js) só tem português.
// Oferecer os três no formulário faria alguém pedir inglês e receber
// português calado — que é exatamente o defeito corrigido em 11/08/2026,
// quando o campo "Idioma da proposta" passou a ser lido de verdade.
//
// Acrescentar um idioma aqui exige o arquivo de blocos correspondente e o
// registro dele em content/blocos.js. Não basta traduzir a lista.
//
// en e es entraram em 18/08/2026, escritos com o vocabulário dos documentos que
// o comercial já tinha em cada idioma — mas com as CONDIÇÕES do português: os
// quatro documentos antigos em inglês vendiam contrato anual com fidelidade, o
// oposto do que a Branddi pratica.
export const IDIOMAS_COM_BLOCOS = ['pt', 'en', 'es'];

// Frentes que a proposta pode incluir num pacote além dos quatro produtos —
// sugeridas no formulário, mas o campo segue aceitando qualquer texto. NÃO
// repetem BB/BBP/GD/VM: esses são serviços marcáveis, e vê-los aqui de novo é a
// confusão que o Victor apontou ("fraude, golpes, golpes digitais"). São coisas
// que o time já vende fora do catálogo — as opções "sem modelo" do Pipedrive
// (App Store, Bing, Novos Termos) mais o que aparece nas propostas reais.
//
// A lista existe pra padronizar o nome: sem ela, cada closer escreve "App",
// "App Store", "Loja de aplicativos", e o mesmo serviço vira três coisas na
// planilha e no documento.
export const FRENTES_SUGERIDAS = [
    'App Store',
    'Bing',
    'Novos Termos',
    'Google Shopping',
    'Marketplaces adicionais',
    'Redes sociais',
];

/** Catálogo pronto pro front, já no idioma pedido. */
export function catalogoDoFormulario(idioma = IDIOMA_PADRAO) {
    const rotulo = (id) => CANAIS_LABEL_POR_IDIOMA[idioma]?.[id] || CANAIS_OPTION_TO_LABEL[id];
    return {
        produtos: PRODUCT_CASCADE_ORDER.map((code) => ({ code, label: PRODUCTS[code].label })),
        canais: Object.fromEntries(Object.entries(CANAIS_POR_PRODUTO)
            .map(([code, ids]) => [code, ids.map((id) => ({ id, label: rotulo(id) }))])),
        modalidades: MODALIDADE_POR_PRODUTO,
        modalidadePadrao: MODALIDADE_PADRAO,
        quantidades: QUANTIDADE_POR_PRODUTO,
        maxFaixas: MAX_FAIXAS,
        // `disponivel: false` chega na tela como opção desabilitada, em vez de
        // sumir: o closer precisa ver que o idioma existe e ainda não está
        // pronto, senão pergunta por que a opção desapareceu.
        idiomas: Object.entries(IDIOMA_LABEL).map(([code, label]) => ({
            code, label, disponivel: IDIOMAS_COM_BLOCOS.includes(code),
        })),
        canalAppStore: CANAL_BB_APP_STORE_ID,
        frentesSugeridas: FRENTES_SUGERIDAS,
    };
}
