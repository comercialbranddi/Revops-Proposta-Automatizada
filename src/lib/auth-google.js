/**
 * Login do formulário — Google Workspace do domínio da empresa.
 *
 * Sem senha compartilhada de propósito: com senha não dá pra saber QUEM gerou
 * a proposta, e é exatamente esse dado que precisa ir pro `criado_por` do
 * proposal_spec. `google-auth-library` já é dependência do projeto por causa
 * do Google Docs.
 *
 * O front manda o ID token do Google no header Authorization; aqui ele é
 * verificado de verdade (assinatura, audience e expiração) — decodificar o JWT
 * sem verificar deixaria qualquer um forjar um e-mail @branddi.com.
 */
import { OAuth2Client } from 'google-auth-library';
import { getContextLogger } from './logger.js';
import { doPedido as sessaoDoPedido, gravar as gravarSessao } from './sessao.js';

const log = getContextLogger('lib:auth-google');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || null;
const DOMINIO = process.env.PROPOSAL_FORM_DOMAIN || 'branddi.com';

const client = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

/** O e-mail autenticado da requisição, ou null. Não lança. */
export async function usuarioDaRequisicao(req) {
    const header = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token || !client) return null;
    try {
        const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
        const p = ticket.getPayload();
        // `hd` é o domínio Workspace. Sem essa checagem qualquer conta Google
        // pessoal entraria — o e-mail sozinho não prova domínio.
        if (p?.hd !== DOMINIO || !p.email_verified) return null;
        return p.email;
    } catch (err) {
        log.warn(`token inválido: ${err.message}`);
        return null;
    }
}

/** Middleware: exige login do domínio e põe o e-mail em req.usuario. */
export async function exigeLogin(req, res, next) {
    if (!CLIENT_ID) {
        // Falha fechada. Sem client id configurado não há como verificar nada,
        // e liberar "só por enquanto" é como endpoint aberto vai pra produção.
        log.error('GOOGLE_OAUTH_CLIENT_ID não configurada — formulário bloqueado');
        return res.status(503).json({ error: 'Login não configurado neste ambiente' });
    }
    // Token do Google primeiro: é ele que RENOVA a sessão. Quem acabou de
    // entrar sai daqui com o cookie gravado e não vê mais a tela de login
    // enquanto ele valer.
    const email = await usuarioDaRequisicao(req);
    if (email) {
        gravarSessao(res, email);
        req.usuario = email;
        return next();
    }

    // Sem token, vale o cookie de uma entrada anterior. É o que faz o login ser
    // pedido uma vez só, em vez de a cada carga da página.
    const daSessao = sessaoDoPedido(req);
    if (daSessao) { req.usuario = daSessao; return next(); }

    return res.status(401).json({ error: `Entre com sua conta @${DOMINIO}` });
}
