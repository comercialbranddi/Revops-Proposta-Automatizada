import { Router } from 'express';
import { generateProposalForDeal } from '../services/proposal-generator.js';
import {
    SALES_PIPELINE_ID,
    ENVIO_PROPOSTA_STAGE_ID,
    isProposalAutomationEnabledForDeal,
    PROPOSAL_ADMIN_TOKEN,
    PROPOSAL_WEBHOOK_SECRET,
} from '../config/proposal.js';
import { getContextLogger } from '../lib/logger.js';
import { afterResponse } from '../lib/after-response.js';

const log = getContextLogger('routes:proposal');
const router = Router();

// Pipedrive webhook (deal.updated) — sem auth, é o Pipedrive chamando de
// fora. Reage a QUALQUER update do card enquanto ele está na stage "Envio
// de proposta" (pipe "5. Vendas") — não só a entrada. Isso porque, se
// faltar preço/catálogo na entrada, a proposta não é gerada (só uma nota
// avisando) — precisa reagir de novo quando o SDR preencher o campo depois,
// com o card já na fase. generateProposalForDeal() é idempotente (já sai
// na entrada se "Link Proposta" já estiver preenchido), então chamar de
// novo em updates seguintes é seguro.
//
// notifyOnEntry só é true na ENTRADA — evita spam de nota a cada update
// enquanto o SDR ainda está preenchendo outros campos do card. É ele que
// libera as notas de "falta campo" e de "proposta já existe".
//
// afterResponse é OBRIGATÓRIO aqui: no Vercel a função serverless congela
// assim que res.json() é chamado — sem isso, o trabalho async (Google Docs,
// Pipedrive) é interrompido no meio, sem erro nenhum no log (bug real do
// piloto, achado em 31/07/2026 checando os logs da Vercel).
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
        const prevStageId = payload?.previous?.stage_id;

        if (!dealId || pipelineId !== SALES_PIPELINE_ID) return;
        if (stageId !== ENVIO_PROPOSTA_STAGE_ID) return;

        if (!isProposalAutomationEnabledForDeal(dealId)) {
            log.info(`Deal #${dealId} em Envio de proposta — automação desligada/fora do piloto`);
            return;
        }

        const isEntry = prevStageId !== ENVIO_PROPOSTA_STAGE_ID;
        log.info(`Deal #${dealId} em Envio de proposta (${isEntry ? 'entrada' : 'campo atualizado'}) — avaliando geração`);
        await generateProposalForDeal(dealId, { notifyOnEntry: isEntry });
    });
});

// Gera manualmente, sem depender de mudança de stage — útil pra testar sob
// controle. Protegido por token simples (não é o mesmo sistema de auth do
// Lia — repo pequeno e dedicado).
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
