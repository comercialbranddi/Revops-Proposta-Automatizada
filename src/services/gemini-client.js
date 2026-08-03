/**
 * Cliente Gemini — costura em prosa conectada os blocos de produto
 * selecionados numa proposta multi-produto (Ponto 4). Só entra em ação
 * quando o deal tem 2+ produtos; para 1 produto só o fluxo normal
 * (copyTemplate + replaceAllText) não precisa de LLM nenhum.
 *
 * Credencial: GEMINI_API_KEY (Google AI Studio — chave de API simples,
 * sem OAuth, diferente da service account do Docs/Drive).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:gemini-client');

let _client = null;
function getClient() {
    if (_client) return _client;
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada');
    _client = new GoogleGenerativeAI(key);
    return _client;
}

/**
 * @param {Array<{label: string, apresentacao: string, protecoes: string, especificacoes: string, entregaveis: string, comercial: string}>} products
 * @param {string} condicoes — Condições Comerciais do produto-âncora (compartilhadas)
 * @param {string} totalLine — linha de total JÁ CALCULADA em código (ex: "Total: R$ 17.800/mês") —
 *   a IA nunca soma valores, só posiciona essa linha pronta no lugar certo.
 * @returns {Promise<string>} texto único combinando os produtos, com marcadores de heading (### )
 */
export async function mergeProductSections(products, condicoes, totalLine) {
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Você é redator técnico da Branddi. Junte os blocos de produto abaixo em UMA proposta comercial coesa — não é pra colar seções estanques, é pra ler como um documento só, com transições naturais entre os produtos.

REGRAS ESTRITAS:
- NUNCA invente, altere, remova ou CALCULE dados factuais (preços, SLAs, prazos, listas de itens) — copie esses números e listas exatamente como estão nos blocos abaixo.
- A linha de total já vem calculada — só posicione ela no lugar indicado, não recalcule.
- Pode reescrever frases de transição e a introdução pra mencionar os produtos juntos naturalmente.
- Mantém os placeholders {{MARCA}} e {{DECISOR}} exatamente como aparecem, se aparecerem.
- Saída em texto puro, em português, usando "### " antes de cada título de seção (pra eu formatar depois).
- Estrutura de saída, nesta ordem: ### Apresentação (UM parágrafo só, combinando as apresentações de cada produto abaixo numa frase coesa que mencione todos os serviços contratados) → ### Nossas Proteções (com um sub-bloco numerado 1), 2), 3)... por produto, cada um com o texto de proteção dele) → ### Especificações (specs de cada produto, agrupadas por produto) → ### Entregáveis (de cada produto) → ### Proposta Comercial (lista de preço de cada produto, exatamente como está, seguida da linha de total fornecida) → ### Condições Comerciais (usa o texto de condições fornecido, que já é compartilhado entre os produtos, só uma vez).

PRODUTOS SELECIONADOS:
${products.map((p, i) => `--- Produto ${i + 1}: ${p.label} ---\nApresentação: ${p.apresentacao}\nProteções: ${p.protecoes}\nEspecificações: ${p.especificacoes}\nEntregáveis: ${p.entregaveis}\nComercial: ${p.comercial}`).join('\n\n')}

LINHA DE TOTAL (já calculada, só posicionar): ${totalLine}

CONDIÇÕES COMERCIAIS (usar uma vez só, no final):
${condicoes}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    log.info(`✏️  Gemini gerou ${text.length} caracteres pra ${products.length} produtos`);
    return text;
}
