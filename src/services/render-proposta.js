/**
 * Monta o documento da proposta a partir do spec do formulário e do catálogo
 * de blocos, em português, inglês ou espanhol. Saída: HTML autocontido — sem
 * CDN, sem fonte externa, com CSS de impressão, pra virar PDF direto do
 * navegador.
 *
 * Por que HTML e não Google Doc (decisão de 18/08/2026): o modelo validado é
 * um documento HTML. Reproduzi-lo pela API do Docs é ordem de grandeza mais
 * trabalho e entrega um resultado visualmente pior que o já aprovado.
 *
 * Nada aqui inventa texto. Prosa, especificações e SLA vêm de `content/`;
 * números e escolhas vêm do spec. É o que garante que o documento enviado seja
 * o que foi validado na tela de revisão.
 *
 * ─── Idioma ─────────────────────────────────────────────────────────
 *
 * Tudo que é texto sai de `catalogoDoIdioma(idioma)`: os blocos de produto e
 * também a moldura do documento — títulos de cláusula, cabeçalhos de tabela,
 * cláusula legal, bloco de aceite, faixas de aviso. Traduzir só os blocos
 * produziria proposta com cláusula em inglês e cabeçalho em português, que é
 * exatamente o defeito dos documentos antigos.
 *
 * DUAS coisas NÃO acompanham o idioma, de propósito:
 *
 * 1. **A moeda.** Fica em real, com formatação brasileira, nos três idiomas —
 *    "R$ 7.900,00/month" é como o comercial já escrevia. A escolha entre real e
 *    dólar segue aberta e é comercial: o espanhol antigo cobrava em USD quando
 *    era Brand Bidding sozinho e em real no combo. Manter real é o único
 *    comportamento que não inventa uma regra que ninguém definiu.
 *
 * 2. **A modalidade gravada no spec.** Fica em português ("Monitoria +
 *    Atuação"), que é o valor canônico do formulário e da planilha. Só a
 *    exibição traduz — assim uma proposta em inglês continua legível pra quem
 *    olha a planilha ou o Pipedrive.
 *
 * A cláusula "Situação apurada" (o diagnóstico do prospect) NÃO é gerada:
 * esse dado ainda não está conectado. Melhor a seção não existir do que sair
 * com número inventado num documento comercial.
 */
import {
    catalogoDoIdioma, linhasDaModalidade, prosaDoBloco, contratoTemAtuacao,
    modalidadeNoIdioma, MODALIDADE_AMBOS, MODALIDADE_MONITORIA,
} from '../content/blocos.js';
import { CANAIS_OPTION_TO_LABEL, CANAIS_LABEL_POR_IDIOMA, PRODUCT_CASCADE_ORDER, IDIOMAS_COM_BLOCOS, IDIOMA_LABEL } from '../config/proposal.js';

const TZ = 'America/Sao_Paulo';
const VALIDADE_DIAS = 15;
const CLAUSULA_INVESTIMENTO = 4;

/**
 * O CSS sem os comentários de fonte. Eles explicam decisão interna, em
 * português, e iam parar no "ver código-fonte" do cliente — inclusive numa
 * proposta em inglês. Ficam no arquivo, saem do documento.
 */
let _css = null;
const cssLimpo = () => (_css ??= CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[ \t]*\n[ \t]*\n+/g, '\n'));

const esc = (s) => String(s ?? '')
    .replace(/&(?!\w+;|#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A prosa do catálogo tem <strong> de propósito — é ênfase editorial, não dado
// de usuário. Escapa tudo e devolve só essa tag.
const rich = (s) => esc(s).replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');

// Formatação brasileira em qualquer idioma — ver o cabeçalho. O   que o
// toLocaleString põe entre "R$" e o número vira espaço normal: visualmente
// idêntico, e a saída deixa de depender de um caractere invisível pra quem for
// ler o documento depois (busca, teste, extração de PDF).
const brl = (n) => Number(n)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
    .replace(/ /g, ' ');

/**
 * Data no idioma do documento. Inglês sai com o mês escrito ("August 18,
 * 2026") em vez de numérico: "08/18" e "18/08" são a mesma string com sentidos
 * diferentes, e proposta comercial não pode ter data ambígua. Português e
 * espanhol usam a mesma ordem, então numérico não confunde.
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
    // Canal digitado no formulario. Existe porque a lista fixa nunca vai cobrir
    // tudo: as propostas reais do time trazem 18 combinacoes distintas de
    // plataforma, e obrigar o closer a escolher so o que ja esta cadastrado o
    // faria mandar a proposta errada ou montar a mao.
    const digitados = (p.canaisOutros || []).map((c) => String(c).trim()).filter(Boolean);
    const labels = [...doCatalogo, ...digitados];
    return labels.length ? labels.join(', ') : null;
}

/**
 * Preenche os marcadores do catálogo com o que veio do formulário.
 * Devolve null quando o marcador não tem valor — a linha inteira some, em vez
 * de sair "Canais: {{CANAIS}}" no documento do cliente.
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

function tabela(linhas) {
    if (!linhas.length) return '';
    return `<div class="tw"><table><tbody>${linhas
        .map(([r, v]) => `<tr><th scope="row">${esc(r)}</th><td>${rich(v)}</td></tr>`).join('')}</tbody></table></div>`;
}

/** A modalidade efetiva de um produto: null quando o produto não tem essa dimensão. */
function modalidadeDo(blocos, code, p) {
    return blocos[code].temModalidade ? (p?.modalidade || MODALIDADE_AMBOS) : null;
}

// ─── Cláusulas ──────────────────────────────────────────────────────

function clausulaIdentificacao(ctx) {
    const { deal, spec, meta, codes, t, blocos } = ctx;
    return tabela([
        [t.contratante, `<strong>${esc(deal.organizacao)}</strong>`],
        ...(deal.contato ? [[t.destinatario, deal.contato]] : []),
        [t.contratada, t.contratadaValor],
        [t.marcas, (spec.marcas || []).join(', ')],
        [t.servicos, codes.map((c) => blocos[c].titulo).join(' · ')],
        [t.regime, t.regimeValor],
        [t.valorMensal, `<strong>${brl(ctx.total)}</strong> — ${t.verClausula(CLAUSULA_INVESTIMENTO)}`],
        [t.validade, t.validadeValor(VALIDADE_DIAS, meta.validade)],
    ]);
}

function clausulaObjetivo(ctx) {
    const { codes, deal, t, blocos } = ctx;
    const varios = codes.length > 1;
    const itens = codes.map((c) => `<li>${esc(blocos[c].objetivo)}</li>`).join('');
    return `<p>${esc(t.objetivoAbre(varios))}</p><ul>${itens}</ul>
    <p>${esc(t.objetivoFecha(varios, deal.organizacao))}</p>`;
}

function clausulaAbordagem(ctx) {
    const { t, blocos, idioma } = ctx;
    return ctx.codes.map((code, i) => {
        const b = blocos[code];
        const p = ctx.spec.porProduto[code] || {};
        const mod = modalidadeDo(blocos, code, p);
        const badge = mod ? `<span class="mode">${esc(modalidadeNoIdioma(mod, idioma))}</span>` : '';
        const linhas = linhasDaModalidade(b.especificacoes, mod)
            .map((l) => [l.rotulo, valorLinha(l.valor, p, idioma)])
            .filter(([, v]) => v != null);
        return `<h3><span class="idx">3.${i + 1}</span> ${esc(b.titulo)} ${badge}</h3>
      <p class="fine">${rich(prosaDoBloco(blocos, code, mod))}</p>
      ${tabela(linhas)}`;
    }).join('');
}

function clausulaEscopo(ctx) {
    const { codes, spec, t, blocos, slaGeral, idioma } = ctx;
    const modalidades = codes.map((c) => {
        const mod = modalidadeDo(blocos, c, spec.porProduto[c]);
        return [t.modalidadeDe(blocos[c].titulo), mod
            ? `<strong>${esc(modalidadeNoIdioma(mod, idioma))}</strong>`
            : t.semModalidade];
    });

    // SLA: o de cada produto, mais o do contrato inteiro. Sem repetir entregável
    // que dois produtos declaram igual — o cliente não precisa ler duas vezes
    // que recebe relatório semanal.
    const modoContrato = contratoTemAtuacao(spec.porProduto) ? MODALIDADE_AMBOS : MODALIDADE_MONITORIA;
    const vistos = new Set();
    const sla = [
        ...codes.flatMap((c) => linhasDaModalidade(blocos[c].sla, modalidadeDo(blocos, c, spec.porProduto[c]))),
        ...linhasDaModalidade(slaGeral, modoContrato),
    ].filter((l) => (vistos.has(l.entregavel) ? false : vistos.add(l.entregavel)));

    return `${tabela([
        [t.marcas, (spec.marcas || []).join(', ')],
        ...modalidades,
        [t.idiomaRelatorios, t.idiomaRelatoriosValor],
        [t.requisito, t.requisitoValor],
    ])}
    <h4>${esc(t.entregaveis)}</h4>
    <div class="tw"><table>
      <thead><tr><th scope="col">${esc(t.thEntregavel)}</th><th scope="col">${esc(t.thPeriodicidade)}</th><th scope="col">${esc(t.thCanal)}</th></tr></thead>
      <tbody>${sla.map((l) => `<tr><td>${esc(l.entregavel)}</td><td>${esc(l.periodicidade)}</td><td>${esc(l.canal)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function clausulaInvestimento(ctx) {
    const { codes, spec, soma, total, t, blocos, idioma } = ctx;
    const linhas = codes.map((c) => {
        const p = spec.porProduto[c] || {};
        const escopo = [canaisTexto(p, idioma), Number(p.quantidade) > 0 ? t.ate(p.quantidade) : null]
            .filter(Boolean).join(' · ') || '—';
        // Escada: uma linha por faixa, em vez de preço único. Exceção, não regra.
        if (p.faixas?.length) {
            return [{ qtd: p.quantidade, preco: p.preco }, ...p.faixas]
                .filter((f) => Number(f.qtd) > 0 && Number(f.preco) > 0)
                .sort((a, b) => a.qtd - b.qtd)
                .map((f, i) => `<tr><td>${i === 0 ? `<strong>${esc(blocos[c].titulo)}</strong>` : ''}</td>
          <td>${esc(t.ate(f.qtd))}</td><td class="n-cell">${brl(f.preco)}</td></tr>`).join('');
        }
        return `<tr><td><strong>${esc(blocos[c].titulo)}</strong></td><td>${esc(escopo)}</td>
      <td class="n-cell">${brl(p.preco)}</td></tr>`;
    }).join('');

    // "De / Por" só quando há desconto real. Pacote igual à soma não é desconto,
    // e mostrar as duas linhas iguais só levanta pergunta.
    const fecho = total < soma - 0.01
        ? `<tr class="sub"><td>${esc(t.subtotal)}</td><td></td><td class="n-cell">${brl(soma)}</td></tr>
       <tr class="total"><td>${esc(t.totalCombinado)}</td><td>${esc(t.descontoDe(brl(soma - total)))}</td><td class="n-cell">${brl(total)}</td></tr>`
        : `<tr class="total"><td>${esc(t.total)}</td><td></td><td class="n-cell">${brl(total)}</td></tr>`;

    return `<div class="tw"><table>
      <thead><tr><th scope="col">${esc(t.thItem)}</th><th scope="col">${esc(t.thEscopo)}</th><th scope="col" style="text-align:right">${esc(t.thMensal)}</th></tr></thead>
      <tbody>${linhas}${fecho}</tbody></table></div>
    ${tabela([[t.setup, cond(ctx, 'setup', t.setupValor)], [t.impostos, t.impostosValor]])}`;
}

/**
 * Condicao negociada vence a padrao. O formulario manda em `spec.condicoes` so
 * o que o closer alterou — o que nao vier continua sendo a condicao padrao da
 * Branddi, e e isso que evita que um esquecimento no formulario apague uma
 * clausula do contrato.
 */
function cond(ctx, chave, padrao) {
    const v = ctx.spec.condicoes?.[chave];
    return (typeof v === 'string' && v.trim()) ? v.trim() : padrao;
}

function clausulaCondicoes(ctx) {
    const { t, meta } = ctx;
    return tabela([
        [t.pagamento, cond(ctx, 'pagamento', t.pagamentoValor)],
        [t.vigencia, cond(ctx, 'vigencia', t.vigenciaValor)],
        [t.rescisao, cond(ctx, 'rescisao', t.rescisaoValor)],
        [t.implantacao, cond(ctx, 'implantacao', t.implantacaoValor)],
        [t.validadeProposta, t.validadeValor(VALIDADE_DIAS, meta.validade)],
    ]);
}

function clausulaAceite(ctx) {
    const { codes, meta, t, insumos } = ctx;
    // O que o cliente precisa mandar depende do que ele contratou: SKU só se
    // tem BBP, safelist só se tem GD. Pedir tudo em toda proposta faz o cliente
    // perguntar por que precisa de algo que não contratou.
    const lista = [...codes.map((c) => insumos[c]).filter(Boolean), t.insumoINPI].join('; ');
    return `<div class="tw"><table>
    <thead><tr><th scope="col">${esc(t.thEtapa)}</th><th scope="col">${esc(t.thResponsavel)}</th><th scope="col">${esc(t.thPrazo)}</th></tr></thead>
    <tbody>
      <tr><td>${esc(t.etapaAceite)}</td><td>${esc(t.respContratante)}</td><td>${esc(t.prazoAte(meta.validade))}</td></tr>
      <tr><td>${esc(t.etapaEnvio(lista))}</td><td>${esc(t.respContratante)}</td><td>D+0</td></tr>
      <tr><td>${esc(t.etapaConfig)}</td><td>Branddi</td><td>${esc(t.prazoUteis)}</td></tr>
      <tr><td>${esc(t.etapaPrimeira)}</td><td>Branddi</td><td>D+7</td></tr>
      <tr><td>${esc(t.etapaReuniao)}</td><td>${esc(t.respAmbas)}</td><td>D+30</td></tr>
    </tbody></table></div>`;
}

/**
 * O aceite. Só aparece quando a proposta tem endereço (slug) — o preview
 * gerado no formulário não deve oferecer aceite a ninguém.
 *
 * É declaração do cliente, não assinatura qualificada: prova intenção e data,
 * não identidade certificada. O texto diz isso, pra ninguém achar que assinou
 * contrato ali.
 */
function blocoAceite(ctx, vencida) {
    const { t, idioma } = ctx;
    if (!ctx.slug) return '';
    if (ctx.aceite) {
        const locale = idioma === 'en' ? 'en-US' : (idioma === 'es' ? 'es-ES' : 'pt-BR');
        const q = new Date(ctx.aceite.quando).toLocaleString(locale, { timeZone: TZ, dateStyle: 'long', timeStyle: 'short' });
        return `<section class="aceito"><h2><span class="idx">✓</span> ${esc(t.aceiteAceitaTitulo)}</h2>
      <p>${t.aceitaPor(esc(ctx.aceite.nome), esc(ctx.aceite.cargo || ''), esc(ctx.aceite.email), esc(q))}</p>
      <p class="fine">${esc(t.aceitaNota)}</p></section>`;
    }
    // Substituída não aceita: o cliente estaria concordando com um valor que a
    // Branddi já revisou. Se ele quiser fechar, é pela versão atual.
    if (vencida || ctx.substituida) return '';
    return `<section id="aceite"><h2><span class="idx">✓</span> ${esc(t.aceiteTitulo)}</h2>
    <p class="fine">${esc(t.aceiteProsa)}</p>
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

    // Barrar aqui, e não só na tela: bloquear no formulário é interface, não
    // garantia. Um POST direto com idioma sem catálogo sairia em português calado.
    const idioma = spec.idioma || 'pt';
    if (!IDIOMAS_COM_BLOCOS.includes(idioma)) {
        throw new Error(`ainda não existe modelo em ${IDIOMA_LABEL[idioma] || idioma} — a proposta só sai nos idiomas com catálogo escrito`);
    }
    const { blocos, slaGeral, insumos, textos: t } = catalogoDoIdioma(idioma);

    const validade = new Date(emitidaEm.getTime() + VALIDADE_DIAS * 86400000);
    const soma = codes.reduce((acc, c) => acc + (Number(spec.porProduto[c]?.preco) || 0), 0);
    const total = Number(spec.pacote) > 0 ? Number(spec.pacote) : soma;
    const meta = {
        numero: `${t.numeroPrefixo}-${deal.id}`,
        emissao: dataNoIdioma(emitidaEm, idioma),
        validade: dataNoIdioma(validade, idioma),
    };
    const ctx = { deal, spec, codes, meta, soma, total, slug, aceite, substituida, idioma, t, blocos, slaGeral, insumos };

    const vencida = Date.now() > validade.getTime() + 86400000; // até o fim do dia da validade

    // Substituída vem antes de vencida: se as duas valem, o que o cliente
    // precisa é do endereço novo, não do aviso de prazo.
    const aviso = substituida
        ? `<div class="substituida"><b>${esc(t.substituidaTitulo)}</b> ${esc(t.substituidaTexto(substituida.revisao))}
           <a href="/p/${esc(substituida.slug)}">${esc(t.substituidaLink)}</a>.</div>`
        : vencida
            ? `<div class="vencida"><b>${esc(t.vencidaTitulo(meta.validade))}</b> ${esc(t.vencidaTexto)}</div>`
            : '';

    const corpo = CLAUSULAS.map((fn, i) =>
        `<section><h2><span class="idx">${i + 1}</span> ${esc(t.clausulas[i])}</h2>${fn(ctx)}</section>`).join('\n');

    const titulo = `${codes.map((c) => blocos[c].titulo).join(' · ')} — ${deal.organizacao}`;

    return `<!doctype html><html lang="${esc(idioma)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(deal.organizacao)} — Branddi</title>
<!-- Proposta com preço de cliente. O link é privado por ser imprevisível, mas
     basta alguém colá-lo em qualquer lugar público pra virar resultado de
     busca. noindex fecha esse caminho. -->
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<!-- Montserrat e a fonte da proposta que o time envia hoje: 110 dos 112
     trechos do MODELO BB no Drive usam ela. preconnect + display=swap pra a
     pagina nao ficar em branco esperando a fonte, e stack de reserva pro caso
     de a rede do cliente bloquear o Google Fonts. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>${cssLimpo()}</style></head><body><div class="wrap"><article class="sheet">
<header class="masthead">
  <div class="logo">Brand<span>di</span></div>
  <div class="ref"><b>${esc(meta.numero)}</b><br>${esc(t.emissao)} ${esc(meta.emissao)} · ${esc(t.validadeCurta)} ${esc(meta.validade)}</div>
</header>
<div class="acoes">
  <button type="button" onclick="window.print()">${esc(t.baixarPdf)}</button>
  <span>${esc(t.baixarPdfDica)}</span>
</div>
${aviso}
<div class="doctitle">
  <p class="kicker">${esc(t.kicker)}</p>
  <h1>${esc(titulo)}</h1>
</div>
<div class="pad">
${corpo}
${blocoAceite(ctx, vencida)}
</div>
<footer class="foot">
  <div><b>Branddi</b> — ${esc(t.rodape)}</div>
  <div>${esc(meta.numero)} · ${esc(t.rodapeValida)} ${esc(meta.validade)}</div>
</footer>
</article></div></body></html>`;
}

const CSS = `
:root{--bg:#F1F5F9;--surface:#fff;--surface-2:#F8FAFC;--text:#0F172A;--muted:#475569;--dim:#64748B;
--accent:#0891B2;--turquoise:#0E7490;--rule:#D8E0E8;--rule-soft:#EAEFF4;--petrol:#002B36;
--on-petrol:#fff;--on-petrol-dim:#94A3B8;--logo-accent:#4BBECD;
--shadow:0 1px 2px rgba(15,23,42,.04),0 18px 44px -24px rgba(15,23,42,.2);
--display:"Montserrat","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
--sans:"Montserrat","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
--mono:"Cascadia Mono",Consolas,ui-monospace,SFMono-Regular,monospace;--measure:72ch}
@media (prefers-color-scheme:dark){:root{--bg:#001721;--surface:#002B36;--surface-2:#00323F;--text:#fff;
--muted:#B6C2CF;--dim:#8A97A6;--accent:#00E5FF;--turquoise:#4BBECD;--rule:#004052;--rule-soft:#00323F;
--shadow:0 1px 2px rgba(0,0,0,.5),0 18px 48px -24px rgba(0,0,0,.75)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--muted);font:14.5px/1.52 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{display:flex;justify-content:center;padding:clamp(.7rem,2.5vw,1.8rem) clamp(.6rem,2.5vw,1.4rem) 3rem}
.sheet{width:100%;max-width:47rem;background:var(--surface);border:1px solid var(--rule);
box-shadow:var(--shadow);overflow:hidden}
.masthead{background:var(--petrol);padding:1rem clamp(1rem,3.5vw,2.2rem);display:flex;
align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.logo{font-family:var(--display);color:var(--on-petrol);font-weight:700;font-size:1.15rem;letter-spacing:.01em}
.logo span{color:var(--logo-accent)}
.ref{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;line-height:1.65;
color:var(--on-petrol-dim);text-align:right}
.ref b{color:var(--on-petrol);font-weight:600}
.doctitle{padding:clamp(1.1rem,3.5vw,1.8rem) clamp(1rem,3.5vw,2.2rem);border-bottom:1px solid var(--rule);
background:var(--surface-2)}
.kicker{font-family:var(--mono);font-size:.63rem;letter-spacing:.17em;text-transform:uppercase;
color:var(--accent);font-weight:700;margin:0 0 .45rem}
h1{font-family:var(--display);font-size:clamp(1.15rem,3vw,1.45rem);line-height:1.28;letter-spacing:-.012em;
color:var(--text);font-weight:700;margin:0;max-width:46ch;text-wrap:balance}
.pad{padding:clamp(1.2rem,3.5vw,2.2rem) clamp(1rem,3.5vw,2.2rem);display:flex;flex-direction:column;gap:1.7rem}
section{display:flex;flex-direction:column;gap:.7rem}
h2{font-family:var(--display);font-size:.95rem;line-height:1.3;color:var(--text);font-weight:700;margin:0;
padding-bottom:.4rem;border-bottom:1.5px solid var(--petrol);display:flex;gap:.6rem;align-items:baseline}
@media (prefers-color-scheme:dark){h2{border-bottom-color:var(--accent)}}
h2 .idx{font-family:var(--mono);color:var(--accent);font-size:.82rem;font-weight:700}
h3{font-family:var(--display);font-size:.85rem;color:var(--text);font-weight:700;margin:.5rem 0 0;
display:flex;gap:.55rem;align-items:baseline;flex-wrap:wrap}
h3 .idx{font-family:var(--mono);color:var(--dim);font-size:.75rem;font-weight:600}
.mode{font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;
color:var(--turquoise);border:1px solid var(--turquoise);border-radius:2px;padding:.05rem .3rem;font-weight:700}
h4{font-family:var(--mono);font-size:.61rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);
font-weight:700;margin:.35rem 0 -.2rem}
p{margin:0;max-width:var(--measure);font-size:.88rem}
.fine{font-size:.83rem;color:var(--dim)}
.fine strong,td strong,li strong{color:var(--text);font-weight:600}
ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.3rem;font-size:.87rem;max-width:var(--measure)}
li::marker{color:var(--accent)}
.tw{overflow-x:auto;border:1px solid var(--rule)}
table{border-collapse:collapse;width:100%;font-size:.82rem}
th,td{text-align:left;padding:.44rem .75rem;border-bottom:1px solid var(--rule-soft);vertical-align:top}
tbody tr:last-child>*{border-bottom:0}
thead th{font-family:var(--mono);font-size:.6rem;letter-spacing:.11em;text-transform:uppercase;color:var(--dim);
font-weight:700;background:var(--surface-2);border-bottom:1px solid var(--rule);white-space:nowrap}
th[scope=row]{font-family:var(--mono);font-size:.68rem;color:var(--dim);font-weight:400;width:12rem;white-space:nowrap}
.n-cell{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text);font-weight:600}
tr.sub>*{border-top:1px solid var(--rule);background:var(--surface-2);color:var(--dim)}
tr.sub .n-cell{color:var(--dim);font-weight:400}
tr.total>*{border-top:1.5px solid var(--petrol);background:var(--surface-2);padding-top:.55rem;padding-bottom:.55rem}
@media (prefers-color-scheme:dark){tr.total>*{border-top-color:var(--accent)}}
tr.total td:first-child{color:var(--text);font-weight:700;font-family:var(--display)}
tr.total .n-cell{color:var(--text);font-weight:700;font-size:1rem;font-family:var(--display)}
blockquote{margin:0;padding:.05rem 0 .05rem .9rem;border-left:2px solid var(--accent);font-size:.84rem;max-width:var(--measure)}
blockquote cite{display:block;margin-top:.35rem;font-family:var(--mono);font-size:.63rem;font-style:normal;color:var(--dim)}
.foot{background:var(--petrol);padding:.8rem clamp(1rem,3.5vw,2.2rem);display:flex;justify-content:space-between;
gap:.4rem 1rem;flex-wrap:wrap;font-family:var(--mono);font-size:.62rem;letter-spacing:.04em;color:var(--on-petrol-dim)}
.foot b{color:var(--on-petrol);font-weight:600}
.acoes{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;padding:.7rem clamp(1rem,3.5vw,2.2rem);
background:var(--surface-2);border-bottom:1px solid var(--rule);font-size:.76rem;color:var(--dim)}
.acoes button{font:600 .8rem var(--sans);background:var(--accent);color:#fff;border:0;border-radius:3px;
padding:.45rem 1rem;cursor:pointer}
@media (prefers-color-scheme:dark){.acoes button{color:#00212B}}
.acoes button:hover{filter:brightness(1.08)}
.acoes button:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.substituida{padding:.75rem clamp(1rem,3.5vw,2.2rem);background:#FEF3C7;color:#78350F;
border-bottom:1px solid #FCD34D;font-size:.84rem}
.substituida b{color:#78350F}
.substituida a{color:#78350F;font-weight:700}
@media (prefers-color-scheme:dark){.substituida{background:#3B2E0A;color:#FDE68A;border-bottom-color:#78350F}
.substituida b,.substituida a{color:#FDE68A}}
.vencida{padding:.75rem clamp(1rem,3.5vw,2.2rem);background:#FEF3C7;color:#78350F;
border-bottom:1px solid #FCD34D;font-size:.84rem}
.vencida b{color:#78350F}
@media (prefers-color-scheme:dark){.vencida{background:#3B2E0A;color:#FDE68A;border-bottom-color:#78350F}
.vencida b{color:#FDE68A}}
/* O aceite é o fecho do documento, não mais uma cláusula: centralizado, ele
   lê como painel de ação em vez de tabela que sobrou no rodapé. */
#aceite{align-items:center;text-align:center}
#aceite h2{align-self:stretch}
#aceite .fine{max-width:46ch;margin-inline:auto}
.aceite-form{display:flex;flex-direction:column;gap:.6rem;width:100%;max-width:26rem;
margin-inline:auto;text-align:left;border:1px solid var(--accent);
padding:1rem;border-radius:3px;background:var(--surface-2)}
.aceite-form label{display:flex;flex-direction:column;gap:.25rem;font-family:var(--mono);font-size:.62rem;
letter-spacing:.11em;text-transform:uppercase;color:var(--dim);font-weight:700}
.aceite-form .opc{text-transform:none;letter-spacing:0;font-weight:400}
.aceite-form input{font:400 .9rem var(--sans);color:var(--text);background:var(--surface);
border:1px solid var(--rule);border-radius:3px;padding:.45rem .6rem}
.aceite-form input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.aceite-form button{font:700 .9rem var(--sans);background:var(--accent);color:#fff;border:0;
border-radius:3px;padding:.6rem 1.2rem;cursor:pointer;margin-top:.2rem}
@media (prefers-color-scheme:dark){.aceite-form button{color:#00212B}}
.aceite-form button:disabled{opacity:.5;cursor:not-allowed}
.aceite-form .msg{font-size:.8rem;color:var(--alert);margin:0}
:root{--alert:#DC2626}
@media (prefers-color-scheme:dark){:root{--alert:#F87171}}
section.aceito h2{border-bottom-color:var(--accent)}
section.aceito p strong{color:var(--text)}
@media print{body{background:#fff;font-size:10pt}.wrap{padding:0}.acoes{display:none}
#aceite .aceite-form{display:none}
.sheet{box-shadow:none;border:0;max-width:none}section,.tw{break-inside:avoid}}
`;
