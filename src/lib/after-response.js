// Continua trabalho async DEPOIS do res.json(). No Vercel (serverless) a função
// congela após a resposta → waitUntil estende a vida até o work terminar.
// Localmente (node direto) o fire-and-forget normal já roda — não precisa de
// waitUntil (é no-op/erro fora do contexto Vercel). Erro do work é logado,
// nunca relançado (a rota já respondeu 200).
import { waitUntil } from '@vercel/functions';
import { getContextLogger } from './logger.js';

const log = getContextLogger('lib:after-response');

export function afterResponse(work) {
    const p = Promise.resolve().then(work).catch((err) => {
        log.error(`[afterResponse] ${err?.message || err}`);
    });
    if (process.env.VERCEL) {
        try { waitUntil(p); } catch (err) { log.error(`[afterResponse] waitUntil: ${err.message}`); }
    }
    return p;
}
