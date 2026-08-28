import { Router } from 'express';
import { generateProposalForDeal } from '../services/proposal-generator.js';
import { pdGet, pdPut, pdPost } from '../services/pipedrive.js';
import {
    SALES_PIPELINE_ID,
    ENVIO_PROPOSTA_STAGE_ID,
    ETAPAS_COM_LINK_FORM,
    isProposalAutomationEnabledForDeal,
    PROPOSAL_ADMIN_TOKEN,
    PROPOSAL_WEBHOOK_SECRET,
    PROPOSAL_DEAL_FIELDS,
    PROPOSAL_FORM_BASE_URL,
    PROPOSAL_FORM_DOMAIN,
    PROPOSAL_NOTA_LINK_ENABLED,
    PROPOSAL_OUTPUT_FOLDER_ID,
    parseServicoOferecido,
    idiomaDoDeal,
    catalogoDoFormulario,
    IDIOMAS_COM_BLOCOS,
} from '../config/proposal.js';
import { condicoesPadrao } from '../content/textos.js';
import { logo } from '../content/logo.js';
import { exigeLogin } from '../lib/auth-google.js';
import { ultimaSpec, salvarSpec, porSlug, marcarGerada, aberturasDoDeal, registrarAceite, aceiteDe } from '../services/spec-store.js';
import { renderProposta } from '../services/render-proposta.js';
import { configurada as sessaoConfigurada } from '../lib/sessao.js';
import { findOrCreateFolder, uploadParaDrive } from '../services/google-docs-client.js';
import { closeProposalActivity } from '../services/proposal-activity.js';
import { postarNotaDoFormulario } from '../services/proposal-form-note.js';
import { getContextLogger } from '../lib/logger.js';
import { afterResponse } from '../lib/after-response.js';

const log = getContextLogger('routes:proposal');
const router = Router();

// Pipedrive webhook (deal.updated) — sem auth, é o Pipedrive chamando de
// fora. Reage a QUALQUER update do card enquanto ele está na stage "Envio
// de proposta" (pipe "5. Vendas"), não só à entrada.
//
// REVERTIDO em 19/08/2026, pedido da Jessica: o desvio pro formulário
// (18/08) criou bagunça na prática — o time seguiu preenchendo os campos do
// card esperando a proposta no modelo antigo, e nada saía. O webhook volta a
// GERAR a proposta a partir dos campos (copyTemplate + replaceAllText,
// modelo antigo do Google Docs), como antes de eecb221. A atividade
// "Gerar proposta pelo formulário" NÃO é mais criada; o formulário continua
// no ar mas deixa de ser o caminho de entrada.
//
// notifyOnEntry só é true na ENTRADA — evita spam de nota a cada update
// enquanto o SDR ainda está preenchendo outros campos do card. É ele que
// libera as notas de "falta campo" e de "proposta já existe".
//
// ACRESCENTADO em 25/08/2026: na ENTRADA, o card recebe uma NOTA com o link do
// formulário — o time vai validar o modelo novo usando de verdade. É só a nota:
// nenhuma atividade é criada e a geração antiga não muda. Ela roda antes da
// trava de piloto de propósito (ver proposal-form-note.js).
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
        const prevStageId = payload?.previous?.stage_id;

        if (!dealId || pipelineId !== SALES_PIPELINE_ID) return;
        // Duas etapas entregam o link do formulário; só uma delas gera o
        // documento do fluxo antigo. Sair aqui cedo demais era o que deixava o
        // card que pula direto pra "Proposta enviada" sem link nenhum.
        if (!ETAPAS_COM_LINK_FORM.includes(stageId)) return;

        const isEntry = prevStageId !== stageId;

        // A nota com o link do formulário sai ANTES e POR FORA da trava de
        // piloto: o time vai validar o modelo novo usando de verdade, e a trava
        // prende a geração ao card de teste. Só na ENTRADA, e o serviço não
        // repete se o card já tem o link. Nunca lança — se falhar, a geração
        // antiga segue igual.
        if (isEntry && PROPOSAL_NOTA_LINK_ENABLED) {
            await postarNotaDoFormulario(dealId);
        }

        // ─── Daqui pra baixo é o fluxo antigo, só na etapa de sempre ────
        // Gerar em "Proposta enviada" criaria proposta nova pra um card cuja
        // proposta já foi ao cliente — e ainda sobrescreveria o "Link
        // Proposta" que ele está usando.
        if (stageId !== ENVIO_PROPOSTA_STAGE_ID) return;

        if (!isProposalAutomationEnabledForDeal(dealId)) {
            log.info(`Deal #${dealId} em Envio de proposta — automação desligada/fora do piloto`);
            return;
        }

        log.info(`Deal #${dealId} em Envio de proposta (${isEntry ? 'entrada' : 'campo atualizado'}) — avaliando geração`);
        await generateProposalForDeal(dealId, { notifyOnEntry: isEntry });
    });
});

// Catálogo da tela (produtos, canais, modalidades) + o client id do login.
// SEM auth de propósito: o client id do OAuth é público por natureza, e a
// página precisa dele ANTES de conseguir autenticar — exigir login aqui seria
// pedir a chave pra quem ainda não tem como entrar.
router.get('/config', (req, res) => {
    res.json({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null,
        // O logo vem daqui pra existir num lugar só: a proposta e o formulário
        // usavam texto imitando a marca, cada um com o seu.
        logo: logo(22),
        dominio: PROPOSAL_FORM_DOMAIN,
        // Se a sessão de 30 dias está ligada. Booleano, nunca o segredo. Sem
        // isto não havia como saber POR FORA se o "login uma vez" está de pé:
        // uma variável de ambiente faltando no deploy é indistinguível de um
        // bug no cookie, e as duas coisas se corrigem em lugares diferentes.
        sessao: sessaoConfigurada(),
        catalogo: catalogoDoFormulario('pt'),
        // As condicoes padrao de cada idioma. O formulario mostra as do idioma
        // escolhido e manda de volta SO o que o closer alterou — assim o que
        // ninguem tocou continua sendo a condicao padrao da Branddi, e mudar o
        // padrao depois alcanca as propostas novas sem reeditar nada.
        condicoes: Object.fromEntries(IDIOMAS_COM_BLOCOS.map((i) => [i, condicoesPadrao(i)])),
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

        // Cópia em PDF na pasta do cliente no Drive, ao lado das propostas do
        // fluxo antigo. A proposta em si é a página viva em /p/<slug> — esta
        // cópia é ARQUIVO: o registro do que o cliente recebeu naquela revisão,
        // que a página não guarda porque ela sempre mostra a versão atual.
        //
        // Depois do res.json de propósito: o PDF passa por um Chrome e leva
        // segundos. Fazer antes deixaria o closer olhando o botão girar por um
        // arquivo que ele não vai abrir agora. Falhar aqui também não pode
        // custar a proposta — ela já existe e já tem endereço.
        afterResponse(async () => {
            if (!PROPOSAL_OUTPUT_FOLDER_ID) return;
            try {
                const { htmlParaPdf } = await import('../services/pdf.js');
                const html = renderProposta({ deal: dados, spec, slug });
                const pdf = await htmlParaPdf(html);
                const pasta = await findOrCreateFolder(dados.organizacao, PROPOSAL_OUTPUT_FOLDER_ID)
                    || PROPOSAL_OUTPUT_FOLDER_ID;
                // O nome carrega revisão e card: a pasta acumula uma cópia por
                // revisão, e sem isso duas viram "o mesmo arquivo" pra quem olha.
                const nome = `Proposta_${dados.organizacao}_rev${revisao}_${new Date().toISOString().slice(0, 10)}_deal${dealId}.pdf`;
                const { webViewLink } = await uploadParaDrive({ nome, mimeType: 'application/pdf', bytes: pdf, pastaId: pasta });
                log.info(`deal #${dealId}: cópia rev ${revisao} no Drive — ${webViewLink}`);
            } catch (e) {
                log.warn(`deal #${dealId}: não arquivei a cópia no Drive — ${e.message}`);
            }
        });
    } catch (err) {
        log.error(`form/${dealId} POST: ${err.message}`);
        res.status(500).json({ error: err.message.startsWith('spec ') || err.message.startsWith('sem ')
            ? err.message : 'Não consegui salvar' });
    }
});

// ─── Aceite ─────────────────────────────────────────────────────────
// PÚBLICA: quem aceita é o cliente, que não tem conta aqui. O que limita o
// alcance é o slug — só chega nesta rota quem recebeu o link. Não é
// assinatura qualificada, e o texto da página diz isso.
router.post('/aceite/:slug', async (req, res) => {
    const { slug } = req.params;
    const nome = String(req.body?.nome || '').trim();
    const email = String(req.body?.email || '').trim();
    const cargo = String(req.body?.cargo || '').trim();
    if (nome.length < 3) return res.status(400).json({ error: 'informe o nome completo' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'informe um e-mail válido' });

    try {
        const reg = await porSlug(slug);
        if (!reg) return res.status(404).json({ error: 'proposta não encontrada' });

        const spec = reg.spec || {};
        // Serviço oferecido nas duas modalidades tem DOIS valores, e o aceite
        // não pergunta qual. Registrar `preco` (Monitoria + Atuação) poria no
        // card um número maior do que o cliente pode ter aceitado; o piso é o
        // que a própria proposta exibe ("a partir de"), então é ele que vai — e
        // o aviso no card diz que a modalidade ainda precisa ser confirmada.
        //
        // A marca é o próprio `precoMonitoria`: ele só é gravado no serviço que
        // está em comparação. Assim esta rota não precisa saber o catálogo de
        // modalidades nem repetir a regra de quem compara. (`compararModalidades`
        // é a chave de contrato da primeira versão, lida só por compatibilidade.)
        const temSegundoPreco = (p) => p?.precoMonitoria != null && p.precoMonitoria !== '';
        const precoDe = (c) => {
            const p = spec.porProduto?.[c] || {};
            return temSegundoPreco(p) ? (Number(p.precoMonitoria) || 0) : (Number(p.preco) || 0);
        };
        const duasModalidades = spec.compararModalidades === true
            || (spec.produtos || []).some((c) => temSegundoPreco(spec.porProduto?.[c]));
        const soma = (spec.produtos || []).reduce((t, c) => t + precoDe(c), 0);
        const valor = Number(spec.pacote) > 0 ? Number(spec.pacote) : soma;

        const { novo, aceite } = await registrarAceite(slug, reg.deal_id, { nome, email, cargo, valor });
        // Duplo clique, ou alguém reenviando o formulário, não gera dois avisos
        // no card — o closer receberia a mesma notícia duas vezes.
        if (!novo) return res.json({ ok: true, jaAceita: true, quando: aceite.quando });

        const url = `${PROPOSAL_FORM_BASE_URL}/p/${slug}`;
        const quando = new Date(aceite.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
        const reais = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
        try {
            await pdPost('/notes', {
                deal_id: reg.deal_id,
                content: [
                    '<p><b>✅ PROPOSTA ACEITA PELO CLIENTE</b></p>',
                    `<p><b>${nome}</b>${cargo ? ` — ${cargo}` : ''}<br>${email}</p>`,
                    `<p>Valor aceito: <b>${reais}/mês</b><br>Em: ${quando}</p>`,
                    duasModalidades
                        ? '<p><b>⚠ Confirme a modalidade.</b> A proposta trazia Monitoria e Monitoria + Atuação lado a lado. O valor acima soma o serviço comparado na Monitoria — se o cliente escolheu com atuação, corrija o valor do negócio.</p>'
                        : '',
                    `<p><a href="${url}">${url}</a></p>`,
                    '<p><i>Aceite comercial declarado na página da proposta. Não é assinatura eletrônica certificada.</i></p>',
                ].join(''),
            });
            log.info(`deal #${reg.deal_id}: aviso de aceite postado no card`);
        } catch (e) {
            // O aceite JÁ está registrado. Falhar aqui não pode desfazer isso
            // nem dizer ao cliente que não deu certo.
            log.error(`deal #${reg.deal_id}: aceite registrado mas o aviso no card FALHOU — ${e.message}`);
        }

        res.json({ ok: true, quando: aceite.quando });
    } catch (err) {
        log.error(`aceite/${slug}: ${err.message}`);
        res.status(500).json({ error: 'não consegui registrar o aceite' });
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
