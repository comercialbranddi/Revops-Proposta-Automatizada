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
