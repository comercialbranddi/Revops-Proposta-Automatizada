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
 * Quantas páginas tem um PDF, lendo o próprio arquivo.
 *
 * Serve de trava pro balanço da última folha: se empurrar o fecho criar uma
 * página a mais, a gente desiste e devolve o PDF original. `/Type /Page` sem o
 * "s" é a entrada de página; `/Type /Pages` é o nó da árvore e não conta.
 * Devolve 0 quando não reconhece o formato — e aí o balanço nem é tentado.
 */
function contarPaginas(pdf) {
    return (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

/**
 * Quanto empurrar o fecho pra baixo, em px, a partir da folga da última folha.
 *
 * Metade da folga É a centralização: sobra o mesmo acima e abaixo. O mínimo
 * existe pra não mexer por 2cm — aí o documento já está cheio e empurrar só
 * abriria um buraco no meio. O teto impede que um fecho minúsculo numa folha
 * quase vazia vire uma frase perdida no centro do nada.
 *
 * Exportada porque é a única parte disto que dá pra testar sem navegador.
 */
export function alturaDeBalanco({ folga, alturaPagina, mm = 96 / 25.4, minimoMm = 35 }) {
    if (!(folga > 0) || !(alturaPagina > 0)) return 0;
    if (folga <= minimoMm * mm) return 0;
    return Math.round(Math.min(folga / 2, alturaPagina * 0.45));
}

/**
 * Quanto sobra na última folha, medido no navegador em mídia de impressão.
 *
 * Por que simular em vez de perguntar: o Chrome não expõe onde caiu cada quebra
 * de página, e descobrir por tentativa custa um `page.pdf()` por palpite —
 * quatro segundos cada, com o closer esperando o download.
 *
 * A simulação percorre as UNIDADES do corpo na ordem e vai enchendo folha por
 * folha. Unidade é o que a paginação não parte: cada filho de cláusula (que são
 * `break-inside: avoid` no CSS de impressão), com o cabeçalho de seção colado
 * no bloco seguinte, porque `break-after: avoid` não deixa o título ficar
 * órfão no pé da folha.
 *
 * `MARGEM_MM` é a diferença que a simulação não modela: o padding da cláusula,
 * que o `box-decoration-break: clone` repete no topo de cada fragmento, e o
 * rodapé fixo, que não ocupa espaço no fluxo mas cobre o pé da folha. Aferida
 * contra a paginação real em 27/08/2026 — a simulação errava de 13 a 20mm PRA
 * MAIS nos três documentos medidos. Descontar deixa a estimativa conservadora,
 * que é o lado certo de errar: no máximo centraliza menos do que podia.
 */
async function medirUltimaFolha(page) {
    return page.evaluate((MARGEM_MM) => {
        // A altura da folha sai de uma régua de 297mm renderizada de verdade, e
        // não de uma constante: se o @page mudar, a régua muda junto.
        const regua = document.createElement('div');
        regua.style.cssText = 'position:absolute;top:0;left:0;width:1mm;height:297mm;visibility:hidden';
        document.body.append(regua);
        const alturaPagina = regua.offsetHeight;
        regua.remove();
        const mm = alturaPagina / 297;

        const pad = document.querySelector('.pad');
        const cta = document.querySelector('.cta');
        if (!pad || !cta) return null;

        // O fecho é a chamada final mais o que estiver colado nela: o aviso de
        // aceite quando a proposta tem link, o carimbo de "já aceita" quando foi
        // aceita, e nada quando é uma amostra sem link. Marcado aqui pra que o
        // espaçador entre exatamente antes do que foi medido.
        const antes = cta.previousElementSibling;
        const colado = antes && (antes.id === 'aceite' || antes.classList.contains('aceito'));
        (colado ? antes : cta).dataset.fecho = '';

        const unidades = [];
        for (const secao of pad.children) {
            const filhos = [...secao.children];
            if (!filhos.length) { unidades.push([secao]); continue; }
            let colados = [];
            for (const filho of filhos) {
                colados.push(filho);
                if (!filho.classList.contains('sechead')) { unidades.push(colados); colados = []; }
            }
            if (colados.length) unidades.push(colados);
        }

        let folhaCheia = 0;
        let baseAnterior = null;
        for (const unidade of unidades) {
            const topo = unidade[0].getBoundingClientRect().top;
            const base = unidade[unidade.length - 1].getBoundingClientRect().bottom;
            const altura = base - topo;
            // O vão entre unidades vem do fluxo real, então margem e gap do CSS
            // entram na conta sem precisar lê-los um a um.
            const vao = baseAnterior === null ? 0 : Math.max(0, topo - baseAnterior);
            if (folhaCheia + vao + altura > alturaPagina) folhaCheia = altura;
            else folhaCheia += vao + altura;
            baseAnterior = base;
        }

        return { alturaPagina, mm, folga: alturaPagina - folhaCheia - MARGEM_MM * mm };
    }, 20);
}

/**
 * Centraliza o fecho na última folha, quando sobra espaço. Devolve o PDF
 * balanceado, ou o original se não deu.
 *
 * Segunda passada de propósito: o navegador já está aberto e o documento já
 * está montado, então um `page.pdf()` a mais custa cerca de um segundo — e só
 * acontece quando há sobra pra valer.
 *
 * A trava é a contagem de páginas. Se o empurrão criar folha nova (porque o
 * fecho não começava no topo, ou porque o Chrome paginou diferente do que a
 * conta supôs), o PDF original volta. Nunca piora, no máximo não melhora.
 */
async function balancearUltimaPagina(page, pdfOriginal, opcoes) {
    const paginas = contarPaginas(pdfOriginal);
    if (!paginas) return pdfOriginal;   // formato não reconhecido: não arrisca

    let medida;
    try {
        await page.emulateMediaType('print');   // medir no que vai pro papel
        medida = await medirUltimaFolha(page);
    } catch { return pdfOriginal; }
    if (!medida) return pdfOriginal;

    const empurrao = alturaDeBalanco(medida);
    if (empurrao <= 0) return pdfOriginal;

    // Espaçador em bloco, e não margem: margem no começo de uma folha é
    // descartada pelo Chrome, e o empurrão simplesmente não aconteceria.
    await page.evaluate((px) => {
        const fecho = document.querySelector('[data-fecho]');
        if (!fecho) return;
        const espaco = document.createElement('div');
        espaco.dataset.balanco = '';
        espaco.style.cssText = `height:${px}px;flex:none`;
        fecho.parentNode.insertBefore(espaco, fecho);
    }, empurrao);

    const tentativa = Buffer.from(await page.pdf(opcoes));
    if (contarPaginas(tentativa) === paginas) {
        log.info(`última folha balanceada: fecho empurrado ${Math.round(empurrao / medida.mm)}mm`);
        return tentativa;
    }
    log.info('balanço da última folha desfeito — o empurrão criaria uma página');
    return pdfOriginal;
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

        const opcoes = {
            // `preferCSSPageSize` faz valer o @page do documento (A4 e as margens)
            // em vez de um tamanho decidido aqui — a paginação do PDF é a MESMA
            // que o closer vê na pré-visualização.
            preferCSSPageSize: true,
            printBackground: true,
            // Sem cabeçalho/rodapé do Chrome (aquela caixa marcada que estampava
            // URL e data). O rodapé de página é do próprio documento: um elemento
            // position:fixed que o Chrome repete no pé de cada folha impressa, e
            // que a capa (fundo opaco + z-index) cobre na primeira.
            displayHeaderFooter: false,
        };

        const pdf = Buffer.from(await page.pdf(opcoes));
        const balanceado = await balancearUltimaPagina(page, pdf, opcoes);
        log.info(`PDF gerado em ${Date.now() - t0}ms, ${Math.round(balanceado.length / 1024)}KB`);
        return balanceado;
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
