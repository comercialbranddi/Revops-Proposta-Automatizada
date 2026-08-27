/**
 * Sessão do formulário — pra o login do Google ser pedido UMA vez.
 *
 * O que havia: o ID token do Google vivia numa variável de JavaScript. Recarregou
 * a página, perdeu — e o closer via a tela de login de novo. `auto_select` do
 * Google ajuda, mas desiste sozinho depois de algumas dispensas e não vale nada
 * pra quem tem mais de uma conta logada.
 *
 * O que existe agora: verificado o token do Google uma vez, o servidor emite um
 * cookie assinado com o e-mail e uma validade. Enquanto ele valer, o formulário
 * abre direto.
 *
 * Por que HMAC e não JWT: é UM dado (o e-mail) e um prazo. Biblioteca de JWT
 * traria algoritmo negociável e `alg: none`, que é onde esse tipo de coisa
 * costuma vazar. Aqui o algoritmo é fixo e o segredo é nosso.
 *
 * Sem PROPOSAL_SESSION_SECRET a sessão não é emitida e o login volta a ser por
 * token a cada carga — degrada pro comportamento antigo em vez de abrir a porta.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getContextLogger } from './logger.js';

const log = getContextLogger('lib:sessao');

const SEGREDO = process.env.PROPOSAL_SESSION_SECRET || null;
export const COOKIE = 'proposta_sessao';
const DIAS = 30;

const assinar = (dados) => createHmac('sha256', SEGREDO).update(dados).digest('base64url');

/** O valor do cookie pra este e-mail, ou null se a sessão não está configurada. */
export function emitir(email) {
    if (!SEGREDO) return null;
    const dados = `${Buffer.from(email).toString('base64url')}.${Date.now() + DIAS * 864e5}`;
    return `${dados}.${assinar(dados)}`;
}

/** O e-mail de um cookie válido, ou null. Nunca lança. */
export function ler(valor) {
    if (!SEGREDO || !valor) return null;
    const p = String(valor).split('.');
    if (p.length !== 3) return null;
    const dados = `${p[0]}.${p[1]}`;
    let esperado;
    try { esperado = Buffer.from(assinar(dados)); } catch { return null; }
    const veio = Buffer.from(p[2]);
    // timingSafeEqual exige o mesmo tamanho — comparar antes evita a exceção e
    // o vazamento de tamanho por exceção.
    if (veio.length !== esperado.length || !timingSafeEqual(veio, esperado)) return null;
    if (!(Number(p[1]) > Date.now())) return null;
    try { return Buffer.from(p[0], 'base64url').toString('utf-8') || null; } catch { return null; }
}

/** Lê o cookie da requisição sem depender de cookie-parser. */
export function doPedido(req) {
    const bruto = req.headers?.cookie || '';
    for (const parte of bruto.split(';')) {
        const [k, ...v] = parte.trim().split('=');
        if (k === COOKIE) return ler(decodeURIComponent(v.join('=')));
    }
    return null;
}

/**
 * Grava o cookie na resposta.
 *
 * HttpOnly porque nenhum JavaScript da página precisa lê-lo — o navegador o
 * manda sozinho nas chamadas do mesmo site. SameSite=Lax porque o formulário é
 * aberto por link vindo do Pipedrive.
 */
export function gravar(res, email) {
    const valor = emitir(email);
    if (!valor) return false;
    res.append('Set-Cookie', [
        `${COOKIE}=${encodeURIComponent(valor)}`,
        'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax',
        `Max-Age=${DIAS * 86400}`,
    ].join('; '));
    return true;
}

export function configurada() {
    if (!SEGREDO) log.warn('PROPOSAL_SESSION_SECRET ausente — login será pedido a cada carga');
    return !!SEGREDO;
}
