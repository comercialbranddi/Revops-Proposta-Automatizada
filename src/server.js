import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import proposalRouter from './routes/proposal.js';
import { getContextLogger } from './lib/logger.js';

const log = getContextLogger('server');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/proposal', proposalRouter);

// A Vercel manda TODO caminho pra esta função (conferido em produção: '/' e
// '/qualquer-coisa' devolvem o 404 do próprio Express), então a página do
// formulário é servida daqui mesmo — não como arquivo estático da Vercel.
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(PUBLIC_DIR));

// O dealId fica na URL só pra ser legível e colável; quem manda é o token do
// login, e o back busca o negócio pelo id. Sem sessão, sem estado.
app.get('/proposta/:dealId', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'proposta.html')));

/**
 * O PDF da proposta — o arquivo que vai pro lead.
 *
 * Gerado no servidor de propósito: o PDF do Ctrl+P do navegador sai com a URL
 * interna estampada em toda página (a caixa "Cabeçalhos e rodapés" do Chrome
 * vem marcada), e com margem e escala que variam por closer. Aqui o arquivo é
 * o mesmo sempre.
 *
 * Pública, igual à página: quem tem o link tem o PDF.
 */
app.get('/pdf/:slug', async (req, res) => {
    try {
        const { porSlugComVersao, aceiteDe } = await import('./services/spec-store.js');
        const { renderProposta } = await import('./services/render-proposta.js');
        const { htmlParaPdf, nomeDoArquivo } = await import('./services/pdf.js');
        const { pdGet } = await import('./services/pipedrive.js');

        const reg = await porSlugComVersao(req.params.slug);
        if (!reg) return res.status(404).type('text/plain; charset=utf-8')
            .send('Proposta não encontrada. Confira o link com quem enviou.');

        const deal = (await pdGet(`/deals/${reg.deal_id}`))?.data;
        const organizacao = deal?.org_name || deal?.org_id?.name;
        const html = renderProposta({
            deal: { id: reg.deal_id, organizacao, contato: deal?.person_name || deal?.person_id?.name },
            spec: reg.spec,
            emitidaEm: new Date(reg.registrado_em),
            slug: reg.slug,
            aceite: await aceiteDe(reg.slug),
            substituida: reg.substituida,
        });

        const pdf = await htmlParaPdf(html);
        // `inline` e não `attachment`: quem clica quer VER antes de mandar pro
        // cliente. O navegador abre no leitor e o botão de salvar já usa este
        // nome de arquivo.
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${nomeDoArquivo(organizacao, `PC-${reg.deal_id}`)}"`);
        res.send(pdf);
    } catch (err) {
        log.error(`/pdf/${req.params.slug}: ${err.stack || err.message}`);
        res.status(500).type('text/plain; charset=utf-8')
            .send('Não consegui gerar o PDF. Abra a proposta pelo link e avise o RevOps.');
    }
});

// A proposta que o cliente abre. PÚBLICA de propósito — ela circula por e-mail
// e dentro do cliente, e exigir login mataria o uso. O que protege é o slug:
// 22 caracteres aleatórios, não sequencial, pra ninguém chegar na proposta do
// vizinho trocando um número.
app.get('/p/:slug', async (req, res) => {
    try {
        const { porSlugComVersao } = await import('./services/spec-store.js');
        const { renderProposta } = await import('./services/render-proposta.js');
        const reg = await porSlugComVersao(req.params.slug);
        if (!reg) return res.status(404).type('text/plain; charset=utf-8')
            .send('Proposta não encontrada. Confira o link com quem enviou.');
        const { pdGet } = await import('./services/pipedrive.js');
        const deal = (await pdGet(`/deals/${reg.deal_id}`))?.data;
        const { aceiteDe } = await import('./services/spec-store.js');
        const html = renderProposta({
            deal: { id: reg.deal_id, organizacao: deal?.org_name || deal?.org_id?.name, contato: deal?.person_name || deal?.person_id?.name },
            spec: reg.spec,
            emitidaEm: new Date(reg.registrado_em),
            slug: reg.slug,
            aceite: await aceiteDe(reg.slug),
            substituida: reg.substituida,
        });
        res.type('text/html; charset=utf-8').send(html);

        // Depois de responder: a página do cliente não espera a planilha.
        const { afterResponse } = await import('./lib/after-response.js');
        afterResponse(async () => {
            const { registrarAbertura } = await import('./services/spec-store.js');
            await registrarAbertura(reg.slug, reg.deal_id, req.get('user-agent'));
        });
    } catch (err) {
        log.error(`/p/${req.params.slug}: ${err.message}`);
        res.status(500).type('text/plain; charset=utf-8').send('Não consegui montar a proposta.');
    }
});

app.use((err, req, res, next) => {
    log.error(err.stack || err.message);
    res.status(500).json({ error: 'Erro interno' });
});

// Vercel sets process.env.VERCEL="1" — só sobe listener persistente localmente.
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3838;
    app.listen(PORT, () => log.info(`🚀 automacoes-funil-vendas rodando na porta ${PORT}`));
}

export default app;
