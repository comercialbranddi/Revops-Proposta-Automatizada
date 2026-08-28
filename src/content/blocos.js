/**
 * Resolvedor de idioma do conteúdo. É por aqui que o renderizador pede tudo —
 * ele não conhece `blocos-pt`, `blocos-en` nem `blocos-es`.
 *
 * Acrescentar um idioma é: escrever `blocos-XX.js`, acrescentar o vocabulário
 * em `textos.js`, registrar aqui, e pôr o código em `IDIOMAS_COM_BLOCOS`. A
 * bateria confere que os três catálogos tenham a mesma forma — mesma lista de
 * produtos, mesmos rótulos, mesmas linhas marcadas com `so` — porque idioma que
 * esquece uma linha produz proposta que promete menos do que a portuguesa.
 */
import { BLOCOS_PT, SLA_GERAL, INSUMOS_PT } from './blocos-pt.js';
import { BLOCOS_EN, SLA_GERAL_EN, INSUMOS_EN } from './blocos-en.js';
import { BLOCOS_ES, SLA_GERAL_ES, INSUMOS_ES } from './blocos-es.js';
import { textosDoDocumento, modalidadeNoIdioma } from './textos.js';

export { modalidadeNoIdioma };

// A modalidade canônica — o valor que o formulário grava e a planilha guarda.
// Sempre em português, em qualquer idioma de documento.
export const MODALIDADE_AMBOS = 'Monitoria + Atuação';
export const MODALIDADE_MONITORIA = 'Monitoria';
/**
 * Não é uma terceira modalidade — é a marca, gravada no lugar da modalidade
 * do produto, de que ESTE serviço vai na proposta nas duas, com preço em cada
 * uma, pra o cliente escolher. Fica em `modalidade` porque é onde o closer
 * decide (um controle só, três opções) e porque assim o produto não pode
 * estar comparando e fixado ao mesmo tempo.
 *
 * Nunca chega ao texto do documento: quem compara imprime as duas modalidades
 * de verdade, e `modalidadeDo` traduz a marca de volta antes de qualquer
 * escolha de prosa ou de linha.
 */
export const MODALIDADE_COMPARAR = 'As duas';

const CATALOGOS = {
    pt: { blocos: BLOCOS_PT, slaGeral: SLA_GERAL, insumos: INSUMOS_PT },
    en: { blocos: BLOCOS_EN, slaGeral: SLA_GERAL_EN, insumos: INSUMOS_EN },
    es: { blocos: BLOCOS_ES, slaGeral: SLA_GERAL_ES, insumos: INSUMOS_ES },
};

/** Os idiomas com catálogo escrito de verdade. */
export const IDIOMAS_DISPONIVEIS = Object.keys(CATALOGOS);

/**
 * Tudo que o documento precisa num idioma: blocos de produto, SLA geral,
 * insumos do aceite e o vocabulário da moldura.
 *
 * Idioma sem catálogo LANÇA em vez de cair no português. Cair calado é o
 * defeito que este projeto já corrigiu uma vez: até 11/08/2026 o card podia
 * pedir inglês e receber português sem aviso.
 */
export function catalogoDoIdioma(idioma) {
    const c = CATALOGOS[idioma];
    if (!c) throw new Error(`sem catálogo de blocos para o idioma "${idioma}"`);
    return { ...c, textos: textosDoDocumento(idioma) };
}

/** As linhas que valem para uma modalidade. Sem `so`, a linha sempre vale. */
export function linhasDaModalidade(linhas, modalidade) {
    const chave = modalidade === MODALIDADE_MONITORIA ? 'monitoria' : 'ambos';
    return linhas.filter((l) => !l.so || l.so === chave);
}

/**
 * As linhas das DUAS modalidades, na ordem original, cada uma sabendo de qual
 * ela é exclusiva (`soEm`) — ou `null` quando vale nas duas.
 *
 * Serve à proposta que apresenta as duas modalidades lado a lado: em vez de
 * ESCOLHER um conjunto, o documento mostra a união e marca o que só existe de
 * cada lado. Não há dado novo aqui — o `so` de cada linha já foi escrito
 * exatamente para essa distinção, nos três idiomas.
 */
export function linhasComparadas(linhas) {
    return (linhas || []).map((l) => ({
        ...l,
        soEm: l.so === 'ambos' ? MODALIDADE_AMBOS
            : (l.so === 'monitoria' ? MODALIDADE_MONITORIA : null),
    }));
}

/** A prosa do produto na modalidade pedida. Produto sem modalidade usa `unica`. */
export function prosaDoBloco(blocos, code, modalidade) {
    const b = blocos[code];
    if (!b) return null;
    if (!b.temModalidade) return b.prosa.unica;
    return modalidade === MODALIDADE_MONITORIA ? b.prosa.monitoria : b.prosa.ambos;
}

/**
 * True se ALGUM produto do contrato está em atuação — decide as linhas gerais
 * que só existem quando a Branddi notifica alguém.
 *
 * Lê `temModalidade` do catálogo em português de propósito: é característica do
 * PRODUTO, não do documento, e tem que dar o mesmo resultado em qualquer idioma.
 */
export function contratoTemAtuacao(porProduto) {
    return Object.entries(porProduto || {}).some(([code, p]) => {
        const b = BLOCOS_PT[code];
        if (!b) return false;
        // BBP não tem modalidade e nunca conta como atuação da Branddi.
        return b.temModalidade && p.modalidade !== MODALIDADE_MONITORIA;
    });
}
