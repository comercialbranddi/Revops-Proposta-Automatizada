import 'dotenv/config';
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
