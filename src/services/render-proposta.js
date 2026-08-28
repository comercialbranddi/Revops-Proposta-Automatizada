/**
 * Monta o documento da proposta a partir do spec do formulário e do catálogo
 * de blocos, em português, inglês ou espanhol. Saída: HTML autocontido — só o
 * Google Fonts como recurso externo, com CSS de impressão, pra virar PDF direto
 * do navegador (Puppeteer, ver services/pdf.js).
 *
 * ─── Identidade visual (Branddi Design System) ──────────────────────
 *
 * O documento segue o design system da marca: dark mode (petrol #002B36 com
 * gradiente radial), acento cyan #0ACFDE, Inter no corpo/título e JetBrains
 * Mono nos números/rótulos/refs. É uma peça de marca, não uma folha de contrato
 * cinza: capa dedicada com hero, glass cards, cards de preço, timeline de
 * aceite e chamada de fechamento. O modelo validado (PDF gerado em 20/08/2026)
 * é a referência.
 *
 * Nada aqui inventa texto de negócio. Prosa, especificações e SLA vêm de
 * `content/`; números e escolhas vêm do spec. A copy da moldura (hero, loop,
 * subtítulos de seção, tagline) vem de `content/textos.js`, nos três idiomas.
 *
 * ─── Idioma ─────────────────────────────────────────────────────────
 *
 * Tudo que é texto sai de `catalogoDoIdioma(idioma)`: os blocos de produto e a
 * moldura do documento. DUAS coisas NÃO acompanham o idioma, de propósito: a
 * moeda (real, formatação brasileira, nos três) e a modalidade gravada no spec
 * (português, valor canônico do formulário/planilha; só a exibição traduz).
 */
import {
    catalogoDoIdioma, linhasDaModalidade, linhasComparadas, prosaDoBloco, contratoTemAtuacao,
    modalidadeNoIdioma, MODALIDADE_AMBOS, MODALIDADE_MONITORIA, MODALIDADE_COMPARAR,
} from '../content/blocos.js';
import { logo, marca } from '../content/logo.js';
import { VALIDADE_DIAS_PADRAO } from '../content/textos.js';
import { CANAIS_OPTION_TO_LABEL, CANAIS_LABEL_POR_IDIOMA, PRODUCT_CASCADE_ORDER, IDIOMAS_COM_BLOCOS, IDIOMA_LABEL } from '../config/proposal.js';

const TZ = 'America/Sao_Paulo';
const CLAUSULA_INVESTIMENTO = 4;

// Regime abreviado pra faixa da capa (o valor completo — "Mensal recorrente,
// sem fidelidade" — não cabe na célula). Curto, no idioma.
const REGIME_CURTO = { pt: 'Mensal', en: 'Monthly', es: 'Mensual' };

/**
 * O CSS sem os comentários. Eles explicam decisão interna, em português, e iam
 * parar no "ver código-fonte" do cliente — inclusive numa proposta em inglês.
 * Ficam no arquivo, saem do documento.
 */
let _css = null;
const cssLimpo = () => (_css ??= CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[ \t]*\n[ \t]*\n+/g, '\n'));

const esc = (s) => String(s ?? '')
    .replace(/&(?!\w+;|#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A prosa do catálogo tem <strong> de propósito — é ênfase editorial, não dado
// de usuário. Escapa tudo e devolve só essa tag.
const rich = (s) => esc(s).replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');

// Formatação brasileira em qualquer idioma. O   que o toLocaleString põe entre
// "R$" e o número vira espaço normal: visualmente idêntico, e a saída deixa de
// depender de um caractere invisível pra quem for ler o documento depois.
const brl = (n) => Number(n)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
    // O que o toLocaleString põe entre "R$" e o número é um espaço não-quebrável
    // (NBSP/narrow-NBSP). Vira espaço normal: visualmente idêntico e a saída deixa
    // de depender de um caractere invisível pra busca, teste ou extração de PDF.
    .replace(/\s/g, ' ');

// Preço sem os centavos quando são zero — pros cards de pacote, onde o número
// grande respira melhor sem ",00" (e onde a largura é escassa).
const brlCurto = (n) => brl(n).replace(/,00$/, '');

/**
 * Preço grande dos cards de pacote: "R$ 45.546,00 /mês", com os centavos e o
 * "/mês" menores, como no modelo. Mono, tabular, cor cyan (via CSS).
 */
function precoGrande(n, t) {
    // `brlCurto`: sem o ",00" quando o valor é redondo — que é a regra, com o
    // formulário em passos de 100. Os centavos custavam ~20% da largura do card
    // e, num card de 3 colunas, era essa largura que forçava o número a encolher
    // até ficar menor que o nome do produto. Valor quebrado (",50") mantém.
    const s = brlCurto(n);
    const i = s.lastIndexOf(',');
    const inteiro = i >= 0 ? s.slice(0, i) : s;
    const cent = i >= 0 ? s.slice(i) : '';
    return `<span class="preco"><span class="pv">${esc(inteiro)}</span><span class="pc">${esc(cent)}</span><span class="pm">${esc(t.porMesCurto)}</span></span>`;
}

/**
 * Data no idioma do documento. Inglês sai com o mês escrito ("August 18,
 * 2026"); português e espanhol usam numérico (mesma ordem, não confunde).
 */
function dataNoIdioma(d, idioma) {
    const opcoes = idioma === 'en'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' };
    const locale = idioma === 'en' ? 'en-US' : (idioma === 'es' ? 'es-ES' : 'pt-BR');
    return new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opcoes }).format(d);
}

/** Ordem canônica dos produtos — BB primeiro, igual ao resto do sistema. */
function produtosOrdenados(spec) {
    return PRODUCT_CASCADE_ORDER.filter((c) => (spec.produtos || []).includes(c));
}

/** Rótulo de canal no idioma; nome próprio de plataforma não se traduz. */
function canaisTexto(p, idioma) {
    const doCatalogo = (p.canais || [])
        .map((id) => CANAIS_LABEL_POR_IDIOMA[idioma]?.[id] || CANAIS_OPTION_TO_LABEL[id])
        .filter(Boolean);
    // Canal digitado no formulário — a lista fixa nunca cobre as 18 combinações
    // reais de plataforma que as propostas do time trazem.
    const digitados = (p.canaisOutros || []).map((c) => String(c).trim()).filter(Boolean);
    const labels = [...doCatalogo, ...digitados];
    return labels.length ? labels.join(', ') : null;
}

/**
 * Preenche os marcadores do catálogo com o que veio do formulário. Devolve null
 * quando o marcador não tem valor — a linha inteira some, em vez de sair
 * "Canais: {{CANAIS}}" no documento do cliente.
 */
function valorLinha(valor, p, idioma) {
    let v = valor;
    if (v.includes('{{CANAIS}}')) {
        const c = canaisTexto(p, idioma);
        if (!c) return null;
        v = v.replace('{{CANAIS}}', c);
    }
    if (v.includes('{{QUANTIDADE}}')) {
        if (!(Number(p.quantidade) > 0)) return null;
        v = v.replace('{{QUANTIDADE}}', String(p.quantidade));
    }
    // [[singular|plural]], resolvido pela quantidade. O catálogo trazia só o
    // plural, então uma venda de uma plataforma dizia ao cliente "Até 1
    // marketplaces monitorados simultaneamente". Marcar o trecho no lugar em
    // que ele é escrito mantém a frase legível numa linha só, em vez de
    // duplicar a linha inteira em duas versões nos três idiomas.
    v = v.replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g,
        (_, um, muitos) => (Math.abs(Number(p.quantidade)) === 1 ? um : muitos));
    return v;
}

/**
 * As opções de pacote, normalizadas. Aceita as DUAS formas gravadas na planilha:
 * `pacote: 15800` (valor fechado) e `pacotes: [{produtos, extras, preco}]`.
 * Cada opção sai com `soma` — o preço cheio do que contém — pra dar o "de/por".
 */
/**
 * `nomesForaDoDeal`: nomes (minúsculos) dos produtos do catálogo que NÃO estão
 * nesta proposta. Serve pra tirar do pacote qualquer resquício deles — seja no
 * array de produtos, seja numa "frente" (extra) de texto livre, seja no rótulo.
 * É o que evita um "Brand Bidding + golpes" aparecer numa venda que não tem
 * Golpes: segue o formulário, não inventa.
 */
function opcoesDePacote(spec, codes, nomesForaDoDeal = []) {
    const precoDe = (c) => Number(spec.porProduto?.[c]?.preco) || 0;
    // Um texto cita um produto fora do deal? (ex.: "golpes" ~ "Golpes Digitais")
    const citaForaDoDeal = (txt) => {
        const t = String(txt || '').trim().toLowerCase();
        return !!t && nomesForaDoDeal.some((n) => n && (n.includes(t) || t.includes(n)));
    };
    const lista = Array.isArray(spec.pacotes) && spec.pacotes.length
        ? spec.pacotes
        : (Number(spec.pacote) > 0 ? [{ produtos: codes, extras: [], preco: Number(spec.pacote) }] : []);
    return lista
        // 1) Pacote que referencia um PRODUTO fora do deal é resquício — sai inteiro.
        .filter((o) => (o.produtos || []).every((c) => codes.includes(c)))
        .map((o) => {
            const produtos = (o.produtos || []).filter((c) => codes.includes(c));
            // 2) Frente (extra) que nomeia um produto fora do deal (ex.: "golpes"
            //    numa proposta sem Golpes Digitais) é resquício — sai.
            const extras = (o.extras || []).map((x) => String(x).trim())
                .filter((x) => x && !citaForaDoDeal(x));
            // 3) Rótulo livre que cita produto fora do deal não vale — cai pra
            //    composição real (produtos + frentes).
            const rotulo = (o.rotulo && !citaForaDoDeal(o.rotulo)) ? o.rotulo : null;
            return { ...o, produtos, extras, rotulo, soma: produtos.reduce((t, c) => t + precoDe(c), 0) };
        })
        // 4) Pacote é combinação: precisa de pelo menos DOIS itens (produto/frente),
        //    igual à regra do formulário. Um item só (o que sobra quando a frente
        //    resquício sai) não é pacote — não vira card.
        .filter((o) => Number(o.preco) > 0 && (o.produtos.length + o.extras.length) >= 2)
        .sort((a, b) => a.preco - b.preco);
}

/**
 * A unidade da quantidade do produto, pra escada dizer "até N do quê" — no
 * idioma do documento e no número da quantidade.
 *
 * Vinha da config, que só tem a versão em português e só no plural: uma
 * proposta em inglês saía com "Up to 5 palavras", e qualquer faixa de 1 saía
 * com "Até 1 marketplaces simultâneos". A config segue sendo a fonte do rótulo
 * do FORMULÁRIO, que é em português; o documento lê o catálogo do idioma.
 */
function unidadeDe(code, qtd, t) {
    const u = t.unidades?.[code];
    if (!u) return null;
    return Math.abs(Number(qtd)) === 1 ? u[0] : u[1];
}

/**
 * A modalidade efetiva de um produto: null quando o produto não tem essa
 * dimensão. A marca de comparação nunca vaza daqui — quem compara pede as
 * duas explicitamente, e o resto do documento nunca deve ver "As duas" no
 * lugar de uma modalidade de verdade.
 */
function modalidadeDo(blocos, code, p) {
    if (!blocos[code].temModalidade) return null;
    const m = p?.modalidade;
    return (!m || m === MODALIDADE_COMPARAR) ? MODALIDADE_AMBOS : m;
}

/**
 * ESTE serviço vai na proposta nas duas modalidades, com preço em cada uma,
 * para o cliente escolher? (28/08/2026.)
 *
 * A decisão é do SERVIÇO, e não do contrato como na primeira versão. A venda
 * é mista de verdade: dá pra querer Brand Bidding nas duas frentes, pra o
 * cliente comparar, e Vitrine Marketplace só em monitoria. Uma chave do
 * contrato inteiro forçava o serviço fixo a aparecer com duas colunas e uma
 * escolha que ele não oferece.
 *
 * Isso NÃO cria 2^n documentos: o cliente continua escolhendo entre duas
 * versões do contrato — em cada uma, o serviço fixo entra pelo mesmo preço,
 * e só os comparados mudam de valor.
 */
function comparaProduto(spec, blocos, code) {
    if (!blocos[code]?.temModalidade) return false;
    // Compatibilidade: a primeira versão gravava a decisão no contrato, valendo
    // pra todo produto com modalidade. Spec assim continua saindo como saía.
    if (spec?.compararModalidades === true) return true;
    return spec?.porProduto?.[code]?.modalidade === MODALIDADE_COMPARAR;
}

/** Algum serviço do contrato está sendo comparado? Decide o que é do documento. */
function comparandoModalidades(spec, blocos, codes) {
    return (codes || []).some((c) => comparaProduto(spec, blocos, c));
}

/** As duas modalidades na ordem do documento: a mais completa por último. */
const MODALIDADES_COMPARADAS = [MODALIDADE_MONITORIA, MODALIDADE_AMBOS];

/**
 * O preço de um item (produto ou faixa da escada) numa modalidade.
 *
 * `preco` continua sendo o de **Monitoria + Atuação** — era o único que existia
 * até 28/08/2026, e preservar esse significado é o que faz spec antigo, já
 * congelado na planilha, renderizar exatamente como no dia em que foi gerado.
 * `precoMonitoria` é o da monitoria pura.
 *
 * Ausente, cai no `preco`. É o certo para BBP, que não tem modalidade (quem
 * atua ali é o cliente): o valor é mesmo o mesmo nas duas colunas, e repetir o
 * número é mais honesto que deixar a célula vazia, o que pareceria que o
 * produto sai do escopo numa das opções.
 */
function precoNaModalidade(item, modalidade) {
    const base = Number(item?.preco) || 0;
    if (modalidade !== MODALIDADE_MONITORIA) return base;
    const m = item?.precoMonitoria;
    return (m == null || m === '') ? base : (Number(m) || 0);
}

/**
 * O total do contrato numa modalidade: o que o cliente paga se escolher essa.
 *
 * Serviço fora da comparação entra pelo próprio preço nas duas pontas — foi
 * vendido fixo, e a escolha do cliente não muda o valor dele.
 */
function totalNaModalidade(spec, blocos, codes, modalidade) {
    return codes.reduce((acc, c) => {
        const p = spec?.porProduto?.[c];
        return acc + (comparaProduto(spec, blocos, c)
            ? precoNaModalidade(p, modalidade)
            : (Number(p?.preco) || 0));
    }, 0);
}

/**
 * Condição negociada vence a padrão. O formulário manda em `spec.condicoes` só
 * o que o closer alterou; o que não vier segue sendo a condição padrão da
 * Branddi — evita que um esquecimento no formulário apague uma cláusula.
 */
function cond(ctx, chave, padrao) {
    const v = ctx.spec.condicoes?.[chave];
    return (typeof v === 'string' && v.trim()) ? v.trim() : padrao;
}

/**
 * A validade em dias, negociada ou padrão. Fora de `cond` porque é número, não
 * texto: dela saem a data limite da capa, a linha da cláusula 6, o prazo do
 * aceite e o aviso de proposta vencida. Lixo (zero, negativo, texto, absurdo)
 * cai no padrão — melhor a proposta valer 15 dias do que valer -3.
 */
function validadeEmDias(spec) {
    const n = Math.trunc(Number(spec?.condicoes?.validadeDias));
    return Number.isFinite(n) && n > 0 && n <= 365 ? n : VALIDADE_DIAS_PADRAO;
}

// ─── Componentes ────────────────────────────────────────────────────

/** Cabeçalho de cláusula: badge numerado + título + subtítulo. */
function sechead(n, titulo, sub) {
    return `<header class="sechead"><span class="secnum">${esc(n)}</span>
    <div class="secttl"><h2>${esc(titulo)}</h2>${sub ? `<p class="secsub">${esc(sub)}</p>` : ''}</div></header>`;
}

/** Grade rótulo/valor em glass card (Identificação, Condições). */
function kvGrid(pares) {
    const itens = pares.filter(Boolean);
    const cells = itens.map(([r, v, cyan], i) => {
        // Em número ímpar de linhas, a última ocupa as duas colunas. Sem isso
        // ela fica numa metade só e a outra sobra vazia, com as bordas da grade
        // desenhando uma célula que não existe — era o print de 28/08, com a
        // "Validade da proposta" ao lado de um retângulo em branco. Tanto
        // Identificação (7) quanto Condições (5) caem nisso.
        const larga = i === itens.length - 1 && itens.length % 2 === 1 ? ' larga' : '';
        return `<div class="kv${larga}"><span class="kvl">${esc(r)}</span><span class="kvv${cyan ? ' cyan' : ''}">${rich(v)}</span></div>`;
    }).join('');
    return `<div class="card grid2">${cells}</div>`;
}

// Produtos que dependem de marca registrada no INPI. Brand Bidding NÃO entra:
// a atuação se apoia em concorrência desleal e uso indevido de marca, que não
// exigem registro — e há clientes de BB sem ele. Buy Box Protection também
// não: disputa Buy Box, não marca.
const EXIGE_INPI = ['GD', 'VM'];

// ─── Cláusulas ──────────────────────────────────────────────────────

function clausulaIdentificacao(ctx) {
    const { deal, spec, meta, codes, t, blocos } = ctx;
    // Comparando as modalidades o valor também é um piso: o quadro traz o
    // total da Monitoria, e a Monitoria + Atuação custa mais.
    const faixaDePreco = ctx.opcoes.length > 1 || comparandoModalidades(spec, blocos, codes);
    const valor = faixaDePreco ? t.aPartirDe(brl(ctx.total)) : brl(ctx.total);
    return kvGrid([
        // Sem "Destinatário": o nome da pessoa saiu em 27/08/2026. A proposta é
        // um documento entre EMPRESAS — quem assina pode não ser quem recebeu o
        // e-mail —, e repetir a organização numa segunda linha só duplicaria a
        // Contratante logo acima.
        [t.contratante, `<strong>${esc(deal.organizacao)}</strong>`],
        [t.contratada, t.contratadaValor],
        [t.marcas, (spec.marcas || []).join(', ')],
        [t.servicos, codes.map((c) => blocos[c].titulo).join(' · ')],
        [t.regime, t.regimeValor],
        [t.valorMensal, `${valor} · ${t.verClausula(CLAUSULA_INVESTIMENTO)}`, true],
        [t.validade, t.validadeValor(meta.validadeDias, meta.validade)],
    ]);
}

function clausulaObjetivo(ctx) {
    const { codes, deal, t, blocos } = ctx;
    const varios = codes.length > 1;
    // Um produto: prosa corrida, com o problema em destaque no meio da frase
    // (como no modelo). Vários: uma linha por produto.
    const corpo = varios
        ? `<div class="card prosa"><p>${esc(t.objetivoAbre(true))}</p>
        <ul>${codes.map((c) => `<li>${esc(blocos[c].objetivo)}</li>`).join('')}</ul>
        <p>${esc(t.objetivoFecha(true, deal.organizacao))}</p></div>`
        : `<div class="card prosa"><p>${esc(t.objetivoAbre(false))} <strong>${esc(blocos[codes[0]].objetivo)}</strong>.</p>
        <p>${esc(t.objetivoFecha(false, deal.organizacao))}</p></div>`;
    // Nota-insight opcional: só do produto principal e só se houver texto.
    const insight = t.insight?.[codes[0]];
    const nota = insight ? `<div class="note"><span class="note-ic">i</span><p>${rich(insight)}</p></div>` : '';
    return corpo + nota;
}

function clausulaAbordagem(ctx) {
    const { t, blocos, idioma, spec, codes } = ctx;
    // Um produto: o título/modalidade já estão no subtítulo da seção (3.1 — …),
    // então o bloco não repete o h3. Vários: cada produto ganha seu 3.x.
    const solo = codes.length === 1;
    const blocosHtml = codes.map((code, i) => {
        const b = blocos[code];
        const p = spec.porProduto[code] || {};
        const mod = modalidadeDo(blocos, code, p);
        // Serviço a serviço: o que foi vendido fixo sai com a sua modalidade e
        // uma prosa só; o que foi posto em comparação sai com as duas. Rotular
        // um serviço fixo de "Monitoria ou Monitoria + Atuação" prometeria uma
        // escolha que o documento não oferece ali.
        const compara = comparaProduto(spec, blocos, code);
        const modLabel = compara
            ? t.modalidadeOu(modalidadeNoIdioma(MODALIDADE_MONITORIA, idioma), modalidadeNoIdioma(MODALIDADE_AMBOS, idioma))
            : (mod ? modalidadeNoIdioma(mod, idioma) : t.semModalidade);
        // Comparando, a tabela de especificações sai na UNIÃO das duas
        // modalidades, com selo no que é exclusivo de uma — em vez de escolher
        // um dos dois conjuntos. É para isso que cada linha carrega `so`.
        const linhas = (compara ? linhasComparadas(b.especificacoes) : linhasDaModalidade(b.especificacoes, mod))
            .map((l) => ({ rotulo: l.rotulo, valor: valorLinha(l.valor, p, idioma), soEm: l.soEm || null }))
            .filter((l) => l.valor != null);
        const rows = linhas.map((l) => {
            const selo = l.soEm
                ? `<span class="somod">${esc(t.soEm(modalidadeNoIdioma(l.soEm, idioma)))}</span>`
                : '';
            return `<div class="spec"><span class="specl">${esc(l.rotulo)}</span><span class="specv">${rich(l.valor)}${selo}</span></div>`;
        }).join('');
        // A prosa é texto comercial com peso jurídico — a diferença entre as
        // modalidades não pode ficar subentendida. Comparando, saem as duas
        // versões, cada uma sob o nome da sua modalidade.
        const prosa = compara
            ? MODALIDADES_COMPARADAS.map((m) =>
                `<p class="prosa-p"><span class="prosa-mod">${esc(modalidadeNoIdioma(m, idioma))}</span>${rich(prosaDoBloco(blocos, code, m))}</p>`).join('')
            : `<p class="prosa-p">${rich(prosaDoBloco(blocos, code, mod))}</p>`;
        const h3 = solo ? '' :
            `<h3><span class="idx">3.${i + 1}</span> ${esc(b.titulo)} <span class="mode">${esc(modLabel)}</span></h3>`;
        return `<div class="bloco">${h3}
      ${prosa}
      <div class="card spectable">${rows}</div></div>`;
    }).join('');
    // Loop da Branddi SÓ na atuação — copy aprovada (modelo). Em monitoria a
    // Branddi não notifica nem remove, e não há loop aprovado pra essa
    // modalidade, então a faixa não sai (não inventar processo). Comparando, a
    // atuação está em oferta numa das opções, então o loop entra.
    const ribbon = (comparandoModalidades(spec, blocos, codes) || contratoTemAtuacao(spec.porProduto))
        ? `<div class="loop">${t.loop.map((s) => `<span class="loop-step">${esc(s)}</span>`).join('')}</div>`
        : '';
    return blocosHtml + ribbon;
}

/**
 * Escopo e níveis de serviço. NÃO repete o que 1 e 3 já disseram (marcas,
 * modalidade). Fica aqui o SLA (de cada produto + o do contrato, sem repetir
 * entregável), o idioma dos relatórios, o requisito e a observação do lead.
 */
function clausulaEscopo(ctx) {
    const { codes, spec, t, blocos, slaGeral, idioma } = ctx;
    const comparando = comparandoModalidades(spec, blocos, codes);
    const modoContrato = contratoTemAtuacao(spec.porProduto) ? MODALIDADE_AMBOS : MODALIDADE_MONITORIA;
    const vistos = new Set();
    // O SLA de um serviço comparado sai na união das duas modalidades, com selo
    // no que é exclusivo de uma; o de um serviço fixo sai só na modalidade dele.
    // Filtrar tudo por uma modalidade esconderia do cliente o que ele ganha ao
    // escolher a outra, que é a decisão que a proposta está pedindo — e não
    // filtrar nada prometeria, num serviço fixo, entrega que ele não tem.
    //
    // O SLA geral é do contrato: basta um serviço em comparação pra a atuação
    // estar em oferta, e aí ele também sai na união.
    const sla = [
        ...codes.flatMap((c) => (comparaProduto(spec, blocos, c)
            ? linhasComparadas(blocos[c].sla)
            : linhasDaModalidade(blocos[c].sla, modalidadeDo(blocos, c, spec.porProduto[c])))),
        ...(comparando ? linhasComparadas(slaGeral) : linhasDaModalidade(slaGeral, modoContrato)),
    ].filter((l) => (vistos.has(l.entregavel) ? false : vistos.add(l.entregavel)));

    const slaCard = `<div class="card slatable">
      <div class="sla sla-head"><span>${esc(t.thEntregavel)}</span><span>${esc(t.thPeriodicidade)}</span><span>${esc(t.thCanal)}</span></div>
      ${sla.map((l) => {
        const selo = l.soEm ? `<span class="somod">${esc(t.soEm(modalidadeNoIdioma(l.soEm, idioma)))}</span>` : '';
        return `<div class="sla"><span class="e">${esc(l.entregavel)}${selo}</span><span>${esc(l.periodicidade)}</span><span>${esc(l.canal)}</span></div>`;
    }).join('')}
    </div>`;

    // Requisito: nota legal (§) — pré-condição contratual.
    //
    // A regra era "todo produto MENOS BBP", e isso pegava o Brand Bidding
    // junto. Errado: registro no INPI NÃO é obrigatório pra BB — a Branddi tem
    // clientes de BB sem marca registrada (comercial, 27/08/2026). Exigir na
    // proposta criava uma pré-condição contratual que a operação não pratica.
    //
    // Agora a lista é POSITIVA: só quem realmente depende de marca registrada.
    // Dizer "quem não é BBP" escondia a regra atrás de uma negação, e foi por
    // isso que o BB entrou sem ninguém notar.
    const req = codes.some((c) => EXIGE_INPI.includes(c))
        ? `<div class="note"><span class="note-ic">§</span><p><strong>${esc(t.requisito)}.</strong> ${esc(t.requisitoValor)}</p></div>`
        : '';

    // Observação do lead — só se o closer escreveu. spec.obsProposta (fala do
    // cliente, texto puro), NÃO spec.observacoes (anotação interna do time).
    const obs = String(spec.obsProposta || '').trim()
        ? kvGrid([[t.obsProposta, esc(spec.obsProposta.trim())]])
        : '';
    // Idioma dos relatórios saiu do documento em 24/08/2026: o idioma escolhido
    // já é o do documento inteiro — repetir numa linha só somava ruído pro lead.
    return slaCard + req + obs;
}

function clausulaInvestimento(ctx) {
    const { codes, spec, soma, t, blocos, idioma } = ctx;
    const comparando = comparandoModalidades(spec, blocos, codes);

    // Tabela item a item (com escada de faixas quando houver). Cada produto sai
    // dentro de um .igroup: é o grupo que dá o respiro no fim do produto e anda
    // inteiro na quebra de página. Sem ele, a última faixa de um produto ficava
    // à mesma distância do produto seguinte que das próprias faixas dele — e
    // "Até 200 SKUs" parecia pertencer a Golpes Digitais.
    //
    // Comparando as modalidades, a mesma linha ganha DUAS colunas de valor em
    // vez de uma. É a forma mais compacta de mostrar as duas ofertas sem
    // duplicar a tabela inteira — e mantém item e escopo, idênticos nas duas,
    // escritos uma vez só.
    const itrow = (item, escopo, ...precos) => `<div class="itrow"><span class="i-item">${item}</span>
      <span class="i-esc">${escopo}</span>${precos.map((p) => `<span class="i-val">${brl(p)}</span>`).join('')}</div>`;

    const linhas = codes.map((c) => {
        const p = spec.porProduto[c] || {};
        // A unidade acompanha o número de CADA faixa: "Até 1 marketplace",
        // "Até 3 marketplaces".
        const escopoDe = (q) => {
            const u = unidadeDe(c, q, t);
            return `${esc(t.ate(q))}${u ? ' ' + esc(u) : ''}`;
        };
        const qtdTxt = Number(p.quantidade) > 0 ? escopoDe(p.quantidade) : '—';
        // Os canais saem UMA vez, sob o nome do produto — não na coluna de
        // escopo. Na escada eles se repetiriam a cada faixa; ao lado da
        // quantidade, viravam "Google, Bing · Até 3 palavras" numa célula só.
        // Antes de 27/08/2026 sumiam de todo produto com escada: o escopo
        // composto só era montado no ramo sem faixas.
        const canais = canaisTexto(p, idioma);
        // Serviço que NÃO está em comparação repete o valor nas duas colunas —
        // ele entra pelo mesmo preço qualquer que seja a escolha do cliente —, e
        // diz por quê: sem modalidade (BBP, onde quem atua é o cliente) ou fixo
        // numa delas. Duas colunas com o mesmo número e sem explicação parecem
        // erro de digitação, e é o serviço fixo que a comparação mais arrisca
        // deturpar: ele apareceria oferecendo uma escolha que não existe ali.
        const nota = !comparando || comparaProduto(spec, blocos, c) ? ''
            : (blocos[c].temModalidade
                ? t.soEm(modalidadeNoIdioma(modalidadeDo(blocos, c, p), idioma))
                : t.mesmoValorNasDuas);
        const item = `<strong>${esc(blocos[c].titulo)}</strong>${canais ? `<span class="i-canais">${esc(canais)}</span>` : ''}${nota ? `<span class="i-canais">${esc(nota)}</span>` : ''}`;

        // Cada faixa carrega os dois preços: a escada existe nas duas
        // modalidades, com valores próprios.
        const faixas = (p.faixas?.length ? [{ qtd: p.quantidade, preco: p.preco, precoMonitoria: p.precoMonitoria }, ...p.faixas] : [])
            .filter((f) => Number(f.qtd) > 0 && Number(f.preco) > 0)
            .sort((a, b) => a.qtd - b.qtd);
        const cmp = comparaProduto(spec, blocos, c);
        const valores = (linha) => !comparando
            ? [Number(linha?.preco) || 0]
            : MODALIDADES_COMPARADAS.map((m) => (cmp ? precoNaModalidade(linha, m) : (Number(linha?.preco) || 0)));
        // Escada sem nenhuma faixa válida cai na linha única, com o preço do
        // produto: pior que a escada faltar é o produto sumir calado da tabela.
        const linhasDoProduto = faixas.length
            ? faixas.map((f, i) => itrow(i === 0 ? item : '', escopoDe(f.qtd), ...valores(f))).join('')
            : itrow(item, qtdTxt, ...valores(p));
        return `<div class="igroup">${linhasDoProduto}</div>`;
    }).join('');

    const { opcoes } = ctx;
    const precoDe = (c) => Number(spec.porProduto?.[c]?.preco) || 0;

    // Quando mostrar os cards de comparação:
    //   • a proposta compara as duas modalidades, ou
    //   • o closer montou 2+ opções, ou
    //   • há UMA opção, ela é um pacote (2+ itens) e sai mais barata que a soma.
    // No 3º caso os avulsos não existem como opção salva — são sintetizados do
    // preço de cada produto, pra o lead ver "cada um custa tanto, e o pacote
    // compensa". É o formato lado a lado do modelo antigo (Golpes).
    const opt = opcoes[0];
    const pacoteUnicoComDesconto = opcoes.length === 1
        && (opt.produtos.length + opt.extras.length) > 1
        && opt.preco < opt.soma - 0.01;
    const mostrarCards = comparando || opcoes.length > 1 || pacoteUnicoComDesconto;

    let cartoes = [];
    if (comparando) {
        // Um card por modalidade, com o total do contrato em cada. Substitui os
        // cards de pacote de propósito: duas comparações no mesmo lugar (qual
        // modalidade × qual combo) pedem duas decisões de uma vez, e o
        // formulário já impede montar combo com a comparação ligada.
        //
        // Nenhum dos dois vem marcado como recomendado. A regra genérica desta
        // função marca o mais barato, o que aqui empurraria a oferta menor; e
        // marcar a completa faz a proposta escolher no lugar do cliente, que é
        // justamente o que a comparação existe pra devolver pra ele.
        //
        // Os cards são do CONTRATO mesmo quando só um serviço está em
        // comparação: é o total que o cliente paga em cada escolha, com os
        // serviços fixos somados igual dos dois lados. Um card por serviço
        // comparado obrigaria a somar de cabeça.
        cartoes = MODALIDADES_COMPARADAS.map((m) => {
            const preco = totalNaModalidade(spec, blocos, codes, m);
            return {
                produtos: codes, extras: [], preco, soma: preco,
                tag: t.opcoesModalidade, desc: '',
                rotulo: modalidadeNoIdioma(m, idioma),
                recomendado: false,
            };
        });
    } else if (opcoes.length > 1) {
        // A mais barata é a recomendada. Ordem decrescente pra ela ficar à direita.
        const minP = Math.min(...opcoes.map((o) => o.preco));
        cartoes = [...opcoes].sort((a, b) => b.preco - a.preco)
            .map((o) => ({ ...o, recomendado: o.preco === minP }));
    } else if (pacoteUnicoComDesconto) {
        // Um card por serviço (avulso, preço próprio) + o pacote à direita, marcado.
        const avulsos = opt.produtos.map((c) => ({
            produtos: [c], extras: [], preco: precoDe(c), soma: precoDe(c),
            rotulo: '', recomendado: false,
        }));
        cartoes = [...avulsos, { ...opt, recomendado: true }];
    }

    // Fecho da tabela: total só quando NÃO há cards — com cards, a comparação já
    // conta o preço fechado, e repetir na tabela duplica a mensagem.
    const fecho = mostrarCards ? ''
        : `<div class="itrow total"><span class="i-item">${esc(t.total)}</span><span></span><span class="i-val">${brl(opcoes.length === 1 ? opt.preco : soma)}</span></div>`;

    // Cabeçalho: comparando, as duas últimas colunas são as modalidades, em vez
    // do "Mensal" único.
    const cabecalhoValores = comparando
        ? MODALIDADES_COMPARADAS.map((m) => `<span class="i-val">${esc(modalidadeNoIdioma(m, idioma))}</span>`).join('')
        : `<span class="i-val">${esc(t.thMensal)}</span>`;
    const tabela = `<div class="card itable${comparando ? ' cmp' : ''}">
      <div class="itrow ihead"><span>${esc(t.thItem)}</span><span>${esc(t.thEscopo)}</span>${cabecalhoValores}</div>
      ${linhas}${fecho}</div>`;

    let bundleN = 0;
    // Quantos combos existem decide se eles precisam de número. Com um só,
    // "COMBO 1" só acrescenta ruído ao rótulo que a gente quer destacar.
    const totalBundles = cartoes.filter((o) => (o.produtos.length + o.extras.length) > 1).length;
    const cards = mostrarCards ? `<p class="minihead">${esc(comparando ? t.opcoesModalidade : t.opcoesPacote)}</p>
    <div class="pacotes">${cartoes.map((o) => {
        const rec = !!o.recomendado;
        const bundle = (o.produtos.length + o.extras.length) > 1;
        const partes = [...o.produtos.map((c) => blocos[c].titulo), ...o.extras];
        // Avulso leva o rótulo pequeno de sempre. O combo leva a palavra
        // GRANDE, porque é a opção que a proposta quer que o cliente escolha e
        // ela estava com o mesmo peso visual do avulso — "OPÇÃO 1 · PACOTE" em
        // 0.6rem, do lado de quatro cartões idênticos. Número só quando há mais
        // de um combo pra distinguir. `o.tag`/`o.desc` deixam o card de
        // modalidade dizer o que ele é sem passar por essa regra.
        const tag = o.tag || (bundle
            ? (totalBundles > 1 ? `${t.pacoteLabel} ${++bundleN}` : t.pacoteLabel)
            : t.avulso);
        const nome = o.rotulo || partes.join(' + ');
        const desc = o.desc !== undefined ? o.desc : (bundle ? (o.descricao || '') : t.avulsoDesc);
        const eco = o.soma > o.preco + 0.01 ? t.economiaDe(brl(o.soma - o.preco)) : '';
        return `<div class="pcard${rec ? ' rec' : ''}">
          <div class="pcard-top"><span class="ptag">${esc(tag)}</span>${rec ? `<span class="badge-rec">${esc(t.recomendado)}</span>` : ''}</div>
          <h4 class="pname">${esc(nome)}</h4>
          ${desc ? `<p class="pdesc">${esc(desc)}</p>` : ''}
          ${precoGrande(o.preco, t)}
          ${eco ? `<span class="badge-eco">● ${esc(eco)}</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="note"><span class="note-ic">i</span><p>${esc(comparando ? t.opcoesModalidadeNota : t.opcoesNota)}</p></div>` : '';

    // Setup e impostos, dois cards pequenos lado a lado.
    const extras = `<div class="grid2 gap">
      <div class="card feat"><span class="featl">${esc(t.setup)}</span><p>${rich(cond(ctx, 'setup', t.setupValor))}</p></div>
      <div class="card feat"><span class="featl">${esc(t.impostos)}</span><p>${rich(t.impostosValor)}</p></div></div>`;

    return tabela + cards + extras;
}

function clausulaCondicoes(ctx) {
    const { t, meta } = ctx;
    return kvGrid([
        [t.pagamento, cond(ctx, 'pagamento', t.pagamentoValor)],
        [t.vigencia, cond(ctx, 'vigencia', t.vigenciaValor)],
        [t.rescisao, cond(ctx, 'rescisao', t.rescisaoValor)],
        [t.implantacao, cond(ctx, 'implantacao', t.implantacaoValor)],
        [t.validadeProposta, t.validadeValor(meta.validadeDias, meta.validade), true],
    ]);
}

function clausulaAceite(ctx) {
    const { codes, meta, t, insumos } = ctx;
    // Mesma lista do requisito: pedir o comprovante de um registro que a
    // proposta não exige seria travar o aceite por um documento que o cliente
    // pode não ter.
    const insumoINPI = codes.some((c) => EXIGE_INPI.includes(c)) ? [t.insumoINPI] : [];
    const lista = [...codes.map((c) => insumos[c]).filter(Boolean), ...insumoINPI].join('; ');
    const etapas = [
        [t.etapaAceite, t.respContratante, t.prazoAte(meta.validade)],
        [t.etapaEnvio(lista), t.respContratante, 'D+0'],
        [t.etapaConfig, 'Branddi', t.prazoUteis],
        // Sem "D+7": nenhum modelo promete prazo pra primeira entrega, e prazo
        // em proposta vira cobrança contratual (revisão de 24/08/2026).
        [t.etapaPrimeira, 'Branddi', t.prazoAposInicio],
        [t.etapaReuniao, t.respAmbas, 'D+30'],
    ];
    return `<div class="timeline">${etapas.map(([etapa, resp, prazo]) =>
        `<div class="tl-item"><span class="tl-dot"></span>
      <div class="tl-body"><span class="tl-etapa">${esc(etapa)}</span><span class="tl-resp">${esc(resp)}</span></div>
      <span class="tl-prazo">${esc(prazo)}</span></div>`).join('')}</div>`;
}

/**
 * O aceite. Só aparece quando a proposta tem endereço (slug) — o preview do
 * formulário não deve oferecer aceite a ninguém. É declaração de intenção, não
 * assinatura qualificada; o texto diz isso.
 */
function blocoAceite(ctx, vencida) {
    const { t, idioma } = ctx;
    if (!ctx.slug) return '';
    if (ctx.aceite) {
        const locale = idioma === 'en' ? 'en-US' : (idioma === 'es' ? 'es-ES' : 'pt-BR');
        const q = new Date(ctx.aceite.quando).toLocaleString(locale, { timeZone: TZ, dateStyle: 'long', timeStyle: 'short' });
        return `<div class="note aceito"><span class="note-ic ok big">✓</span>
      <div><p class="note-h">${esc(t.aceiteAceitaTitulo)}</p>
      <p>${t.aceitaPor(esc(ctx.aceite.nome), esc(ctx.aceite.cargo || ''), esc(ctx.aceite.email), esc(q))}</p>
      <p class="fine">${esc(t.aceitaNota)}</p></div></div>`;
    }
    if (vencida || ctx.substituida) return '';
    // Sem formulário de aceite online (Nome/E-mail/Cargo/botão): o fluxo é baixar
    // o PDF e o aceite acontecer por fora. Fica só a mensagem do que o aceite
    // significa. O estado "já aceita" (acima) segue valendo caso o aceite seja
    // registrado por outro caminho.
    return `<section id="aceite">
    <div class="note acao"><span class="note-ic big">✓</span>
      <div><p class="note-h">${esc(t.aceiteTitulo)}</p><p>${esc(t.aceiteProsa)}</p></div></div></section>`;
}

// ─── Documento ──────────────────────────────────────────────────────

const CLAUSULAS = [
    clausulaIdentificacao, clausulaObjetivo, clausulaAbordagem, clausulaInvestimento,
    clausulaEscopo, clausulaCondicoes, clausulaAceite,
];

/**
 * @param {{deal:{id:number,organizacao:string,contato?:string}, spec:object,
 *   emitidaEm?:Date, slug?:string, aceite?:object, substituida?:object}} args
 * @returns {string} HTML completo
 */
export function renderProposta({ deal, spec, emitidaEm = new Date(), slug = null, aceite = null, substituida = null }) {
    const codes = produtosOrdenados(spec);
    if (!codes.length) throw new Error('spec sem produtos — nada a renderizar');
    if (!deal?.organizacao) throw new Error('sem organização — o nome vai no corpo da proposta');

    const idioma = spec.idioma || 'pt';
    if (!IDIOMAS_COM_BLOCOS.includes(idioma)) {
        throw new Error(`ainda não existe modelo em ${IDIOMA_LABEL[idioma] || idioma} — a proposta só sai nos idiomas com catálogo escrito`);
    }
    const { blocos, slaGeral, insumos, textos: t } = catalogoDoIdioma(idioma);

    const validadeDias = validadeEmDias(spec);
    const validade = new Date(emitidaEm.getTime() + validadeDias * 86400000);
    // Com a comparação ligada, a soma e o total são os da Monitoria — a
    // modalidade mais barata. Tudo que exibe UM número (identificação, aceite)
    // passa a mostrar o piso, e não o teto: quem lê decide qual quer.
    const comparaModalidades = comparandoModalidades(spec, blocos, codes);
    const soma = comparaModalidades
        ? totalNaModalidade(spec, blocos, codes, MODALIDADE_MONITORIA)
        : codes.reduce((acc, c) => acc + (Number(spec.porProduto[c]?.preco) || 0), 0);
    // Nomes dos produtos do catálogo que NÃO estão nesta proposta — pra a trava
    // de pacote tirar qualquer resquício deles (produto, frente ou rótulo).
    const nomesForaDoDeal = Object.keys(blocos).filter((c) => !codes.includes(c)).map((c) => blocos[c].titulo.toLowerCase());
    const opcoes = opcoesDePacote(spec, codes, nomesForaDoDeal);
    const total = comparaModalidades ? soma : (opcoes.length ? opcoes[0].preco : soma);
    // Sem número de proposta: saiu em 27/08/2026, a pedido da Jessica. Era o id
    // do card do Pipedrive com um prefixo — número interno nosso, que não diz
    // nada pro cliente e ainda expõe quantos negócios a base tem.
    const meta = {
        emissao: dataNoIdioma(emitidaEm, idioma),
        validade: dataNoIdioma(validade, idioma),
        validadeDias,
    };
    const ctx = { deal, spec, codes, meta, soma, total, opcoes, slug, aceite, substituida, idioma, t, blocos, slaGeral, insumos };

    const vencida = Date.now() > validade.getTime() + 86400000;

    const aviso = substituida
        ? `<div class="aviso substituida"><b>${esc(t.substituidaTitulo)}</b> ${esc(t.substituidaTexto(substituida.revisao))}
           <a href="/p/${esc(substituida.slug)}">${esc(t.substituidaLink)}</a>.</div>`
        : vencida
            ? `<div class="aviso vencida"><b>${esc(t.vencidaTitulo(meta.validade))}</b> ${esc(t.vencidaTexto)}</div>`
            : '';

    // Subtítulo da seção. A Abordagem (índice 2), quando há um só produto, traz
    // o produto e a modalidade no próprio subtítulo — "3.1 — Brand Bidding ·
    // Monitoria + Atuação", como no modelo — em vez do subtítulo genérico.
    const subDaClausula = (i) => {
        if (i === 2 && codes.length === 1) {
            const c = codes[0];
            const mod = modalidadeDo(blocos, c, spec.porProduto[c]);
            const rot = comparaProduto(spec, blocos, c)
                ? t.modalidadeOu(modalidadeNoIdioma(MODALIDADE_MONITORIA, idioma), modalidadeNoIdioma(MODALIDADE_AMBOS, idioma))
                : (mod ? modalidadeNoIdioma(mod, idioma) : t.semModalidade);
            return `3.1 — ${blocos[c].titulo} · ${rot}`;
        }
        return t.clausulasSub?.[i];
    };
    const corpo = CLAUSULAS.map((fn, i) =>
        `<section class="clausula">${sechead(i + 1, t.clausulas[i], subDaClausula(i))}${fn(ctx)}</section>`).join('\n');

    // Capa: título hero em duas linhas — serviços + conector, e a marca do
    // cliente em destaque (gradiente) na segunda.
    // Com um produto, o nome dele É o título. Com mais de um, somar os nomes
    // produzia quatro linhas de hero ("Brand Bidding + Buy Box Protection +
    // Golpes Digitais + Violação de Propriedade Intelectual para Fitoway") —
    // longo demais pra capa e sem nenhuma força. Os nomes não somem: descem
    // pra linha de serviços, logo abaixo, e seguem na cláusula 1.
    const combo = codes.length > 1;
    const heroL1 = combo
        ? `${t.heroCombo(codes.length)} ${t.heroConector}`
        : `${blocos[codes[0]].titulo} ${t.heroConector}`;
    const heroServicos = combo ? codes.map((c) => blocos[c].titulo).join(' · ') : '';
    // Subtítulo (hero): a chamada aprovada do produto principal quando existe (só
    // Brand Bidding hoje) ou, senão, o OBJETIVO já definido do produto — que é o
    // problema que ele resolve. Conteúdo definido do catálogo, não inventado, e
    // toda capa passa a ter a linha. O objetivo é fragmento em minúscula; como
    // hero, ganha a primeira letra maiúscula.
    const obj = blocos[codes[0]].objetivo;
    const chamada = t.chamada?.[codes[0]] || (obj.charAt(0).toUpperCase() + obj.slice(1));
    const titulo = `${codes.map((c) => blocos[c].titulo).join(' · ')} — ${deal.organizacao}`;

    // Sem o valor mensal: saiu da capa em 25/08/2026, a pedido da Jessica. O
    // preço abrindo o documento, antes de o lead ler o que está sendo entregue,
    // puxa a conversa pro número. Ele continua na Identificação (cláusula 1) e
    // na de Investimento, que é onde tem contexto pra sustentá-lo.
    const strip = [
        [t.emissao, meta.emissao], [t.validadeCurta, meta.validade],
        [t.regime, REGIME_CURTO[idioma] || REGIME_CURTO.pt],
    ].map(([l, v, cyan]) => `<div class="scell"><span class="scl">${esc(l)}</span><span class="scv${cyan ? ' cyan' : ''}">${esc(v)}</span></div>`).join('');

    const cta = `<section class="cta">
    <h2 class="cta-h">${esc(t.rodape)}.</h2>
    <p class="cta-sub">${esc(t.tagline)} · ${esc(t.site)}</p></section>`;

    const acoes = `<div class="acoes">
  ${slug
    ? `<a class="botao" href="/pdf/${esc(slug)}" target="_blank" rel="noopener">${esc(t.baixarPdf)}</a><span>${esc(t.baixarPdfDica)}</span>`
    : `<button type="button" onclick="window.print()">${esc(t.baixarPdf)}</button><span>${esc(t.baixarPdfDica)}</span>`}
</div>`;

    return `<!doctype html><html lang="${esc(idioma)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(deal.organizacao)} — Branddi</title>
<!-- Proposta com preco de cliente. Link privado por ser imprevisivel; noindex
     fecha o caminho de virar resultado de busca se for colado em lugar publico.
     Comentarios sem acento de proposito: eles vao pro "ver codigo-fonte" do
     cliente, inclusive numa proposta em ingles, e o teste barra portugues la. -->
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<!-- Inter (corpo/titulo) + JetBrains Mono (numeros, refs, selos): as fontes do
     Branddi Design System. preconnect + display=swap pra a pagina nao ficar em
     branco esperando a fonte, e stack de reserva pro caso de a rede do cliente
     bloquear o Google Fonts. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>${cssLimpo()}</style></head><body>
${acoes}
<main class="doc">
<section class="cover">
  <div class="cover-top">
    <div class="cover-logo">${logo(30)}</div>
  </div>
  <div class="watermark">${marca(560)}</div>
  <div class="cover-mid">
    <span class="eyebrow">${esc(t.capaEyebrow || t.kicker)}</span>
    <h1 class="hero"><span class="l1">${esc(heroL1)}</span><br><span class="grad">${esc(deal.organizacao)}</span></h1>
    ${chamada ? `<p class="herosub">${esc(chamada)}</p>` : ''}
    ${heroServicos ? `<p class="heroserv">${esc(heroServicos)}</p>` : ''}
    <div class="strip">${strip}</div>
  </div>
  <div class="cover-foot">
    <div>${esc(t.contratadaValor)}<br><span class="cf-dim">${esc(deal.organizacao)}</span></div>
    <div class="cf-right"><b>${esc(t.tagline)}</b><br><span class="cf-dim">${esc(t.rodapeValida)} ${esc(meta.validade)}</span></div>
  </div>
</section>
${aviso}
<div class="pad">
${corpo}
${blocoAceite(ctx, vencida)}
${cta}
</div>
</main>
<footer class="pagefoot" aria-hidden="true">
  <span class="pf-logo">${logo(16)}</span>
  <span class="pf-ref">${esc(t.rodapeValida)} ${esc(meta.validade)}</span>
</footer>
</body></html>`;
}

const CSS = `
/* ── Tokens da marca (Branddi Design System / tokens.css) ────────────
   Dark mode é o default: o brand vive no escuro. Petrol #002B36 de fundo com
   gradiente radial, acento cyan #0ACFDE, Inter + JetBrains Mono. */
:root{
--navy:#002B36;--teal:#004C54;--card:#003847;--cyan:#0ACFDE;--turq:#299FB1;
--text:#FFFFFF;--muted:#94A3B8;--success:#22C55E;--alert:#F87171;
--line:rgba(255,255,255,.10);--line-2:rgba(255,255,255,.06);
--card-bg:rgba(0,56,71,.60);--field:rgba(0,32,42,.6);
--logo-fill:#FFFFFF;--logo-accent:#0ACFDE;--logo-counter:#002B36;
--radius:.75rem;--radius-sm:.5rem;--radius-pill:9999px;
--shadow-card:0 8px 32px 0 rgba(10,207,222,.10);
--glow:0 0 0 1px rgba(10,207,222,.45),0 12px 40px -12px rgba(10,207,222,.35);
--display:"Inter","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
--sans:"Inter","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,monospace;
--measure:70ch}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--navy);color:var(--text);font:15px/1.6 var(--sans);font-weight:400;
-webkit-font-smoothing:antialiased;
background-image:radial-gradient(circle at 50% 0%,#004C54 0%,#002B36 60%);background-attachment:fixed}
h1,h2,h3,h4{font-family:var(--display);margin:0;letter-spacing:-.02em;line-height:1.15}
p{margin:0}
strong{font-weight:700;color:var(--text)}

.doc{max-width:52rem;margin:0 auto}

/* ── Barra de ações (só tela) ───────────────────────────────────────── */
.acoes{max-width:52rem;margin:0 auto;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;
padding:.9rem clamp(1rem,4vw,2.4rem);font-size:.78rem;color:var(--muted)}
.acoes button,.acoes .botao{font:600 .82rem var(--sans);background:var(--cyan);color:var(--navy);border:0;
border-radius:var(--radius-pill);padding:.5rem 1.2rem;cursor:pointer;text-decoration:none;display:inline-block}
.acoes button:hover,.acoes .botao:hover{background:var(--turq)}
.acoes button:focus-visible,.acoes .botao:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}

/* ── Aviso (substituída / vencida) ──────────────────────────────────── */
.aviso{margin:0 clamp(1rem,4vw,2.4rem) 1rem;padding:.8rem 1rem;border-radius:var(--radius);font-size:.85rem;
background:rgba(255,59,48,.10);border:1px solid rgba(255,59,48,.28);color:#FFD7D3}
.aviso b{color:#fff}
.aviso a{color:var(--cyan);font-weight:600}

/* ── Capa ───────────────────────────────────────────────────────────── */
/* Fundo próprio e opaco + z-index: na impressão a capa cobre o rodapé fixo, que
   por isso não aparece sobre a primeira folha (a capa tem o rodapé dela). */
.cover{position:relative;z-index:2;overflow:hidden;min-height:100vh;display:flex;flex-direction:column;
padding:clamp(1.6rem,5vw,3rem);background:radial-gradient(circle at 50% 0%,#004C54 0%,#002B36 60%)}
.watermark{position:absolute;right:-6%;top:44%;transform:translateY(-50%);z-index:-1;
opacity:.5;filter:blur(.3px);pointer-events:none;
--logo-fill:#0A3A47;--logo-accent:#0C4657;--logo-counter:#002B36}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}
.cover-mid{margin-top:auto;padding-top:3rem}
.eyebrow{display:inline-block;font-family:var(--mono);font-size:.66rem;font-weight:600;letter-spacing:.14em;
text-transform:uppercase;color:var(--cyan);border:1px solid rgba(10,207,222,.35);
background:rgba(10,207,222,.08);border-radius:var(--radius-pill);padding:.4rem .9rem}
/* Gradiente aplicado ao H1 inteiro (branco→cyan→turquesa) e clipado ao texto —
   no bloco o Skia clipa aos glifos sem pintar a caixa (o artefato aparecia com
   o clip num <span> inline). A linha 1 é forçada em branco sólido; só o nome do
   cliente (linha 2) mostra o gradiente, como no modelo. */
.hero{font-size:clamp(2rem,5.6vw,3.35rem);font-weight:800;line-height:1.06;letter-spacing:-.03em;
margin:1.1rem 0 0;max-width:20ch;text-wrap:balance;
background:linear-gradient(90deg,#EAFEFF 0%,#0ACFDE 52%,#299FB1 100%);
-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.hero .l1{-webkit-text-fill-color:var(--text);color:var(--text)}
.herosub{margin:1.1rem 0 0;max-width:46ch;font-size:1.05rem;line-height:1.55;color:#CBD5E1;font-weight:300}
.herosub strong{color:var(--text);font-weight:600}
.heroserv{margin:.85rem 0 0;font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--cyan);opacity:.85;max-width:34rem;line-height:1.7}
.strip{margin-top:2rem;display:grid;grid-template-columns:repeat(3,1fr);gap:0;max-width:32rem;
background:var(--card-bg);border:1px solid var(--line);border-radius:var(--radius);
-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);overflow:hidden}
.scell{padding:.9rem 1rem;border-right:1px solid var(--line)}
.scell:last-child{border-right:0}
.scl{display:block;font-family:var(--mono);font-size:.56rem;letter-spacing:.12em;text-transform:uppercase;
color:var(--muted)}
.scv{display:block;margin-top:.35rem;font-family:var(--mono);font-size:.92rem;color:var(--text);font-weight:500}
.scv.cyan{color:var(--cyan)}
.cover-foot{margin-top:auto;padding-top:2.2rem;display:flex;justify-content:space-between;gap:1rem;
flex-wrap:wrap;border-top:1px solid var(--line);font-size:.82rem}
.cover-foot b{color:var(--text)}
.cover-foot .cf-right{text-align:right;font-family:var(--mono);font-size:.72rem;letter-spacing:.03em}
.cf-dim{color:var(--muted)}

/* ── Corpo ──────────────────────────────────────────────────────────── */
.pad{padding:clamp(1.6rem,4.5vw,3rem) clamp(1rem,4vw,2.4rem) 2rem;display:flex;flex-direction:column;gap:2.4rem}
.clausula{display:flex;flex-direction:column;gap:1rem}

/* Cabeçalho de cláusula: badge + título + subtítulo */
.sechead{display:flex;gap:.9rem;align-items:center}
.secnum{flex:none;width:2.2rem;height:2.2rem;display:grid;place-items:center;border-radius:var(--radius-sm);
border:1px solid rgba(10,207,222,.45);background:rgba(10,207,222,.08);color:var(--cyan);
font-family:var(--mono);font-weight:700;font-size:.95rem}
.secttl h2{font-size:1.4rem;font-weight:800;color:var(--text)}
.secsub{font-size:.82rem;color:var(--muted);margin-top:.1rem}

/* ── Glass card base ────────────────────────────────────────────────── */
.card{background:var(--card-bg);border:1px solid var(--line);border-radius:var(--radius);
-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:var(--shadow-card)}

/* Grade rótulo/valor (Identificação, Condições) */
.grid2{display:grid;grid-template-columns:1fr 1fr}
.grid2.gap{background:none;border:0;box-shadow:none;gap:1rem;-webkit-backdrop-filter:none;backdrop-filter:none}
.kv{padding:.95rem 1.15rem;border-bottom:1px solid var(--line-2);border-right:1px solid var(--line-2)}
.grid2 .kv:nth-child(2n){border-right:0}
.grid2 .kv:nth-last-child(-n+1){border-bottom:0}
/* Última linha ímpar: ocupa a largura toda em vez de deixar meia grade vazia. */
.grid2 .kv.larga{grid-column:1/-1;border-right:0}
.kvl{display:block;font-family:var(--mono);font-size:.6rem;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
.kvv{display:block;margin-top:.35rem;font-size:.95rem;color:var(--text);line-height:1.4}
.kvv.cyan{color:var(--cyan);font-weight:500}

/* Prosa em card (Objetivo) */
.prosa{padding:1.3rem 1.4rem;display:flex;flex-direction:column;gap:.7rem}
.prosa p,.prosa-p{font-size:.95rem;line-height:1.6;color:#D7E0E6;max-width:var(--measure)}
.prosa ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.35rem}
.prosa li{font-size:.95rem;color:#D7E0E6}
.prosa li::marker{color:var(--cyan)}
.prosa-p{margin:0}

/* Nota / callout */
.note{display:flex;gap:.85rem;align-items:flex-start;background:rgba(10,207,222,.05);
border:1px solid rgba(10,207,222,.20);border-radius:var(--radius);padding:1rem 1.15rem}
.note p{font-size:.86rem;line-height:1.55;color:#C6D2DA;max-width:var(--measure)}
.note-ic{flex:none;width:1.5rem;height:1.5rem;display:grid;place-items:center;border-radius:var(--radius-sm);
background:rgba(10,207,222,.12);color:var(--cyan);font-family:var(--mono);font-weight:700;font-size:.8rem;font-style:normal}
.note-ic.ok{background:rgba(34,197,94,.14);color:var(--success)}
/* Ícone grande e preenchido do painel de aceite, como no modelo. */
.note-ic.big{width:2.1rem;height:2.1rem;font-size:1.05rem;border-radius:.6rem;background:var(--cyan);color:var(--navy)}
.note-ic.ok.big{background:var(--success);color:var(--navy)}
.note.acao{border-color:rgba(10,207,222,.28);align-items:center}
.note.aceito{border-color:rgba(34,197,94,.30);background:rgba(34,197,94,.06);align-items:center}
.note-h{font-family:var(--display);font-weight:700;color:var(--text);font-size:.98rem;margin-bottom:.15rem}
.note .fine{color:var(--muted);font-size:.8rem;margin-top:.25rem}

/* Tabela de especificações (Abordagem) */
.bloco{display:flex;flex-direction:column;gap:.8rem}
.bloco h3{font-size:1rem;font-weight:700;color:var(--text);display:flex;gap:.55rem;align-items:baseline;flex-wrap:wrap}
.bloco h3 .idx{font-family:var(--mono);color:var(--muted);font-size:.8rem;font-weight:600}
.mode{font-family:var(--mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--cyan);
border:1px solid rgba(10,207,222,.4);border-radius:var(--radius-pill);padding:.15rem .55rem;font-weight:700}
.spectable{padding:.3rem 0}
.spec{display:grid;grid-template-columns:11rem 1fr;gap:1rem;padding:.75rem 1.15rem;border-bottom:1px solid var(--line-2)}
.spectable .spec:last-child{border-bottom:0}
.specl{font-family:var(--mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding-top:.1rem}
.specv{font-size:.88rem;line-height:1.5;color:#D7E0E6}

/* Loop da Branddi */
.loop{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.2rem}
.loop-step{font-family:var(--mono);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
color:var(--cyan);border:1px solid rgba(10,207,222,.35);border-radius:var(--radius-pill);padding:.4rem .85rem;
display:inline-flex;align-items:center;gap:.4rem}
.loop-step::before{content:"";width:.4rem;height:.4rem;border-radius:50%;background:var(--cyan)}

/* Tabela SLA */
.slatable{padding:.3rem 0}
.sla{display:grid;grid-template-columns:2fr 1fr 1fr;gap:1rem;padding:.7rem 1.15rem;border-bottom:1px solid var(--line-2);font-size:.86rem;color:#D7E0E6}
.slatable .sla:last-child{border-bottom:0}
.sla-head span{font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.sla .e{color:var(--text);font-weight:500}

/* Tabela de investimento */
.itable{padding:.3rem 0}
.itrow{display:grid;grid-template-columns:1fr 1.4fr auto;gap:1rem;padding:.72rem 1.15rem;
border-bottom:1px solid var(--line-2);align-items:baseline;font-size:.88rem;color:#D7E0E6}
.itable .itrow:last-child{border-bottom:0}
.ihead span{font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.i-val{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text);font-weight:500}
.itrow.sub{color:var(--muted)}
.itow.sub .i-val,.itrow.sub .i-val{color:var(--muted);font-weight:400}
.itrow.total{border-top:1px solid rgba(10,207,222,.4);background:rgba(10,207,222,.05)}
.itrow.total .i-item{font-weight:700;color:var(--text)}
.itrow.total .i-val{color:var(--cyan);font-weight:700;font-size:1rem}
.i-esc{color:var(--muted)}
/* Um .igroup por produto. Dentro do grupo NÃO há linha e as faixas andam
   juntas; a única divisa do corpo da tabela é a de produto, com respiro dos
   dois lados. Com traço entre as faixas, a divisa de produto tinha o mesmo peso
   da divisa de faixa e a tabela lia como uma lista chapada de doze preços. O
   último grupo não leva linha: ou fecha a tabela, ou já vem a do total. */
.igroup{padding-bottom:.62rem;border-bottom:1px solid var(--line-2)}
.itable .igroup:last-of-type{border-bottom:0}
.igroup .itrow{border-bottom:0}
.igroup .itrow+.itrow{padding-top:.12rem}
/* Os canais monitorados, sob o nome do produto e uma vez só. */
.i-canais{display:block;margin-top:.28rem;font-size:.76rem;line-height:1.45;color:var(--muted);font-weight:400}
/* Comparando as duas modalidades a tabela tem quatro colunas: item, escopo e
   um valor por modalidade. O escopo encolhe (1.4fr -> 1fr) porque é a coluna
   com folga; espremer o nome do produto quebraria "Brand Bidding" em duas
   linhas em toda linha da escada. A coluna da direita — Monitoria + Atuação,
   a recomendada — fica com o peso do texto normal; a da Monitoria, apagada,
   pra a hierarquia da tabela bater com a do card marcado. */
.itable.cmp .itrow{grid-template-columns:1fr 1fr auto auto;gap:.9rem}
/* A primeira das DUAS colunas de valor — nth-of-type conta entre os spans
   irmãos, e antes delas vêm item e escopo; contar de trás é o que isola a
   coluna da Monitoria em toda linha, cabeçalho incluído. */
.itable.cmp .i-val:nth-last-of-type(2){color:var(--muted);font-weight:400}
.itable.cmp .i-val{min-width:5.4rem}
/* Selo de linha que só existe numa das modalidades — no quadro de
   especificações e no SLA, onde as duas listas viram uma união. */
.somod{display:inline-block;margin-left:.5rem;padding:.05rem .4rem;border-radius:3px;
background:rgba(10,207,222,.1);border:1px solid rgba(10,207,222,.28);
font-family:var(--mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;
color:var(--cyan);white-space:nowrap;vertical-align:.08em}
/* Rótulo da modalidade à frente do parágrafo, quando a abordagem sai nas duas.
   Fica na mesma linha do texto de propósito: são dois parágrafos curtos e um
   subtítulo em bloco pra cada faria a cláusula parecer ter duas seções. */
.prosa-mod{display:inline-block;margin-right:.45rem;font-family:var(--mono);font-size:.68rem;
letter-spacing:.06em;text-transform:uppercase;color:var(--cyan);font-weight:600}
.prosa-p+.prosa-p{margin-top:.55rem}

/* Cards de pacote */
/* O título da seção é a palavra que anuncia a opção recomendada — vinha em
   0.62rem, mono, corpo de rodapé. Vai no corpo dos títulos de cláusula, com
   entrelinha pra respirar do bloco de cima. */
.minihead{font-size:1.75rem;letter-spacing:.02em;color:var(--cyan);
font-weight:800;margin:1.4rem 0 .6rem}
.pacotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
/* container-type: o preço grande se dimensiona pela largura DESTE card (cqi),
   não pela raiz — é o que impede o número de furar a borda quando entram 3 ou
   4 opções e cada card fica estreito. */
.pcard{background:var(--card-bg);border:1px solid var(--line);border-radius:var(--radius);padding:1.3rem 1.3rem 1.4rem;
display:flex;flex-direction:column;gap:.55rem;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);
container-type:inline-size}
.pcard.rec{border-color:rgba(10,207,222,.55)}
.pcard-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap}
.ptag{font-family:var(--mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700}
.pcard.rec .ptag{color:var(--cyan)}
/* O rótulo do combo é a única coisa da seção que precisa ser vista de longe:
   é a opção que a proposta recomenda, no meio de cartões avulsos iguais. */
.badge-rec{font-family:var(--mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
color:var(--success);border:1px solid rgba(34,197,94,.4);border-radius:var(--radius-pill);padding:.2rem .6rem}
.pname{font-size:1.15rem;font-weight:700;color:var(--text);letter-spacing:-.01em}
.pdesc{font-size:.82rem;line-height:1.5;color:var(--muted)}
/* O tamanho vive AQUI (não no .pv) e as partes seguem em em, pra centavos e
   "/mês" encolherem junto e a proporção do modelo se manter em qualquer
   largura. 13.5cqi ≈ o maior corpo em que "R$ 145.900/mês" (o pior caso: seis
   dígitos) ainda cabe num card de 3 colunas; o clamp segura o teto (2.05rem do
   modelo) quando há uma ou duas opções. Aferido por scripts/testa-layout.js. */
.preco{display:block;margin-top:.35rem;font-family:var(--mono);color:var(--cyan);white-space:nowrap;
font-size:clamp(1.05rem,13.5cqi,2.05rem)}
.preco .pv{font-size:1em;font-weight:700;letter-spacing:-.02em}
.preco .pc{font-size:.49em;font-weight:500}
.preco .pm{font-size:.41em;color:var(--muted);margin-left:.4em;font-weight:400}
.badge-eco{align-self:flex-start;font-family:var(--mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;
font-weight:700;color:var(--success);border:1px solid rgba(34,197,94,.4);background:rgba(34,197,94,.08);
border-radius:var(--radius-pill);padding:.28rem .7rem;margin-top:.15rem}

/* Cards pequenos (setup, impostos) */
.feat{padding:1.05rem 1.2rem}
.featl{display:block;font-family:var(--mono);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--cyan);font-weight:700}
.feat p{margin-top:.4rem;font-size:.9rem;color:#D7E0E6;line-height:1.5}

/* Timeline (Aceite) */
.timeline{display:flex;flex-direction:column}
.tl-item{display:grid;grid-template-columns:auto 1fr auto;gap:.9rem;padding:.5rem 0 .95rem;position:relative}
.tl-item:not(:last-child)::before{content:"";position:absolute;left:.44rem;top:1.05rem;bottom:-.1rem;width:1.5px;background:rgba(10,207,222,.4)}
.tl-dot{width:.95rem;height:.95rem;border-radius:50%;border:2px solid var(--cyan);background:var(--navy);margin-top:.15rem;z-index:1}
.tl-body{display:flex;flex-direction:column;gap:.15rem}
.tl-etapa{font-size:.95rem;font-weight:600;color:var(--text)}
.tl-resp{font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.tl-prazo{font-family:var(--mono);font-size:.8rem;color:var(--cyan);white-space:nowrap;text-align:right;padding-left:.75rem}

/* Painel de aceite (só a mensagem — o formulário online foi removido) */
#aceite{display:flex;flex-direction:column;gap:1rem}

/* Chamada de fechamento */
.cta{text-align:center;padding:1rem 0 .6rem;display:flex;flex-direction:column;gap:.5rem;align-items:center}
/* Cyan sólido: no CTA (h2 centralizado, texto direto) o clip-to-text volta a
   pintar a caixa no Skia; o hero escapa por ter a estrutura com <span>. Sólido
   fica limpo e pertíssimo do gradiente do modelo. Compacto (2 linhas) pra o fecho
   caber junto do aceite, sem sobrar folha. */
.cta-h{font-size:clamp(1.2rem,3.2vw,1.6rem);font-weight:800;line-height:1.2;max-width:34ch;color:var(--cyan)}
.cta-sub{font-family:var(--mono);font-size:.78rem;letter-spacing:.08em;color:var(--muted)}

/* Rodapé de página. Na tela sai uma vez, no fim; na impressão vira fixo e o
   Chrome o repete no pé de cada folha (ver bloco @media print). */
.pagefoot{max-width:52rem;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:1rem;
padding:1rem clamp(1rem,4vw,2.4rem) 2rem;border-top:1px solid var(--line)}
.pf-logo{opacity:.85;display:flex}
.pf-ref{font-family:var(--mono);font-size:.62rem;letter-spacing:.05em;color:var(--muted)}

/* ── Impressão / PDF ────────────────────────────────────────────────── */
@media print{
/* Margem da folha ZERO. Com QUALQUER margem, o Chrome deixa a faixa da margem
   BRANCA no PDF (o fundo não pinta a margem — nem via html/body — e elemento
   fixo é recortado na área de conteúdo, não alcança a margem). Sem margem, o
   fundo preenche a folha inteira de petrol: full-bleed, como o modelo. Todo o
   respiro é por dentro (coluna central + padding). */
@page{size:A4;margin:0}
html,body{background:var(--navy)}
body{font-size:10.5pt;background-image:radial-gradient(circle at 50% 0%,#004C54 0%,#002B36 60%);background-attachment:fixed}
/* O gradiente e as cores de fundo são identidade — saem no papel. */
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{max-width:none}
/* Interface não vai pro papel. */
.acoes{display:none}
/* A capa ocupa a folha inteira (full-bleed), com o conteúdo contido pelo padding. */
.cover{min-height:auto;height:297mm;break-after:page;padding:24mm 21mm}
.watermark{opacity:.5}
/* Coluna central de ~168mm numa A4 de 210mm => ~21mm de margem de cada lado,
   contido e central como o modelo. O padding vertical dá o respiro de topo/base. */
/* A faixa que o rodapé fixo ocupa no pé de CADA folha. Ele é position:fixed:
   o Chrome o repete em toda página, mas ele não ocupa espaço no fluxo — sem
   esta reserva o conteúdo corre por baixo dele. Era o print de 28/08, com dois
   itens da linha do tempo saindo por trás do logo. Não dá pra resolver com
   margem de @page: com qualquer margem o Chrome deixa a faixa na cor do
   navegador e o full-bleed petrol se perde (ver @page acima).

   Mora no .pad, e não na cláusula: com box-decoration-break:clone o padding se
   repete no fim de cada FRAGMENTO, e o .pad fragmenta uma vez por folha — uma
   reserva por página. Na cláusula ela se repetiria por cláusula, abrindo um
   buraco no meio da folha a cada troca de seção.

   O valor é a altura medida do rodapé (14,2mm em 28/08) mais folga. Quem mexer
   no rodapé mexe aqui junto: a bateria de layout compara os dois e reprova se
   a reserva ficar menor que ele. */
:root{--reserva-rodape:16mm}
.pad{max-width:168mm;margin:0 auto;padding:0 0 var(--reserva-rodape);gap:0;
-webkit-box-decoration-break:clone;box-decoration-break:clone}
/* Fragmentação confiável só existe em fluxo de BLOCO: dentro de flex o Chrome
   corta card no meio da linha mesmo com break-inside:avoid (era o "vazando em
   cima" — tabela fatiada, resto colado no topo da folha seguinte). No papel,
   os contêineres viram bloco e o gap vira margem entre irmãos. */
.pad,.clausula,.bloco,.timeline,#aceite{display:block}
.clausula>*+*,#aceite>*+*{margin-top:1rem}
.bloco>*+*{margin-top:.8rem}
/* Respiro de topo em CADA folha: o padding da cláusula, que o clone repete no
   começo de cada fragmento (Chromium 130+; aqui roda 149). Sem isso, cláusula
   maior que a folha continuava a 0mm da borda física. */
.clausula{break-inside:auto;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:6.5mm 0}
.sechead,h2,h3,h4{break-after:avoid}
/* "Opções de combo" é <p>, não heading — ficava de fora da regra acima e
   sobrava sozinha no pé da folha, com os cartões na seguinte. Como .pacotes é
   break-inside:avoid, o grid inteiro pula junto e a legenda ficava apontando
   pra um vazio. */
.minihead{break-after:avoid}
/* O bloco de produto (título + prosa + tabela) anda inteiro: título numa folha
   e tabela na outra era o outro sintoma do print de 24/08. */
/* .grid2 cobre o par setup/impostos, que não tem classe card e estava sendo
   fatiado por cima do rodapé fixo (print de 24/08). */
.bloco,.card,.note,.pcard,.pacotes,.grid2,.tl-item,.loop,.igroup{break-inside:avoid}
p,li{orphans:3;widows:3}
/* O fecho (CTA) fica junto do aceite — nunca sozinho numa folha. break-before
   avoid + o aceite pede pra não quebrar depois dele. Compacto pra caber. */
.note.acao,.note.aceito{break-after:avoid}
.cta{break-before:avoid;padding:4mm 0 8mm}
/* Rodapé fixo, repetido pelo Chrome no pé de cada folha; alinhado à coluna, com
   fundo petrol pra mascarar conteúdo próximo; z-index baixo pra a capa (fundo
   próprio) cobri-lo na 1a folha. */
.pagefoot{position:fixed;left:0;right:0;bottom:0;max-width:168mm;margin:0 auto;z-index:1;
border-top:0;padding:4mm 0 6mm;background:linear-gradient(to top,#002B36 60%,transparent)}
.pf-ref{font-size:8px}
a{text-decoration:none}
}
`;
