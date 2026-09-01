/**
 * Bateria de LAYOUT — mede a página num navegador, em modo de impressão.
 *
 * Existe porque a bateria de conteúdo (`testa-render.js`) roda em Node, sem
 * DOM: ela prova que o texto certo está no HTML, e nada sobre onde ele cai na
 * folha. Foi assim que o preço dos cards de pacote foi pro cliente furando a
 * borda em 80px (achado pela Jessica em 24/08/2026, não pela bateria): o número
 * é `white-space:nowrap` num card estreito, e nenhum teste de string vê isso.
 *
 * O que ela afere, com o Chrome emulando `print` numa A4:
 *
 *   1. nenhum elemento ultrapassa a caixa de conteúdo do pai (o estouro);
 *   2. nenhum contêiner tem conteúdo inline maior que a própria caixa —
 *      segundo sinal, pega o caso em que o pai é bloco e só o texto vaza.
 *
 * Os cenários são os que APERTAM o layout: 3 e 4 opções de pacote (cards
 * estreitos), valores de 6 dígitos, e a comparação avulso × pacote, que gera um
 * card por serviço. Proposta de um produto só nunca reproduziu o defeito.
 *
 * Uso: npm run test:layout   (precisa de Chrome/Edge na máquina)
 * Sai com código 1 se qualquer cenário estourar — serve de porta pra deploy.
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { renderProposta } from '../src/services/render-proposta.js';

const CHROME = [
    process.env.PROPOSAL_CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p));

const prod = (c, e = {}) => ({
    modalidade: c === 'BBP' ? null : 'Monitoria + Atuação',
    canais: { BB: [1592, 1593], BBP: [1598], GD: [1599, 1600, 1601], VM: [1604] }[c],
    quantidade: { BB: 10, BBP: 100, GD: null, VM: 5 }[c],
    preco: { BB: 9900, BBP: 4500, GD: 3800, VM: 3800 }[c],
    faixas: [], sobConsulta: false, ...e,
});

const base = (extra) => ({
    marcas: ['Marca Teste'], idioma: 'pt', produtos: ['BB', 'BBP', 'GD', 'VM'],
    observacoes: '', obsProposta: '',
    porProduto: { BB: prod('BB'), BBP: prod('BBP'), GD: prod('GD'), VM: prod('VM') },
    ...extra,
});

const CASOS = [
    {
        nome: '3 opções de pacote — cards estreitos',
        spec: base({ pacotes: [
            { produtos: ['BB', 'BBP', 'GD', 'VM'], extras: [], preco: 12400, rotulo: '' },
            { produtos: ['BB', 'BBP'], extras: [], preco: 11900, rotulo: '' },
            { produtos: ['GD', 'VM'], extras: [], preco: 1000, rotulo: '' },
        ] }),
    },
    {
        // Seis dígitos é o pior caso do número: "R$ 145.900,00/mês".
        nome: '4 opções com valores de 6 dígitos',
        spec: base({ pacotes: [
            { produtos: ['BB', 'BBP', 'GD', 'VM'], extras: [], preco: 145900, rotulo: '' },
            { produtos: ['BB', 'BBP', 'GD'], extras: [], preco: 129900, rotulo: '' },
            { produtos: ['BB', 'BBP'], extras: [], preco: 118900, rotulo: '' },
            { produtos: ['GD', 'VM'], extras: [], preco: 107900, rotulo: '' },
        ] }),
    },
    {
        // Pacote único vira comparação: um card por serviço + o pacote = 5 cards.
        nome: 'avulso × pacote — 5 cards na mesma linha',
        spec: base({ pacote: 18000 }),
    },
    {
        // Preço de tabela ("de/por"): a célula de valor ganha uma 2ª linha, o
        // riscado, na coluna mais apertada da tabela — pior caso com 6 dígitos
        // nos dois valores, "R$ 145.900,00" riscado sobre "R$ 99.900,00".
        nome: 'preço de tabela — riscado de 6 dígitos na célula de valor',
        spec: base({ porProduto: { ...base().porProduto, BB: prod('BB', { preco: 99900, precoTabela: 145900 }) } }),
    },
    {
        // Frente de texto livre no rótulo: o nome do card fica comprido.
        nome: 'pacote com frente digitada e rótulo longo',
        spec: base({ pacotes: [
            { produtos: ['BB', 'BBP'], extras: ['Marketplaces adicionais', 'App Store'], preco: 21900,
                rotulo: 'Cobertura ampliada com marketplaces adicionais' },
            { produtos: ['GD', 'VM'], extras: [], preco: 9900, rotulo: '' },
        ] }),
    },
];

/** Roda no navegador: devolve a lista de estouros da página. */
function medir() {
    const out = [];
    // 1) Elemento que ultrapassa a caixa de conteúdo do pai.
    for (const el of document.querySelectorAll('.doc *')) {
        const pai = el.parentElement;
        if (!pai) continue;
        const cs = getComputedStyle(pai);
        if (cs.overflowX !== 'visible') continue;   // quem rola já trata o excesso
        const r = el.getBoundingClientRect();
        const p = pai.getBoundingClientRect();
        if (!r.width) continue;
        const dir = p.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
        const esq = p.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
        const fura = Math.max(r.right - dir, esq - r.left);
        if (fura > 1) {
            out.push(`${el.className || el.tagName} fura ${pai.className || pai.tagName} em ${Math.round(fura)}px — "${(el.textContent || '').trim().slice(0, 32)}"`);
        }
    }
    // 2) Contêiner cujo conteúdo inline é maior que a própria caixa. Pega o caso
    //    em que o pai é bloco (largura cheia, rect não acusa) e só o texto vaza.
    for (const el of document.querySelectorAll('.preco,.pname,.itrow,.kv,.spec,.sla,.pcard,.card')) {
        const excesso = el.scrollWidth - el.clientWidth;
        if (excesso > 1) out.push(`${el.className} tem conteúdo ${excesso}px maior que a caixa`);
    }
    return out;
}

if (!CHROME) {
    console.error('não achei Chrome nem Edge — defina PROPOSAL_CHROME_PATH para rodar a bateria de layout');
    process.exit(1);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
let falharam = 0;

for (const caso of CASOS) {
    const html = renderProposta({
        deal: { id: 60956, organizacao: 'Marca Teste', contato: 'Fulano de Tal' },
        spec: caso.spec, emitidaEm: new Date(2026, 7, 24),
    });
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setViewport({ width: 794, height: 1123 });   // A4 a 96dpi
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const estouros = await page.evaluate(medir);
    await page.close();

    if (estouros.length) {
        falharam++;
        console.log(`❌ ${caso.nome}`);
        estouros.slice(0, 8).forEach((e) => console.log(`      ${e}`));
        if (estouros.length > 8) console.log(`      … e mais ${estouros.length - 8}`);
    } else {
        console.log(`✅ ${caso.nome}`);
    }
}

await browser.close();
console.log(falharam ? `\n❌ ${falharam} de ${CASOS.length} cenários com estouro` : `\n✅ ${CASOS.length} cenários, nada furando a folha`);
process.exit(falharam ? 1 : 0);
