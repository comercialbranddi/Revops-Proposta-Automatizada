import { Router } from 'express';
import { generateProposalForDeal } from '../services/proposal-generator.js';
import {
    SALES_PIPELINE_ID,
    ENVIO_PROPOSTA_STAGE_ID,
    isProposalAutomationEnabledForDeal,
    PROPOSAL_ADMIN_TOKEN,
} from '../config/proposal.js';
import { getContextLogger } from '../lib/logger.js';
import { afterResponse } from '../lib/after-response.js';

const log = getContextLogger('routes:proposal');
const router = Router();

// Pipedrive webhook (deal.updated + deal.added) — sem auth, é o Pipedrive
// chamando de fora. Dispara só na ENTRADA na stage "Envio de proposta"
// (pipe "5. Vendas"), não em qualquer update do card já nela.
//
// afterResponse é OBRIGATÓRIO aqui: no Vercel a função serverless congela
// assim que res.json() é chamado — sem isso, o trabalho async (Google Docs,
// Pipedrive) é interrompido no meio, sem erro nenhum no log (bug real do
// piloto, achado em 31/07/2026 checando os logs da Vercel).
router.post('/webhook/deal', (req, res) => {
    res.json({ received: true });

    afterResponse(async () => {
        const payload = req.body;
        const dealId = payload?.current?.id || payload?.meta?.id;
        const pipelineId = payload?.current?.pipeline_id;
        const stageId = payload?.current?.stage_id;
        const prevStageId = payload?.previous?.stage_id;

        if (!dealId || pipelineId !== SALES_PIPELINE_ID) return;
        if (stageId !== ENVIO_PROPOSTA_STAGE_ID || prevStageId === ENVIO_PROPOSTA_STAGE_ID) return;

        if (!isProposalAutomationEnabledForDeal(dealId)) {
            log.info(`Deal #${dealId} entrou em Envio de proposta — automação desligada/fora do piloto`);
            return;
        }

        log.info(`Deal #${dealId} entrou em Envio de proposta — gerando (piloto)`);
        await generateProposalForDeal(dealId);
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
        await generateProposalForDeal(dealId);
        res.json({ success: true, dealId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Diagnóstico TEMPORÁRIO — confirma se GOOGLE_PROPOSAL_SA_KEY_BASE64 está
// configurada corretamente, SEM expor o segredo (só metadados). Remover
// depois que o piloto estabilizar.
router.get('/debug/google-key', (req, res) => {
    if (PROPOSAL_ADMIN_TOKEN) {
        const token = req.headers['x-admin-token'];
        if (token !== PROPOSAL_ADMIN_TOKEN) {
            return res.status(401).json({ error: 'Token inválido' });
        }
    }
    const raw = process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64;
    if (!raw) return res.json({ present: false });

    const info = { present: true, rawLength: raw.length, rawStartsWith: raw.slice(0, 12), rawEndsWith: raw.slice(-12) };
    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        info.decodedLength = decoded.length;
        const parsed = JSON.parse(decoded);
        info.parsedOk = true;
        info.client_email = parsed.client_email;
        info.hasPrivateKey = Boolean(parsed.private_key);
    } catch (err) {
        info.parsedOk = false;
        info.parseError = err.message;
    }
    res.json(info);
});

export default router;
