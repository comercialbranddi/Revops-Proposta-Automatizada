/**
 * Extrai as seções nomeadas do texto puro de um template de proposta.
 * Todos os 4 modelos (BB/BBP/GD/VM) seguem o mesmo esqueleto de headings —
 * ver memory/handoff 27/07/2026. Usado só no caminho multi-produto (Ponto
 * 4): pra 1 produto só, o fluxo antigo (copyTemplate + replaceAllText)
 * continua igual, não precisa fatiar nada.
 */
const MARKERS = ['Nossas Proteções', 'Especificações', 'Entregáveis', 'Proposta Comercial', 'Condições Comerciais'];

function sliceBetween(text, startMarker, endMarker) {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return '';
    const contentStart = startIdx + startMarker.length;
    const endIdx = endMarker ? text.indexOf(endMarker, contentStart) : text.length;
    return text.slice(contentStart, endIdx === -1 ? text.length : endIdx).trim();
}

/**
 * @param {string} plainText — texto puro do doc (via getPlainText)
 * @returns {{ intro: string, protecoes: string, especificacoes: string, entregaveis: string, comercial: string, condicoes: string }}
 */
export function extractSections(plainText) {
    const [nossasProtecoes, especificacoes, entregaveis, propostaComercial, condicoesComerciais] = MARKERS;
    const intro = text_before(plainText, nossasProtecoes);
    // "Apresentamos..." é o parágrafo específico do serviço — a única parte
    // do cabeçalho que varia por produto (data/Para/Prezados são fixos,
    // ficam hardcoded no código, não passam pelo Gemini).
    const prezadosIdx = intro.lastIndexOf('Prezados,');
    const apresentacao = prezadosIdx === -1 ? intro : intro.slice(prezadosIdx + 'Prezados,'.length).trim();
    return {
        intro,
        apresentacao,
        protecoes: sliceBetween(plainText, nossasProtecoes, especificacoes),
        especificacoes: sliceBetween(plainText, especificacoes, entregaveis),
        entregaveis: sliceBetween(plainText, entregaveis, propostaComercial),
        comercial: sliceBetween(plainText, propostaComercial, condicoesComerciais),
        condicoes: sliceBetween(plainText, condicoesComerciais, null),
    };
}

function text_before(text, marker) {
    const idx = text.indexOf(marker);
    return (idx === -1 ? text : text.slice(0, idx)).trim();
}
