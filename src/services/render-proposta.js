/**
 * Monta o documento da proposta a partir do spec do formulário e do catálogo
 * de blocos. Saída: HTML autocontido — sem CDN, sem fonte externa, com CSS de
 * impressão, pra virar PDF direto do navegador.
 *
 * Por que HTML e não Google Doc (decisão de 18/08/2026): o modelo validado é
 * um documento HTML. Reproduzi-lo pela API do Docs é ordem de grandeza mais
 * trabalho e entrega um resultado visualmente pior que o já aprovado. Se o
 * time exigir arquivo editável depois, o Doc entra como saída adicional — não
 * como caminho.
 *
 * Nada aqui inventa texto. Prosa, especificações e SLA vêm de
 * content/blocos-pt.js; números e escolhas vêm do spec. É o que garante que o
 * documento enviado seja o que a Jessica validou na tela de revisão.
 *
 * A cláusula "Situação apurada" (o diagnóstico do prospect) NÃO é gerada:
 * esse dado ainda não está conectado. Melhor a seção não existir do que sair
 * com número inventado num documento comercial.
 */
import {
    BLOCOS_PT, SLA_GERAL, linhasDaModalidade, prosaDoBloco, contratoTemAtuacao,
} from '../content/blocos-pt.js';
import { CANAIS_OPTION_TO_LABEL, PRODUCT_CASCADE_ORDER, IDIOMAS_COM_BLOCOS, IDIOMA_LABEL } from '../config/proposal.js';

const TZ = 'America/Sao_Paulo';
const VALIDADE_DIAS = 15;

const esc = (s) => String(s ?? '')
    .replace(/&(?!\w+;|#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A prosa do catálogo tem <strong> de propósito — é ênfase editorial, não dado
// de usuário. Escapa tudo e devolve só essa tag.
const rich = (s) => esc(s).replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');

const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function dataBR(d) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** Ordem canônica dos produtos — BB primeiro, igual ao resto do sistema. */
function produtosOrdenados(spec) {
    return PRODUCT_CASCADE_ORDER.filter((c) => (spec.produtos || []).includes(c));
}

function canaisTexto(p) {
    const labels = (p.canais || []).map((id) => CANAIS_OPTION_TO_LABEL[id]).filter(Boolean);
    return labels.length ? labels.join(', ') : null;
}

/**
 * Preenche os marcadores do catálogo com o que veio do formulário.
 * Devolve null quando o marcador não tem valor — a linha inteira some, em vez
 * de sair "Canais: {{CANAIS}}" no documento do cliente.
 */
function valorLinha(valor, p) {
    let v = valor;
    if (v.includes('{{CANAIS}}')) {
        const c = canaisTexto(p);
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

// ─── Cláusulas ──────────────────────────────────────────────────────

function clausulaIdentificacao(ctx) {
    const { deal, spec, meta, codes } = ctx;
    const servicos = codes.map((c) => BLOCOS_PT[c].titulo).join(' · ');
    const marcas = (spec.marcas || []).join(', ');
    return tabela([
        ['Contratante', `<strong>${esc(deal.organizacao)}</strong>`],
        ...(deal.contato ? [['Destinatário', deal.contato]] : []),
        ['Contratada', 'Branddi Tecnologia — São Paulo/SP'],
        ['Marcas monitoradas', marcas],
        ['Serviços', servicos],
        ['Regime', 'Mensal recorrente, sem fidelidade'],
        ['Valor mensal', `<strong>${brl(ctx.total)}</strong> — ver cláusula 4`],
        ['Validade', `${VALIDADE_DIAS} dias corridos, até ${meta.validade}`],
    ]);
}

function clausulaObjetivo(ctx) {
    const { codes, deal } = ctx;
    const itens = codes.map((c) => `<li>${esc(BLOCOS_PT[c].objetivo)}</li>`).join('');
    const plural = codes.length > 1;
    return `<p>O escopo desta proposta responde a ${plural ? 'problemas distintos' : 'um problema'}, que exige${plural ? 'm' : ''} tratamento${plural ? 's' : ''} próprio${plural ? 's' : ''}:</p>
    <ul>${itens}</ul>
    <p>Os serviços descritos a seguir endereçam ${plural ? 'cada um deles' : 'esse ponto'} para a marca ${esc(deal.organizacao)}.</p>`;
}

function clausulaAbordagem(ctx) {
    return ctx.codes.map((code, i) => {
        const b = BLOCOS_PT[code];
        const p = ctx.spec.porProduto[code] || {};
        const mod = b.temModalidade ? (p.modalidade || 'Monitoria + Atuação') : null;
        const badge = mod ? `<span class="mode">${esc(mod)}</span>` : '';
        const linhas = linhasDaModalidade(b.especificacoes, mod)
            .map((l) => [l.rotulo, valorLinha(l.valor, p)])
            .filter(([, v]) => v != null);
        return `<h3><span class="idx">3.${i + 1}</span> ${esc(b.titulo)} ${badge}</h3>
      <p class="fine">${rich(prosaDoBloco(code, mod))}</p>
      ${tabela(linhas)}`;
    }).join('');
}

function clausulaEscopo(ctx) {
    const { codes, spec } = ctx;
    const modalidades = codes.map((c) => {
        const b = BLOCOS_PT[c];
        const p = spec.porProduto[c] || {};
        return [`Modalidade · ${b.titulo}`, b.temModalidade
            ? `<strong>${esc(p.modalidade || 'Monitoria + Atuação')}</strong>`
            : 'Monitoria e inteligência'];
    });

    // SLA: o de cada produto, mais o do contrato inteiro. Sem repetir entregável
    // que dois produtos declaram igual — o cliente não precisa ler duas vezes
    // que recebe relatório semanal.
    const comAtuacao = contratoTemAtuacao(spec.porProduto);
    const modoContrato = comAtuacao ? 'Monitoria + Atuação' : 'Monitoria';
    const vistos = new Set();
    const sla = [
        ...codes.flatMap((c) => {
            const b = BLOCOS_PT[c];
            const mod = b.temModalidade ? (spec.porProduto[c]?.modalidade || 'Monitoria + Atuação') : null;
            return linhasDaModalidade(b.sla, mod);
        }),
        ...linhasDaModalidade(SLA_GERAL, modoContrato),
    ].filter((l) => (vistos.has(l.entregavel) ? false : vistos.add(l.entregavel)));

    return `${tabela([
        ['Marcas monitoradas', (spec.marcas || []).join(', ')],
        ...modalidades,
        ['Idioma dos relatórios', 'Português'],
    ])}
    <h4>Entregáveis</h4>
    <div class="tw"><table>
      <thead><tr><th scope="col">Entregável</th><th scope="col">Periodicidade</th><th scope="col">Canal</th></tr></thead>
      <tbody>${sla.map((l) => `<tr><td>${esc(l.entregavel)}</td><td>${esc(l.periodicidade)}</td><td>${esc(l.canal)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function clausulaInvestimento(ctx) {
    const { codes, spec, soma, total } = ctx;
    const linhas = codes.map((c) => {
        const b = BLOCOS_PT[c];
        const p = spec.porProduto[c] || {};
        const escopo = [canaisTexto(p), Number(p.quantidade) > 0 ? `até ${p.quantidade}` : null]
            .filter(Boolean).join(' · ') || '—';
        // Escada: uma linha por faixa, em vez de preço único. Exceção, não regra.
        if (p.faixas?.length) {
            const faixas = [{ qtd: p.quantidade, preco: p.preco }, ...p.faixas]
                .filter((f) => Number(f.qtd) > 0 && Number(f.preco) > 0)
                .sort((a, b2) => a.qtd - b2.qtd);
            return faixas.map((f, i) => `<tr><td>${i === 0 ? `<strong>${esc(b.titulo)}</strong>` : ''}</td>
        <td>Até ${esc(f.qtd)}</td><td class="n-cell">${brl(f.preco)}</td></tr>`).join('');
        }
        return `<tr><td><strong>${esc(b.titulo)}</strong></td><td>${esc(escopo)}</td>
      <td class="n-cell">${brl(p.preco)}</td></tr>`;
    }).join('');

    // "De / Por" só quando há desconto real. Pacote igual à soma não é desconto,
    // e mostrar as duas linhas iguais só levanta pergunta.
    const temDesconto = total < soma - 0.01;
    const fecho = temDesconto
        ? `<tr class="sub"><td>Subtotal — itens contratados separadamente</td><td></td><td class="n-cell">${brl(soma)}</td></tr>
       <tr class="total"><td>Valor contratado — condição combinada</td><td>Desconto de ${brl(soma - total)}/mês</td><td class="n-cell">${brl(total)}</td></tr>`
        : `<tr class="total"><td>Valor contratado</td><td></td><td class="n-cell">${brl(total)}</td></tr>`;

    return `<div class="tw"><table>
      <thead><tr><th scope="col">Item</th><th scope="col">Escopo</th><th scope="col" style="text-align:right">Mensal</th></tr></thead>
      <tbody>${linhas}${fecho}</tbody></table></div>
    ${tabela([
        ['Setup (implantação)', '01 mensalidade, cobrada uma única vez no início da vigência'],
        ['Impostos', 'Valores líquidos; tributos conforme legislação vigente'],
    ])}`;
}

function clausulaCondicoes(ctx) {
    return tabela([
        ['Condição de pagamento', 'Mensal, D+30 da emissão da nota fiscal'],
        ['Vigência', 'Indeterminada, com <strong>renovação automática</strong>'],
        ['Rescisão', '<strong>Sem fidelidade.</strong> Aviso prévio de 60 dias, sem multa'],
        ['Prazo de implantação', '3 dias úteis a contar do aceite'],
        ['Validade da proposta', `${VALIDADE_DIAS} dias corridos, até ${ctx.meta.validade}`],
    ]);
}

function clausulaLegal() {
    return `<p>A legislação brasileira de propriedade industrial assegura ao titular o direito de impedir o uso não autorizado de marca registrada por terceiros. A atuação prevista nesta proposta se apoia nesse direito e no entendimento consolidado dos tribunais quanto à concorrência desleal.</p>
  <blockquote>Os tribunais brasileiros reconhecem que a utilização de marca registrada de terceiro para desvio de clientela constitui prática de concorrência desleal, podendo gerar a obrigação de abstenção de uso e o dever de indenizar.<cite>Lei 9.279/96, arts. 129 e 195</cite></blockquote>
  <p class="fine">Toda ocorrência tratada gera registro de evidência — captura de tela, data, canal e identificação do infrator — arquivado e disponibilizado à Contratante como subsídio a eventual medida judicial. Requisito: a marca deve possuir registro no INPI de titularidade da Contratante.</p>`;
}

function clausulaAceite(ctx) {
    const { codes, meta } = ctx;
    // O que o cliente precisa mandar depende do que ele contratou: SKU só se
    // tem BBP, safelist só se tem GD. Pedir tudo em toda proposta faz o cliente
    // perguntar por que precisa de algo que não contratou.
    const insumos = [
        codes.includes('BBP') ? 'relação de SKUs prioritários e de sellers autorizados' : null,
        codes.includes('BB') ? 'lista de palavras-chave a monitorar' : null,
        codes.includes('GD') ? 'safelist de domínios e perfis oficiais' : null,
        'comprovante de registro da marca no INPI',
    ].filter(Boolean).join('; ');

    return `<div class="tw"><table>
    <thead><tr><th scope="col">Etapa</th><th scope="col">Responsável</th><th scope="col">Prazo</th></tr></thead>
    <tbody>
      <tr><td>Aceite formal da proposta</td><td>Contratante</td><td>Até ${esc(meta.validade)}</td></tr>
      <tr><td>Envio de ${esc(insumos)}</td><td>Contratante</td><td>D+0</td></tr>
      <tr><td>Configuração de robôs e critérios de triagem</td><td>Branddi</td><td>D+3 úteis</td></tr>
      <tr><td>Primeira entrega de ocorrências</td><td>Branddi</td><td>D+7</td></tr>
      <tr><td>Primeira reunião de acompanhamento</td><td>Ambas</td><td>D+30</td></tr>
    </tbody></table></div>`;
}

// ─── Documento ──────────────────────────────────────────────────────

const CLAUSULAS = [
    ['Identificação', clausulaIdentificacao],
    ['Objetivo do contrato', clausulaObjetivo],
    ['Abordagem', clausulaAbordagem],
    ['Investimento', clausulaInvestimento],
    ['Escopo e níveis de serviço', clausulaEscopo],
    ['Condições comerciais', clausulaCondicoes],
    ['Fundamentação legal', clausulaLegal],
    ['Aceite e implantação', clausulaAceite],
];

/**
 * @param {{deal:{id:number,organizacao:string,contato?:string}, spec:object, emitidaEm?:Date}} args
 * @returns {string} HTML completo
 */
export function renderProposta({ deal, spec, emitidaEm = new Date() }) {
    const codes = produtosOrdenados(spec);
    if (!codes.length) throw new Error('spec sem produtos — nada a renderizar');
    if (!deal?.organizacao) throw new Error('sem organização — o nome vai no corpo da proposta');
    // Barrar aqui, e não só na tela: bloquear no formulário é interface, não
    // garantia. Um POST direto com idioma:'en' sairia em português calado.
    const idioma = spec.idioma || 'pt';
    if (!IDIOMAS_COM_BLOCOS.includes(idioma)) {
        throw new Error(`ainda não existe modelo em ${IDIOMA_LABEL[idioma] || idioma} — a proposta só sai em português por enquanto`);
    }

    const validade = new Date(emitidaEm.getTime() + VALIDADE_DIAS * 86400000);
    const soma = codes.reduce((t, c) => t + (Number(spec.porProduto[c]?.preco) || 0), 0);
    const total = Number(spec.pacote) > 0 ? Number(spec.pacote) : soma;
    const meta = { numero: `PC-${deal.id}`, emissao: dataBR(emitidaEm), validade: dataBR(validade) };
    const ctx = { deal, spec, codes, meta, soma, total };

    const corpo = CLAUSULAS.map(([titulo, fn], i) =>
        `<section><h2><span class="idx">${i + 1}</span> ${esc(titulo)}</h2>${fn(ctx)}</section>`).join('\n');

    const titulo = `${codes.map((c) => BLOCOS_PT[c].titulo).join(' e ')} — ${deal.organizacao}`;

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposta ${esc(deal.organizacao)} — Branddi</title>
<style>${CSS}</style></head><body><div class="wrap"><article class="sheet">
<header class="masthead">
  <div class="logo">Brand<span>di</span></div>
  <div class="ref"><b>${esc(meta.numero)}</b><br>Emissão ${esc(meta.emissao)} · Validade ${esc(meta.validade)}</div>
</header>
<div class="doctitle">
  <p class="kicker">Proposta técnica e comercial</p>
  <h1>${esc(titulo)}</h1>
</div>
<div class="pad">
${corpo}
</div>
<footer class="foot">
  <div><b>Branddi</b> — Combata o uso indevido da sua marca e maximize seus resultados</div>
  <div>${esc(meta.numero)} · válida até ${esc(meta.validade)}</div>
</footer>
</article></div></body></html>`;
}

const CSS = `
:root{--bg:#F1F5F9;--surface:#fff;--surface-2:#F8FAFC;--text:#0F172A;--muted:#475569;--dim:#64748B;
--accent:#0891B2;--turquoise:#0E7490;--rule:#D8E0E8;--rule-soft:#EAEFF4;--petrol:#002B36;
--on-petrol:#fff;--on-petrol-dim:#94A3B8;--logo-accent:#4BBECD;
--shadow:0 1px 2px rgba(15,23,42,.04),0 18px 44px -24px rgba(15,23,42,.2);
--display:"Segoe UI Semibold","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
--sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
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
@media print{body{background:#fff;font-size:10pt}.wrap{padding:0}
.sheet{box-shadow:none;border:0;max-width:none}section,.tw{break-inside:avoid}}
`;
