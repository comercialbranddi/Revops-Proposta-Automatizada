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
    catalogoDoIdioma, linhasDaModalidade, prosaDoBloco, contratoTemAtuacao,
    modalidadeNoIdioma, MODALIDADE_AMBOS, MODALIDADE_MONITORIA,
} from '../content/blocos.js';
import { logo, marca } from '../content/logo.js';
import { CANAIS_OPTION_TO_LABEL, CANAIS_LABEL_POR_IDIOMA, PRODUCT_CASCADE_ORDER, IDIOMAS_COM_BLOCOS, IDIOMA_LABEL, QUANTIDADE_POR_PRODUTO } from '../config/proposal.js';

const TZ = 'America/Sao_Paulo';
const VALIDADE_DIAS = 15;
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

// Preço sem os centavos quando são zero — pra faixa da capa, onde o número
// grande respira melhor sem ",00".
const brlCurto = (n) => brl(n).replace(/,00$/, '');

/**
 * Preço grande dos cards de pacote: "R$ 45.546,00 /mês", com os centavos e o
 * "/mês" menores, como no modelo. Mono, tabular, cor cyan (via CSS).
 */
function precoGrande(n, t) {
    const s = brl(n);
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
    return v;
}

/**
 * As opções de pacote, normalizadas. Aceita as DUAS formas gravadas na planilha:
 * `pacote: 15800` (valor fechado) e `pacotes: [{produtos, extras, preco}]`.
 * Cada opção sai com `soma` — o preço cheio do que contém — pra dar o "de/por".
 */
function opcoesDePacote(spec, codes) {
    const precoDe = (c) => Number(spec.porProduto?.[c]?.preco) || 0;
    const lista = Array.isArray(spec.pacotes) && spec.pacotes.length
        ? spec.pacotes
        : (Number(spec.pacote) > 0 ? [{ produtos: codes, extras: [], preco: Number(spec.pacote) }] : []);
    return lista
        .map((o) => {
            const produtos = (o.produtos || []).filter((c) => codes.includes(c));
            const extras = (o.extras || []).map((x) => String(x).trim()).filter(Boolean);
            return { ...o, produtos, extras, soma: produtos.reduce((t, c) => t + precoDe(c), 0) };
        })
        .filter((o) => Number(o.preco) > 0 && (o.produtos.length + o.extras.length) > 0)
        .sort((a, b) => a.preco - b.preco);
}

/** A unidade da quantidade do produto, pra escada dizer "até N do quê". */
function unidadeDe(code) {
    return QUANTIDADE_POR_PRODUTO[code]?.unidade || null;
}

/** A modalidade efetiva de um produto: null quando o produto não tem essa dimensão. */
function modalidadeDo(blocos, code, p) {
    return blocos[code].temModalidade ? (p?.modalidade || MODALIDADE_AMBOS) : null;
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

// ─── Componentes ────────────────────────────────────────────────────

/** Cabeçalho de cláusula: badge numerado + título + subtítulo. */
function sechead(n, titulo, sub) {
    return `<header class="sechead"><span class="secnum">${esc(n)}</span>
    <div class="secttl"><h2>${esc(titulo)}</h2>${sub ? `<p class="secsub">${esc(sub)}</p>` : ''}</div></header>`;
}

/** Grade rótulo/valor em glass card (Identificação, Condições). */
function kvGrid(pares) {
    const cells = pares.filter(Boolean).map(([r, v, cyan]) =>
        `<div class="kv"><span class="kvl">${esc(r)}</span><span class="kvv${cyan ? ' cyan' : ''}">${rich(v)}</span></div>`).join('');
    return `<div class="card grid2">${cells}</div>`;
}

// ─── Cláusulas ──────────────────────────────────────────────────────

function clausulaIdentificacao(ctx) {
    const { deal, spec, meta, codes, t, blocos } = ctx;
    const valor = ctx.opcoes.length > 1 ? t.aPartirDe(brl(ctx.total)) : brl(ctx.total);
    return kvGrid([
        [t.contratante, `<strong>${esc(deal.organizacao)}</strong>`],
        ...(deal.contato ? [[t.destinatario, deal.contato]] : []),
        [t.contratada, t.contratadaValor],
        [t.marcas, (spec.marcas || []).join(', ')],
        [t.servicos, codes.map((c) => blocos[c].titulo).join(' · ')],
        [t.regime, t.regimeValor],
        [t.valorMensal, `${valor} · ${t.verClausula(CLAUSULA_INVESTIMENTO)}`, true],
        [t.validade, t.validadeValor(VALIDADE_DIAS, meta.validade)],
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
        const modLabel = mod ? modalidadeNoIdioma(mod, idioma) : t.semModalidade;
        const linhas = linhasDaModalidade(b.especificacoes, mod)
            .map((l) => [l.rotulo, valorLinha(l.valor, p, idioma)])
            .filter(([, v]) => v != null);
        const rows = linhas.map(([r, v]) =>
            `<div class="spec"><span class="specl">${esc(r)}</span><span class="specv">${rich(v)}</span></div>`).join('');
        const h3 = solo ? '' :
            `<h3><span class="idx">3.${i + 1}</span> ${esc(b.titulo)} <span class="mode">${esc(modLabel)}</span></h3>`;
        return `<div class="bloco">${h3}
      <p class="prosa-p">${rich(prosaDoBloco(blocos, code, mod))}</p>
      <div class="card spectable">${rows}</div></div>`;
    }).join('');
    // Loop da Branddi: notifica/remove só quando algum produto atua.
    const steps = contratoTemAtuacao(spec.porProduto) ? t.loop : t.loopMonitoria;
    const ribbon = `<div class="loop">${steps.map((s) => `<span class="loop-step">${esc(s)}</span>`).join('')}</div>`;
    return blocosHtml + ribbon;
}

/**
 * Escopo e níveis de serviço. NÃO repete o que 1 e 3 já disseram (marcas,
 * modalidade). Fica aqui o SLA (de cada produto + o do contrato, sem repetir
 * entregável), o idioma dos relatórios, o requisito e a observação do lead.
 */
function clausulaEscopo(ctx) {
    const { codes, spec, t, blocos, slaGeral } = ctx;
    const modoContrato = contratoTemAtuacao(spec.porProduto) ? MODALIDADE_AMBOS : MODALIDADE_MONITORIA;
    const vistos = new Set();
    const sla = [
        ...codes.flatMap((c) => linhasDaModalidade(blocos[c].sla, modalidadeDo(blocos, c, spec.porProduto[c]))),
        ...linhasDaModalidade(slaGeral, modoContrato),
    ].filter((l) => (vistos.has(l.entregavel) ? false : vistos.add(l.entregavel)));

    const slaCard = `<div class="card slatable">
      <div class="sla sla-head"><span>${esc(t.thEntregavel)}</span><span>${esc(t.thPeriodicidade)}</span><span>${esc(t.thCanal)}</span></div>
      ${sla.map((l) => `<div class="sla"><span class="e">${esc(l.entregavel)}</span><span>${esc(l.periodicidade)}</span><span>${esc(l.canal)}</span></div>`).join('')}
    </div>`;

    // Requisito: nota legal (§) — pré-condição contratual.
    const req = `<div class="note"><span class="note-ic">§</span><p><strong>${esc(t.requisito)}.</strong> ${esc(t.requisitoValor)}</p></div>`;

    // Observação do lead — só se o closer escreveu. spec.obsProposta (fala do
    // cliente, texto puro), NÃO spec.observacoes (anotação interna do time).
    const obs = String(spec.obsProposta || '').trim()
        ? kvGrid([[t.obsProposta, esc(spec.obsProposta.trim())]])
        : '';
    const idiomas = kvGrid([[t.idiomaRelatorios, t.idiomaRelatoriosValor]]);

    return slaCard + idiomas + req + obs;
}

function clausulaInvestimento(ctx) {
    const { codes, spec, soma, t, blocos, idioma } = ctx;

    // Tabela item a item (com escada de faixas quando houver).
    const linhas = codes.map((c) => {
        const p = spec.porProduto[c] || {};
        const qtdTxt = Number(p.quantidade) > 0
            ? `${t.ate(p.quantidade)}${unidadeDe(c) ? ' ' + unidadeDe(c) : ''}` : null;
        const escopo = [canaisTexto(p, idioma), qtdTxt].filter(Boolean).join(' · ') || '—';
        if (p.faixas?.length) {
            return [{ qtd: p.quantidade, preco: p.preco }, ...p.faixas]
                .filter((f) => Number(f.qtd) > 0 && Number(f.preco) > 0)
                .sort((a, b) => a.qtd - b.qtd)
                .map((f, i) => `<div class="itrow"><span class="i-item">${i === 0 ? `<strong>${esc(blocos[c].titulo)}</strong>` : ''}</span>
          <span class="i-esc">${esc(t.ate(f.qtd))}${unidadeDe(c) ? ' ' + esc(unidadeDe(c)) : ''}</span><span class="i-val">${brl(f.preco)}</span></div>`).join('');
        }
        return `<div class="itrow"><span class="i-item"><strong>${esc(blocos[c].titulo)}</strong></span>
      <span class="i-esc">${esc(escopo)}</span><span class="i-val">${brl(p.preco)}</span></div>`;
    }).join('');

    const { opcoes } = ctx;
    const unica = opcoes.length === 1 && opcoes[0].produtos.length === codes.length && !opcoes[0].extras.length;

    // Fecho da tabela quando UMA opção cobre tudo (caso comum).
    const fecho = unica
        ? (opcoes[0].preco < soma - 0.01
            ? `<div class="itrow sub"><span class="i-item">${esc(t.subtotal)}</span><span></span><span class="i-val">${brl(soma)}</span></div>
         <div class="itrow total"><span class="i-item">${esc(t.totalCombinado)}</span><span class="i-esc">${esc(t.descontoDe(brl(soma - opcoes[0].preco)))}</span><span class="i-val">${brl(opcoes[0].preco)}</span></div>`
            : `<div class="itrow total"><span class="i-item">${esc(t.total)}</span><span></span><span class="i-val">${brl(opcoes[0].preco)}</span></div>`)
        : (opcoes.length ? '' : `<div class="itrow total"><span class="i-item">${esc(t.total)}</span><span></span><span class="i-val">${brl(soma)}</span></div>`);

    const tabela = `<div class="card itable">
      <div class="itrow ihead"><span>${esc(t.thItem)}</span><span>${esc(t.thEscopo)}</span><span class="i-val">${esc(t.thMensal)}</span></div>
      ${linhas}${fecho}</div>`;

    // Duas ou mais opções viram cards de escolha. A mais barata é a recomendada
    // (bundle com desconto). Exibidas em ordem decrescente de preço, pra a
    // recomendada ficar à direita — como no modelo validado.
    const minPreco = opcoes[0]?.preco;
    const ordenadas = [...opcoes].sort((a, b) => b.preco - a.preco);
    let bundleN = 0;
    const cards = (!unica && opcoes.length) ? `<p class="minihead">${esc(t.opcoesPacote)}</p>
    <div class="pacotes">${ordenadas.map((o) => {
        const rec = opcoes.length > 1 && o.preco === minPreco;
        const bundle = (o.produtos.length + o.extras.length) > 1;
        const partes = [...o.produtos.map((c) => blocos[c].titulo), ...o.extras];
        // Avulso (1 item) leva o rótulo "Avulso"; pacote (bundle) leva "Opção N ·
        // Pacote", com a composição no título — como no modelo.
        const tag = bundle ? `${t.pacoteN(++bundleN)} · ${t.pacoteLabel}` : t.avulso;
        const nome = o.rotulo || partes.join(' + ');
        const desc = bundle ? (o.descricao || '') : t.avulsoDesc;
        const eco = o.soma > o.preco + 0.01 ? t.economiaDe(brl(o.soma - o.preco)) : '';
        return `<div class="pcard${rec ? ' rec' : ''}">
          <div class="pcard-top"><span class="ptag">${esc(tag)}</span>${rec ? `<span class="badge-rec">${esc(t.recomendado)}</span>` : ''}</div>
          <h4 class="pname">${esc(nome)}</h4>
          ${desc ? `<p class="pdesc">${esc(desc)}</p>` : ''}
          ${precoGrande(o.preco, t)}
          ${eco ? `<span class="badge-eco">● ${esc(eco)}</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="note"><span class="note-ic">i</span><p>${esc(t.opcoesNota)}</p></div>` : '';

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
        [t.validadeProposta, t.validadeValor(VALIDADE_DIAS, meta.validade), true],
    ]);
}

function clausulaAceite(ctx) {
    const { codes, meta, t, insumos } = ctx;
    const lista = [...codes.map((c) => insumos[c]).filter(Boolean), t.insumoINPI].join('; ');
    const etapas = [
        [t.etapaAceite, t.respContratante, t.prazoAte(meta.validade)],
        [t.etapaEnvio(lista), t.respContratante, 'D+0'],
        [t.etapaConfig, 'Branddi', t.prazoUteis],
        [t.etapaPrimeira, 'Branddi', 'D+7'],
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
    return `<section id="aceite">
    <div class="note acao"><span class="note-ic big">✓</span>
      <div><p class="note-h">${esc(t.aceiteTitulo)}</p><p>${esc(t.aceiteProsa)}</p></div></div>
    <form id="fAceite" class="aceite-form" autocomplete="on">
      <label>${esc(t.aceiteNome)}<input name="nome" required autocomplete="name"></label>
      <label>${esc(t.aceiteEmail)}<input name="email" type="email" required autocomplete="email"></label>
      <label>${esc(t.aceiteCargo)} <span class="opc">${esc(t.aceiteOpcional)}</span><input name="cargo" autocomplete="organization-title"></label>
      <button type="submit">${esc(t.aceiteBotao)}</button>
      <p class="msg" id="aceiteMsg" role="status"></p>
    </form>
    <script>
    (function () {
      var f = document.getElementById('fAceite');
      var LABEL = ${JSON.stringify(t.aceiteBotao)}, ENVIANDO = ${JSON.stringify(t.aceiteEnviando)};
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = f.querySelector('button'), msg = document.getElementById('aceiteMsg');
        btn.disabled = true; btn.textContent = ENVIANDO; msg.textContent = '';
        try {
          var r = await fetch('/api/proposal/aceite/${esc(ctx.slug)}', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: f.nome.value, email: f.email.value, cargo: f.cargo.value }),
          });
          var d = await r.json();
          if (!r.ok) throw new Error(d.error || 'falhou');
          location.reload();
        } catch (err) {
          msg.textContent = ${JSON.stringify(t.aceiteErro('@@'))}.replace('@@', err.message);
          btn.disabled = false; btn.textContent = LABEL;
        }
      });
    })();
    <\/script></section>`;
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

    const validade = new Date(emitidaEm.getTime() + VALIDADE_DIAS * 86400000);
    const soma = codes.reduce((acc, c) => acc + (Number(spec.porProduto[c]?.preco) || 0), 0);
    const opcoes = opcoesDePacote(spec, codes);
    const total = opcoes.length ? opcoes[0].preco : soma;
    const meta = {
        numero: `${t.numeroPrefixo}-${deal.id}`,
        emissao: dataNoIdioma(emitidaEm, idioma),
        validade: dataNoIdioma(validade, idioma),
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
            return `3.1 — ${blocos[c].titulo} · ${mod ? modalidadeNoIdioma(mod, idioma) : t.semModalidade}`;
        }
        return t.clausulasSub?.[i];
    };
    const corpo = CLAUSULAS.map((fn, i) =>
        `<section class="clausula">${sechead(i + 1, t.clausulas[i], subDaClausula(i))}${fn(ctx)}</section>`).join('\n');

    // Capa: título hero em duas linhas — serviços + conector, e a marca do
    // cliente em destaque (gradiente) na segunda.
    const heroL1 = `${codes.map((c) => blocos[c].titulo).join(' + ')} ${t.heroConector}`;
    const chamada = t.chamada?.[codes[0]] || blocos[codes[0]].objetivo;
    const titulo = `${codes.map((c) => blocos[c].titulo).join(' · ')} — ${deal.organizacao}`;

    const strip = [
        [t.emissao, meta.emissao], [t.validadeCurta, meta.validade],
        [t.regime, REGIME_CURTO[idioma] || REGIME_CURTO.pt], [t.valorMensal, brlCurto(total), true],
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
    <div class="cover-ref"><div class="pcnum">${esc(meta.numero)}</div><div class="pctipo">${esc(t.docTipo)}</div></div>
  </div>
  <div class="watermark">${marca(560)}</div>
  <div class="cover-mid">
    <span class="eyebrow">${esc(t.capaEyebrow || t.kicker)}</span>
    <h1 class="hero"><span class="l1">${esc(heroL1)}</span><br><span class="grad">${esc(deal.organizacao)}</span></h1>
    <p class="herosub">${esc(chamada)}</p>
    <div class="strip">${strip}</div>
  </div>
  <div class="cover-foot">
    <div>${esc(t.contratadaValor)}<br><span class="cf-dim">${deal.contato ? `${esc(t.capaPara)} ${esc(deal.contato)} — ` : ''}${esc(deal.organizacao)}</span></div>
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
  <span class="pf-ref">${esc(meta.numero)} · ${esc(t.rodapeValida)} ${esc(meta.validade)}</span>
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
padding:clamp(1.6rem,5vw,3rem);background:radial-gradient(circle at 50% -8%,#0A4B57 0%,#002B36 62%)}
.watermark{position:absolute;right:-6%;top:44%;transform:translateY(-50%);z-index:-1;
opacity:.5;filter:blur(.3px);pointer-events:none;
--logo-fill:#0A3A47;--logo-accent:#0C4657;--logo-counter:#002B36}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}
.cover-ref{text-align:right;font-family:var(--mono)}
.pcnum{font-size:1.15rem;font-weight:700;letter-spacing:.06em;color:var(--text)}
.pctipo{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--cyan);margin-top:.2rem}
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
.strip{margin-top:2rem;display:grid;grid-template-columns:repeat(4,1fr);gap:0;max-width:40rem;
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

/* Cards de pacote */
.minihead{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);
font-weight:700;margin:.4rem 0 -.2rem}
.pacotes{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.pcard{background:var(--card-bg);border:1px solid var(--line);border-radius:var(--radius);padding:1.3rem 1.3rem 1.4rem;
display:flex;flex-direction:column;gap:.55rem;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.pcard.rec{border-color:rgba(10,207,222,.55)}
.pcard-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
.ptag{font-family:var(--mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700}
.pcard.rec .ptag{color:var(--cyan)}
.badge-rec{font-family:var(--mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
color:var(--success);border:1px solid rgba(34,197,94,.4);border-radius:var(--radius-pill);padding:.2rem .6rem}
.pname{font-size:1.15rem;font-weight:700;color:var(--text);letter-spacing:-.01em}
.pdesc{font-size:.82rem;line-height:1.5;color:var(--muted)}
.preco{display:block;margin-top:.35rem;font-family:var(--mono);color:var(--cyan);white-space:nowrap}
.preco .pv{font-size:2.05rem;font-weight:700;letter-spacing:-.02em}
.preco .pc{font-size:1rem;font-weight:500}
.preco .pm{font-size:.85rem;color:var(--muted);margin-left:.4rem;font-weight:400}
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

/* Formulário de aceite */
#aceite{display:flex;flex-direction:column;gap:1rem}
.aceite-form{display:flex;flex-direction:column;gap:.7rem;max-width:28rem}
.aceite-form label{display:flex;flex-direction:column;gap:.3rem;font-family:var(--mono);font-size:.6rem;
letter-spacing:.11em;text-transform:uppercase;color:var(--muted);font-weight:700}
.aceite-form .opc{text-transform:none;letter-spacing:0;font-weight:400}
.aceite-form input{font:400 .95rem var(--sans);color:var(--text);background:var(--field);
border:1px solid var(--line);border-radius:var(--radius-sm);padding:.6rem .75rem}
.aceite-form input:focus-visible{outline:2px solid var(--cyan);outline-offset:1px}
.aceite-form button{font:700 .95rem var(--sans);background:var(--cyan);color:var(--navy);border:0;
border-radius:var(--radius-pill);padding:.7rem 1.4rem;cursor:pointer;margin-top:.3rem;align-self:flex-start}
.aceite-form button:hover{background:var(--turq)}
.aceite-form button:disabled{opacity:.5;cursor:not-allowed}
.aceite-form .msg{font-size:.82rem;color:var(--alert);margin:0}

/* Chamada de fechamento */
.cta{text-align:center;padding:1.5rem 0 1rem;display:flex;flex-direction:column;gap:.7rem;align-items:center}
/* Cyan sólido: no CTA (h2 centralizado, texto direto) o clip-to-text volta a
   pintar a caixa no Skia; o hero escapa por ter a estrutura com <span>. Sólido
   fica limpo e pertíssimo do gradiente do modelo. */
.cta-h{font-size:clamp(1.4rem,4vw,2rem);font-weight:800;line-height:1.18;max-width:22ch;color:var(--cyan)}
.cta-sub{font-family:var(--mono);font-size:.78rem;letter-spacing:.08em;color:var(--muted)}

/* Rodapé de página. Na tela sai uma vez, no fim; na impressão vira fixo e o
   Chrome o repete no pé de cada folha (ver bloco @media print). */
.pagefoot{max-width:52rem;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:1rem;
padding:1rem clamp(1rem,4vw,2.4rem) 2rem;border-top:1px solid var(--line)}
.pf-logo{opacity:.85;display:flex}
.pf-ref{font-family:var(--mono);font-size:.62rem;letter-spacing:.05em;color:var(--muted)}

/* ── Impressão / PDF ────────────────────────────────────────────────── */
@media print{
/* Margem inferior deixa a faixa do rodapé livre; o resto define a caixa da folha. */
@page{size:A4;margin:14mm 16mm 14mm}
html,body{background:var(--navy)}
body{font-size:10.5pt}
/* O gradiente e as cores de fundo são identidade — saem no papel. */
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{max-width:none}
/* Interface não vai pro papel. */
.acoes,.aceite-form{display:none}
/* A capa ocupa a primeira folha inteira; o conteúdo começa na seguinte. Fundo
   opaco + z-index (na regra base) cobrem o rodapé fixo nesta folha. */
.cover{min-height:auto;height:calc(297mm - 28mm);break-after:page}
.watermark{opacity:.5}
.pad{padding:0;gap:8mm}
/* Cada cláusula tenta ficar inteira; título nunca órfão do que vem depois. */
.clausula{break-inside:avoid}
.sechead,h2,h3,h4{break-after:avoid}
.card,.note,.pcard,.tl-item,.loop{break-inside:avoid}
p,li{orphans:3;widows:3}
.cta{break-before:avoid}
/* Rodapé: o Chrome repete elementos position:fixed no pé de cada folha impressa.
   bottom pequeno e positivo o pousa no rodapé (posição confiável); fundo petrol
   opaco mascara qualquer conteúdo que chegue perto; z-index baixo pra a capa
   (z-index:2, fundo opaco) cobri-lo inteiro na 1a folha. */
.pagefoot{position:fixed;left:0;right:0;bottom:0;max-width:none;margin:0;z-index:1;
border-top:0;padding:2mm 16mm;background:#002B36}
.pf-ref{font-size:8px}
a{text-decoration:none}
}
`;
