/**
 * A linha de pagamento do VM tem um vertical tab (U+000B) no meio: é quebra de
 * linha DENTRO do parágrafo, não separador de parágrafos. Precisa sobreviver à
 * tradução, senão as duas linhas viram uma só no documento em inglês.
 */
import fs from 'node:fs';

const VT = String.fromCharCode(11);
const p = new URL('./VM.json', import.meta.url);
const d = JSON.parse(fs.readFileSync(p, 'utf8'));

for (const par of d.pares) {
  if (par.original.startsWith('Condição de pagamento') && !par.traducao) {
    par.traducao = `Payment terms: monthly - D+30 from the invoice issue date${VT}Automatic renewal.`;
  }
}
fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');

const faltam = d.pares.filter((x) => !x.traducao).length;
console.log(`VM: ${d.pares.length - faltam}/${d.pares.length} traduzidos`);
