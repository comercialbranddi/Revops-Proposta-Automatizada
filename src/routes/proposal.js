import { Router } from 'express';
import { generateProposalForDeal } from '../services/proposal-generator.js';
import { ensureProposalActivity } from '../services/proposal-activity.js';
import { pdGet, pdPut } from '../services/pipedrive.js';
import {
    SALES_PIPELINE_ID,
    ENVIO_PROPOSTA_STAGE_ID,
    isProposalAutomationEnabledForDeal,
    PROPOSAL_ADMIN_TOKEN,
    PROPOSAL_WEBHOOK_SECRET,
    PROPOSAL_ACTIVITY_ENABLED,
    PROPOSAL_DEAL_FIELDS,
    PROPOSAL_FORM_BASE_URL,
    parseServicoOferecido,
    idiomaDoDeal,
    catalogoDoFormulario,
} from '../config/proposal.js';
import { exigeLogin } from '../lib/auth-google.js';
import { ultimaSpec, salvarSpec, porSlug, marcarGerada, aberturasDoDeal } from '../services/spec-store.js';
import { renderProposta } from '../services/render-proposta.js';
import { closeProposalActivity } from '../services/proposal-activity.js';
import { getContextLogger } from '../lib/logger.js';
import { afterResponse } from '../lib/after-response.js';

const log = getContextLogger('routes:proposal');
const router = Router();

// Pipedrive webhook (deal.updated) — sem auth, é o Pipedrive chamando de
// fora. Reage a QUALQUER update do card enquanto ele está na stage "Envio
// de proposta" (pipe "5. Vendas"), não só à entrada.
//
// O que ele faz mudou em 18/08/2026: em vez de tentar gerar a proposta a
// partir dos campos do card, ele cria uma ATIVIDADE para o dono do negócio
// com o link do formulário. A geração automática por campo saiu porque não
// havia o que ler — ver o bloco "Formulário de proposta" na config, com os
// números de preenchimento real.
//
// ensureProposalActivity é idempotente (não cria se já houver uma aberta),
// que é o que torna seguro reagir a todo update em vez de só à entrada.
//
// afterResponse é OBRIGATÓRIO aqui: no Vercel a função serverless congela
// assim que res.json() é chamado — sem isso o trabalho async é interrompido
// no meio, sem erro nenhum no log (bug real do piloto, 31/07/2026).
router.post('/webhook/deal', (req, res) => {
    if (PROPOSAL_WEBHOOK_SECRET) {
        if (req.query?.secret !== PROPOSAL_WEBHOOK_SECRET) {
            log.warn('webhook chamado com secret inválido — ignorado');
            return res.status(401).json({ error: 'Secret inválido' });
        }
    } else {
        log.warn('PROPOSAL_WEBHOOK_SECRET não configurada — webhook aceitando chamada sem autenticação');
    }

    res.json({ received: true });

    afterResponse(async () => {
        const payload = req.body;
        const dealId = payload?.current?.id || payload?.meta?.id;
        const pipelineId = payload?.current?.pipeline_id;
        const stageId = payload?.current?.stage_id;

        if (!dealId || pipelineId !== SALES_PIPELINE_ID) return;
        if (stageId !== ENVIO_PROPOSTA_STAGE_ID) return;

        if (!PROPOSAL_ACTIVITY_ENABLED) {
            log.info(`deal #${dealId} em Envio de proposta — atividade desligada (PROPOSAL_ACTIVITY_ENABLED)`);
            return;
        }

        // O payload do webhook traz o deal, mas nem sempre com user_id no
        // formato esperado — buscar é uma chamada e evita atividade órfã.
        const deal = (await pdGet(`/deals/${dealId}`))?.data;
        if (!deal) return log.warn(`deal #${dealId} não encontrado`);

        // Proposta já gerada? Então não há tarefa a pedir.
        //
        // Isto fecha um CICLO real, visto em produção em 18/08/2026: gerar a
        // proposta grava o link no card, gravar dispara este webhook, e o card
        // seguia na etapa sem atividade aberta (as abertas acabavam de ser
        // fechadas pela própria geração) — então nascia outra, quatro segundos
        // depois, pedindo pra fazer o que tinha acabado de ser feito.
        //
        // Pra gerar de novo, é só limpar "Link Proposta": o card volta a pedir
        // atividade no próximo update.
        const link = String(deal[PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA] || '');
        if (/^https?:\/\//.test(link)) {
            log.info(`deal #${dealId}: proposta já gerada (${link}) — sem atividade`);
            return;
        }

        await ensureProposalActivity(dealId, deal);
    });
});

// Catálogo da tela (produtos, canais, modalidades) + o client id do login.
// SEM auth de propósito: o client id do OAuth é público por natureza, e a
// página precisa dele ANTES de conseguir autenticar — exigir login aqui seria
// pedir a chave pra quem ainda não tem como entrar.
router.get('/config', (req, res) => {
    res.json({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null,
        dominio: process.env.PROPOSAL_FORM_DOMAIN || 'branddi.com',
        catalogo: catalogoDoFormulario('pt'),
    });
});

// ─── Formulário ─────────────────────────────────────────────────────
// Dados de partida da tela. Do card vêm SÓ identidade (organização, contato,
// dono) e "Serviço oferecido", que é o único campo com preenchimento real
// (269 de 359) e serve pra abrir o formulário com os produtos já marcados.
// Nenhum outro campo do deal é lido — ver a config pro porquê.
router.get('/form/:dealId', exigeLogin, async (req, res) => {
    const dealId = parseInt(req.params.dealId, 10);
    if (!Number.isFinite(dealId)) return res.status(400).json({ error: 'dealId inválido' });

    try {
        const deal = (await pdGet(`/deals/${dealId}`))?.data;
        if (!deal) return res.status(404).json({ error: 'Negócio não encontrado' });

        const { codes, semTemplate } = parseServicoOferecido(deal[PROPOSAL_DEAL_FIELDS.SERVICO_OFERECIDO]);

        // Reabrir o formulário tem que trazer o que já foi preenchido, senão
        // uma revisão obriga a digitar tudo de novo — que é o defeito que
        // este projeto está corrigindo.
        const anterior = await ultimaSpec(dealId);
        // Quantas vezes o cliente abriu a proposta anterior — é o dado que o
        // Google Doc nunca deu, e o que decide se vale ligar ou esperar.
        const aberturas = anterior ? await aberturasDoDeal(dealId) : null;

        res.json({
            deal: {
                id: deal.id,
                titulo: deal.title,
                organizacao: deal.org_name || deal.org_id?.name || null,
                contato: deal.person_name || deal.person_id?.name || null,
                dono: deal.user_id?.name || null,
                valor: deal.value ?? null,
            },
            sugestao: { produtos: codes, idioma: idiomaDoDeal(deal), semTemplate },
            anterior: anterior ? { revisao: anterior.revisao, spec: anterior.spec, doc_url: anterior.doc_url, aberturas } : null,
            usuario: req.usuario,
        });
    } catch (err) {
        log.error(`form/${dealId}: ${err.message}`);
        res.status(500).json({ error: 'Não consegui carregar o negócio' });
    }
});

// Grava o que foi preenchido. Cada envio é uma revisão NOVA — proposta é
// documento datado, não estado atual do card (ver migration 002).
router.post('/form/:dealId', exigeLogin, async (req, res) => {
    const dealId = parseInt(req.params.dealId, 10);
    if (!Number.isFinite(dealId)) return res.status(400).json({ error: 'dealId inválido' });
    const spec = req.body?.spec;
    if (!spec || typeof spec !== 'object') return res.status(400).json({ error: 'spec ausente' });

    try {
        const deal = (await pdGet(`/deals/${dealId}`))?.data;
        if (!deal) return res.status(404).json({ error: 'Negócio não encontrado' });
        const dados = { id: dealId, organizacao: deal.org_name || deal.org_id?.name, contato: deal.person_name || deal.person_id?.name };

        // Renderiza ANTES de gravar. Spec que não vira documento é lixo na
        // planilha e um link quebrado no card — melhor falhar no botão, com o
        // closer olhando a tela, do que depois.
        renderProposta({ deal: dados, spec });

        const { revisao, slug } = await salvarSpec(dealId, req.usuario, spec);
        const url = `${PROPOSAL_FORM_BASE_URL}/p/${slug}`;

        // Daqui pra baixo nada pode derrubar a resposta: a proposta JÁ existe e
        // já tem endereço. Falha em gravar o link ou fechar a atividade é chata,
        // não é motivo pra dizer ao closer que não salvou.
        const avisos = [];
        try { await pdPut(`/deals/${dealId}`, { [PROPOSAL_DEAL_FIELDS.LINK_PROPOSTA]: url }); }
        catch (e) { avisos.push('não consegui gravar o link no card'); log.warn(`deal #${dealId}: ${e.message}`); }
        try { await marcarGerada(dealId, revisao, url); } catch (e) { log.warn(`deal #${dealId}: carimbo — ${e.message}`); }
        try { await closeProposalActivity(dealId); }
        catch (e) { avisos.push('não consegui fechar a atividade'); log.warn(`deal #${dealId}: ${e.message}`); }

        log.info(`deal #${dealId}: proposta revisão ${revisao} em ${url}`);
        res.json({ revisao, url, avisos });
    } catch (err) {
        log.error(`form/${dealId} POST: ${err.message}`);
        res.status(500).json({ error: err.message.startsWith('spec ') || err.message.startsWith('sem ')
            ? err.message : 'Não consegui salvar' });
    }
});

// Gera manualmente, sem depender de mudança de stage — útil pra testar sob
// controle. Protegido por token simples.
router.post('/generate/:dealId', async (req, res) => {
    if (PROPOSAL_ADMIN_TOKEN) {
        const token = req.headers['x-admin-token'];
        if (token !== PROPOSAL_ADMIN_TOKEN) {
            return res.status(401).json({ error: 'Token inválido' });
        }
    }
    const dealId = parseInt(req.params.dealId, 10);
    if (!isProposalAutomationEnabledForDeal(dealId)) {
        return res.status(403).json({ error: 'Automação desligada ou deal fora do piloto' });
    }
    try {
        await generateProposalForDeal(dealId, { notifyOnEntry: true });
        res.json({ success: true, dealId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
