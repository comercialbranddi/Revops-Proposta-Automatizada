/**
 * Gera os 15 modelos da proposta NOVA, preenchidos, pra alguém do comercial ler
 * e validar o texto.
 *
 * Não confundir com `gera-amostras.js`, que gera pelo caminho ANTIGO (Google
 * Docs, a partir dos 45 modelos pré-montados). Este aqui usa o renderizador de
 * verdade — o mesmo que a proposta do closer usa —, então o que sai na tela é
 * exatamente o que o cliente recebe, com os marcadores já resolvidos.
 *
 * Os dados são fictícios e evidentes ("Marca Exemplo"), e cada arquivo abre com
 * o aviso de amostra no nome. Nada aqui vai pro Drive nem toca no Pipedrive.
 *
 * Uso:
 *   node scripts/gera-modelos.js                  # 15 modelos, Monitoria + Atuação
 *   node scripts/gera-modelos.js --monitoria      # os 15 na modalidade Monitoria
 *   node scripts/gera-modelos.js --html           # só HTML, sem PDF (rápido)
 *   node scripts/gera-modelos.js --idioma=en
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { renderProposta } from '../src/services/render-proposta.js';
import { htmlParaPdf } from '../src/services/pdf.js';
import { PRODUCT_CASCADE_ORDER } from '../src/config/proposal.js';
import { idiomaDaLinhaDeComando } from './_idioma.js';

const IDIOMA = idiomaDaLinhaDeComando();
const SO_MONITORIA = process.argv.includes('--monitoria');
const SO_HTML = process.argv.includes('--html');
const PASTA = `modelos-novos/${IDIOMA}${SO_MONITORIA ? '-monitoria' : ''}`;

// Valores plausíveis, não os reais de nenhum cliente. Escada em BB e BBP porque
// é onde ela mais aparece, e VM com uma faixa só pra mostrar as duas formas.
const CANAIS = { BB: [1592, 1593], BBP: [1596, 1597], GD: [1599, 1600, 1601], VM: [1604] };
const QTD = { BB: 3, BBP: 25, GD: null, VM: 1 };
const PRECO = { BB: 10900, BBP: 10900, GD: 10900, VM: 10900 };
const FAIXAS = {
    BB: [{ qtd: 5, preco: 12900 }, { qtd: 10, preco: 16900 }],
    BBP: [{ qtd: 50, preco: 12900 }, { qtd: 100, preco: 16900 }],
    GD: [],
    VM: [{ qtd: 3, preco: 16900 }],
};

/** As 15 combinações, na ordem canônica dos produtos. */
function combinacoes() {
    const out = [];
    for (let mascara = 1; mascara < 1 << PRODUCT_CASCADE_ORDER.length; mascara++) {
        out.push(PRODUCT_CASCADE_ORDER.filter((_, i) => mascara & (1 << i)));
    }
    // Menos produtos primeiro: quem revisa começa pelos blocos isolados.
    return out.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
}

function specDe(codes) {
    return {
        marcas: ['Marca Exemplo'],
        idioma: IDIOMA,
        produtos: codes,
        pacote: null,
        observacoes: '',
        porProduto: Object.fromEntries(codes.map((c) => [c, {
            // BBP não tem modalidade — quem atua junto aos canais é a Contratante.
            modalidade: c === 'BBP' ? null : (SO_MONITORIA ? 'Monitoria' : 'Monitoria + Atuação'),
            canais: CANAIS[c], quantidade: QTD[c], preco: PRECO[c],
            faixas: FAIXAS[c], sobConsulta: false,
        }])),
    };
}

const DEAL = { id: 0, organizacao: 'Marca Exemplo', contato: 'Contato Exemplo' };

rmSync(PASTA, { recursive: true, force: true });
mkdirSync(PASTA, { recursive: true });

const combos = combinacoes();
console.log(`${combos.length} modelos em ${IDIOMA}${SO_MONITORIA ? ' (Monitoria)' : ''} → ${PASTA}/`);

let n = 0;
for (const codes of combos) {
    n += 1;
    const nome = `${String(n).padStart(2, '0')} AMOSTRA — ${codes.join(' + ')}`;
    // emitidaEm fixo: sem isso, dois runs no mesmo dia geram documentos que
    // divergem só na data e poluem a comparação de quem está revisando.
    const html = renderProposta({ deal: DEAL, spec: specDe(codes), emitidaEm: new Date(2026, 7, 27) });
    writeFileSync(`${PASTA}/${nome}.html`, html);
    if (!SO_HTML) {
        const pdf = await htmlParaPdf(html);
        writeFileSync(`${PASTA}/${nome}.pdf`, pdf);
    }
    console.log(`  ✅ ${nome}`);
}

console.log(`\nPronto. Abra ${PASTA}/ — os HTML são o documento em tela, os PDF são o que vai pro lead.`);
