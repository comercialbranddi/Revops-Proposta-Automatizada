/**
 * HTML para PDF, no servidor.
 *
 * Existe porque só o PDF vai pro lead, e o PDF do Ctrl+P não é confiável para
 * isso: ele depende de coisas que o closer controla e nós não.
 *
 *   • a caixa "Cabeçalhos e rodapés" do Chrome vem MARCADA por padrão, e
 *     estampa a URL interna (revops-proposta-automatizada.vercel.app), a data
 *     e "1/4" em toda página do documento que chega no cliente;
 *   • margem e escala ficam salvas por usuário, então dois closers geram
 *     arquivos visivelmente diferentes da mesma proposta;
 *   • Firefox ignora parte das regras de quebra de página que o modelo usa.
 *
 * Aqui o arquivo sai igual sempre, independente de quem clicou e de onde.
 *
 * ─── Como roda em cada lugar ────────────────────────────────────────
 *
 * Na Vercel: @sparticuz/chromium, que é um Chromium empacotado pra rodar em
 * função serverless. Localmente ele não funciona (o binário é Linux), então o
 * código cai no Chrome instalado na máquina — é o que permite testar sem
 * subir. Sem nenhum dos dois, lança com mensagem clara em vez de devolver um
 * PDF vazio.
 */
import puppeteer from 'puppeteer-core';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:pdf');

const NA_VERCEL = !!process.env.VERCEL;

// Onde o Chrome costuma estar em cada sistema, pra rodar local sem configurar
// nada. PROPOSAL_CHROME_PATH tem precedência, pra quem instalou em outro lugar.
const CHROME_LOCAL = [
    process.env.PROPOSAL_CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean);

async function acharChromeLocal() {
    const { existsSync } = await import('node:fs');
    return CHROME_LOCAL.find((p) => existsSync(p)) || null;
}

/** Abre o navegador certo pro ambiente. */
async function abrirNavegador() {
    if (NA_VERCEL) {
        const chromium = (await import('@sparticuz/chromium')).default;
        return puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        });
    }
    const executablePath = await acharChromeLocal();
    if (!executablePath) {
        throw new Error('não achei Chrome nem Edge nesta máquina — defina PROPOSAL_CHROME_PATH para gerar PDF localmente');
    }
    return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
}

/**
 * Converte o HTML da proposta em PDF.
 *
 * @param {string} html documento completo, autocontido
 * @returns {Promise<Buffer>}
 */
export async function htmlParaPdf(html) {
    const t0 = Date.now();
    let navegador;
    try {
        navegador = await abrirNavegador();
        const page = await navegador.newPage();

        // `networkidle0` porque o documento carrega Inter do Google Fonts.
        // Sem esperar, o PDF sai na fonte de reserva — e a fonte é metade da
        // identidade que a gente acabou de acertar.
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25000 });
        // Cinturão e suspensório: se a fonte ainda não estiver pronta, o PDF
        // esperaria por ela mesmo assim.
        await page.evaluate(() => document.fonts.ready);

        const pdf = await page.pdf({
            // `preferCSSPageSize` faz valer o @page do documento (A4 e as
            // margens do modelo) em vez de um tamanho decidido aqui — assim a
            // paginação do PDF é a MESMA que o closer vê na pré-visualização.
            preferCSSPageSize: true,
            printBackground: true,
            // Sem cabeçalho e sem rodapé do navegador. É exatamente o que a
            // caixa marcada do Chrome fazia de errado.
            displayHeaderFooter: false,
        });
        log.info(`PDF gerado em ${Date.now() - t0}ms, ${Math.round(pdf.length / 1024)}KB`);
        return Buffer.from(pdf);
    } finally {
        // Função serverless que não fecha o navegador vaza processo e estoura
        // a memória na segunda chamada.
        if (navegador) await navegador.close().catch(() => {});
    }
}

/** Nome do arquivo que o cliente vê ao baixar. */
export function nomeDoArquivo(organizacao, numero) {
    const limpo = String(organizacao || 'Proposta')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    return `Proposta-Branddi-${limpo}-${numero}.pdf`;
}
