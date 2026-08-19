/**
 * Gera a tela de revisão do catálogo de blocos, lendo src/content/blocos-pt.js.
 *
 * Existe pra que o texto que a Jessica valida seja o MESMO que o gerador vai
 * usar. Um HTML escrito à mão ao lado do catálogo diverge na primeira correção
 * — e aí ela aprova uma redação que não é a que sai na proposta.
 *
 * Uso: node scripts/revisao-blocos.js > revisao-blocos.html
 */
import { BLOCOS_PT, SLA_GERAL } from '../src/content/blocos-pt.js';
import { linhasDaModalidade, prosaDoBloco } from '../src/content/blocos.js';

const esc = (s) => String(s).replace(/&(?!\w+;|#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');

const MODS = ['Monitoria + Atuação', 'Monitoria'];

/** Rótulos que existem numa modalidade e não na outra — o que a tela destaca. */
function exclusivos(linhas, chave) {
    const a = new Set(linhasDaModalidade(linhas, MODS[0]).map(chave));
    const b = new Set(linhasDaModalidade(linhas, MODS[1]).map(chave));
    return {
        soAmbos: [...a].filter((x) => !b.has(x)),
        soMonitoria: [...b].filter((x) => !a.has(x)),
    };
}

function tabela(linhas, mod, outroSet, chave, valor) {
    const rows = linhasDaModalidade(linhas, mod).map((l) => {
        const nova = !outroSet.has(chave(l));
        return `<tr class="${nova ? 'diff' : ''}"><th scope="row">${esc(chave(l))}</th><td>${esc(valor(l))}</td></tr>`;
    }).join('');
    return `<div class="tw"><table><tbody>${rows}</tbody></table></div>`;
}

function bloco(code, b) {
    if (!b.temModalidade) {
        return `<section><h2>${esc(code)} · ${esc(b.titulo)} <span class="tag single">sem modalidade</span></h2>
      <p class="why">Quem atua no Buy Box é a Contratante — a Branddi entrega inteligência. Não há atuação da Branddi para retirar, então o bloco é único.</p>
      <div class="col single-col">
        <p class="prosa">${esc(b.prosa.unica)}</p>
        ${tabela(b.especificacoes, '—', new Set(b.especificacoes.map((l) => l.rotulo)), (l) => l.rotulo, (l) => l.valor)}
      </div></section>`;
    }

    const exEsp = exclusivos(b.especificacoes, (l) => l.rotulo);
    const exSla = exclusivos(b.sla, (l) => l.entregavel);
    const setAmbosEsp = new Set(linhasDaModalidade(b.especificacoes, MODS[0]).map((l) => l.rotulo));
    const setMonEsp = new Set(linhasDaModalidade(b.especificacoes, MODS[1]).map((l) => l.rotulo));

    const coluna = (mod, outroSet) => `<div class="col">
      <h3>${esc(mod)}</h3>
      <p class="prosa">${esc(prosaDoBloco(BLOCOS_PT, code, mod))}</p>
      <h4>Especificações</h4>
      ${tabela(b.especificacoes, mod, outroSet, (l) => l.rotulo, (l) => l.valor)}
      <h4>Entregáveis</h4>
      <div class="tw"><table><tbody>${linhasDaModalidade(b.sla, mod).map((l) => {
        const nova = !(mod === MODS[0] ? new Set(linhasDaModalidade(b.sla, MODS[1]).map((x) => x.entregavel)) : new Set(linhasDaModalidade(b.sla, MODS[0]).map((x) => x.entregavel))).has(l.entregavel);
        return `<tr class="${nova ? 'diff' : ''}"><th scope="row">${esc(l.entregavel)}</th><td>${esc(l.periodicidade)} · ${esc(l.canal)}</td></tr>`;
    }).join('')}</tbody></table></div>
    </div>`;

    const resumo = [
        exEsp.soAmbos.length ? `sai <b>${exEsp.soAmbos.join('</b>, <b>')}</b>` : null,
        exEsp.soMonitoria.length ? `entra <b>${exEsp.soMonitoria.join('</b>, <b>')}</b>` : null,
        exSla.soAmbos.length ? `sai do SLA <b>${exSla.soAmbos.join('</b>, <b>')}</b>` : null,
    ].filter(Boolean).join(' · ');

    return `<section><h2>${esc(code)} · ${esc(b.titulo)}</h2>
    <p class="why">Ao trocar para Monitoria: ${resumo}.</p>
    <div class="duo">${coluna(MODS[0], setMonEsp)}${coluna(MODS[1], setAmbosEsp)}</div></section>`;
}

const geral = `<section><h2>Linhas do contrato inteiro</h2>
  <p class="why">Valem para a proposta, não para um produto. <b>Limite de denúncias</b> só aparece se ALGUM produto estiver em atuação — num contrato só de monitoria, a linha prometeria limite para algo que a Branddi não faz.</p>
  <div class="duo">${MODS.map((mod) => `<div class="col"><h3>${esc(mod)}</h3>
    <div class="tw"><table><tbody>${linhasDaModalidade(SLA_GERAL, mod).map((l) => {
    const nova = mod === MODS[0] && l.so === 'ambos';
    return `<tr class="${nova ? 'diff' : ''}"><th scope="row">${esc(l.entregavel)}</th><td>${esc(l.periodicidade)} · ${esc(l.canal)}</td></tr>`;
}).join('')}</tbody></table></div></div>`).join('')}</div></section>`;

process.stdout.write(`<title>Blocos da Proposta</title>
<style>
  :root{--bg:#F1F5F9;--surface:#fff;--surface-2:#F8FAFC;--text:#0F172A;--muted:#475569;--dim:#64748B;
    --accent:#0891B2;--rule:#D8E0E8;--rule-soft:#EAEFF4;--diff:#0E7490;--petrol:#002B36;--on-petrol:#fff;
    --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
    --mono:"Cascadia Mono",Consolas,ui-monospace,monospace;}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#001721;--surface:#002B36;
    --surface-2:#00323F;--text:#fff;--muted:#B6C2CF;--dim:#8A97A6;--accent:#00E5FF;--rule:#004052;
    --rule-soft:#00323F;--diff:#4BBECD;}}
  :root[data-theme="dark"]{--bg:#001721;--surface:#002B36;--surface-2:#00323F;--text:#fff;--muted:#B6C2CF;
    --dim:#8A97A6;--accent:#00E5FF;--rule:#004052;--rule-soft:#00323F;--diff:#4BBECD;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--muted);font:14.5px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
  header{background:var(--petrol);color:var(--on-petrol);padding:1.1rem clamp(1rem,4vw,2.5rem)}
  header h1{margin:0;font-size:1.1rem;font-weight:700}
  header p{margin:.35rem 0 0;font-family:var(--mono);font-size:.7rem;color:#94A3B8;max-width:80ch;line-height:1.6}
  main{max-width:68rem;margin:0 auto;padding:1.25rem clamp(.7rem,3vw,1.5rem) 4rem;display:flex;flex-direction:column;gap:1.1rem}
  section{background:var(--surface);border:1px solid var(--rule);border-radius:4px;padding:1rem clamp(.9rem,2.5vw,1.4rem) 1.3rem}
  h2{font-size:1rem;color:var(--text);font-weight:700;margin:0 0 .4rem;padding-bottom:.45rem;border-bottom:1.5px solid var(--accent)}
  .tag{font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);
    border:1px solid var(--rule);border-radius:2px;padding:.1rem .35rem;font-weight:700;vertical-align:middle}
  .why{margin:0 0 .9rem;font-size:.83rem;color:var(--dim)}
  .why b{color:var(--diff);font-weight:600}
  .duo{display:grid;grid-template-columns:repeat(auto-fit,minmax(19rem,1fr));gap:1.1rem}
  .col{min-width:0;display:flex;flex-direction:column;gap:.5rem}
  .single-col{max-width:44rem}
  h3{margin:0;font-family:var(--mono);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;
    color:var(--accent);font-weight:700}
  h4{margin:.5rem 0 -.15rem;font-family:var(--mono);font-size:.6rem;letter-spacing:.12em;
    text-transform:uppercase;color:var(--dim);font-weight:700}
  .prosa{margin:0;font-size:.85rem;line-height:1.6}
  .prosa strong,td strong{color:var(--text);font-weight:600}
  .tw{overflow-x:auto;border:1px solid var(--rule);border-radius:3px}
  table{border-collapse:collapse;width:100%;font-size:.79rem}
  th,td{text-align:left;padding:.4rem .65rem;border-bottom:1px solid var(--rule-soft);vertical-align:top}
  tbody tr:last-child>*{border-bottom:0}
  th[scope=row]{font-family:var(--mono);font-size:.66rem;color:var(--dim);font-weight:400;width:9.5rem;white-space:nowrap}
  tr.diff th[scope=row]{color:var(--diff);font-weight:700}
  tr.diff>*{background:color-mix(in srgb,var(--diff) 9%,transparent)}
  @media print{body{background:#fff}section{break-inside:avoid}}
</style>
<header>
  <h1>Catálogo de blocos da proposta</h1>
  <p>Gerado de src/content/blocos-pt.js — é o texto que o gerador vai usar, não uma amostra. Linhas destacadas existem só naquela modalidade.</p>
</header>
<main>
${Object.entries(BLOCOS_PT).map(([c, b]) => bloco(c, b)).join('\n')}
${geral}
</main>
`);
