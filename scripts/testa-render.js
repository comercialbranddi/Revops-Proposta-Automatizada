/**
 * Bateria do renderizador — confere o CONTEÚDO, não só se gerou.
 *
 * "Gerou sem erro" não prova nada: um documento pode sair completo e mentir.
 * Os casos abaixo cobrem o que dá errado calado — produto que vaza numa
 * proposta que não o contratou, linha de atuação numa venda de monitoria,
 * placeholder não substituído, marca com HTML dentro, escada fora de ordem.
 *
 * Uso: node scripts/testa-render.js
 * Sai com código 1 se qualquer caso falhar — serve de porta pra deploy.
 */
import { renderProposta } from '../src/services/render-proposta.js';
import { BLOCOS_PT } from '../src/content/blocos-pt.js';
import { catalogoDoIdioma } from '../src/content/blocos.js';

const CANAIS = { BB: [1592, 1593], BBP: [1598], GD: [1599, 1600, 1601], VM: [1604] };
const QTD = { BB: 3, BBP: 25, GD: null, VM: 3 };
const APP_STORE = 1609;

/** Um produto com valores plausíveis, pra cada caso só mexer no que interessa. */
function prod(code, extra = {}) {
    return {
        modalidade: BLOCOS_PT[code].temModalidade ? 'Monitoria + Atuação' : null,
        canais: CANAIS[code], quantidade: QTD[code], preco: 8900,
        faixas: [], sobConsulta: false, ...extra,
    };
}

function spec(codes, extra = {}, porProdutoExtra = {}) {
    return {
        marcas: ['Marca Teste'], idioma: 'pt', produtos: codes, pacote: null, observacoes: '',
        porProduto: Object.fromEntries(codes.map((c) => [c, prod(c, porProdutoExtra[c] || {})])),
        ...extra,
    };
}

const DEAL = { id: 60956, organizacao: 'Marca Teste', contato: 'Contato Teste' };

// ─── Asserções ──────────────────────────────────────────────────────
const contem = (t) => (h) => h.includes(t) || `não achei "${t}"`;
const naoContem = (t) => (h) => !h.includes(t) || `achei "${t}" e não devia estar aqui`;
const conta = (t, n) => (h) => {
    const c = (h.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    return c === n || `"${t}" apareceu ${c}x, esperava ${n}x`;
};
const semPlaceholder = (h) => !/\{\{/.test(h) || 'sobrou placeholder {{...}}';
const ordemDe = (...partes) => (h) => {
    let pos = -1;
    for (const p of partes) {
        const i = h.indexOf(p);
        if (i < 0) return `não achei "${p}"`;
        if (i < pos) return `"${p}" apareceu fora de ordem`;
        pos = i;
    }
    return true;
};
/** Nenhum produto não contratado aparece — o vazamento mais caro possível. */
const semVazamento = (codes) => (h) => {
    const fora = Object.keys(BLOCOS_PT).filter((c) => !codes.includes(c));
    for (const c of fora) {
        if (h.includes(BLOCOS_PT[c].titulo)) return `vazou o bloco de ${c} ("${BLOCOS_PT[c].titulo}")`;
    }
    return true;
};

// ─── Casos ──────────────────────────────────────────────────────────
const CASOS = [
    {
        nome: 'BB sozinho, com atuação',
        spec: spec(['BB']),
        checa: [semPlaceholder, semVazamento(['BB']), contem('Brand Bidding'),
            contem('Aprovação'), contem('Limite de denúncias'), naoContem('Entrega de evidências'),
            contem('Google Search Ads'), contem('Até 3'),
            contem('lista de palavras-chave a monitorar')],
    },
    {
        nome: 'BB sozinho, só monitoria',
        spec: spec(['BB'], {}, { BB: { modalidade: 'Monitoria' } }),
        checa: [semPlaceholder, contem('Entrega de evidências'),
            naoContem('Aprovação'), naoContem('Limite de denúncias'),
            contem('não notifica anunciantes')],
    },
    {
        nome: 'BBP sozinho — não tem modalidade',
        spec: spec(['BBP']),
        checa: [semPlaceholder, semVazamento(['BBP']), contem('Monitoria e inteligência'),  // agora vem como selo ao lado do título
            contem('atuação comercial junto aos canais é conduzida pela Contratante'),
            naoContem('Aprovação'), contem('Até 25 SKUs'),
            contem('relação de SKUs prioritários')],
    },
    {
        nome: 'GD sozinho — não tem quantidade',
        spec: spec(['GD']),
        checa: [semPlaceholder, semVazamento(['GD']), contem('Golpes Digitais'),
            contem('2.800 registradores'), contem('safelist de domínios'),
            naoContem('{{QUANTIDADE}}')],
    },
    {
        nome: 'VM sozinho, só monitoria',
        spec: spec(['VM'], {}, { VM: { modalidade: 'Monitoria' } }),
        checa: [semPlaceholder, contem('Entrega de evidências'), naoContem('Aprovação'),
            contem('Até 3 marketplaces')],
    },
    {
        nome: 'os quatro juntos, modalidades misturadas',
        spec: spec(['BB', 'BBP', 'GD', 'VM'], {}, {
            BB: { modalidade: 'Monitoria' }, GD: { modalidade: 'Monitoria + Atuação' }, VM: { modalidade: 'Monitoria' },
        }),
        // Um produto em atuação basta pra manter a linha geral de limite.
        checa: [semPlaceholder, contem('Brand Bidding'), contem('Buy Box Protection'),
            contem('Golpes Digitais'), contem('Violação de Propriedade Intelectual'),
            contem('Limite de denúncias'),
            // ordem canônica: BB, BBP, GD, VM
            ordemDe('3.1</span> Brand Bidding', '3.2</span> Buy Box Protection',
                '3.3</span> Golpes Digitais', '3.4</span> Violação de Propriedade Intelectual')],
    },
    {
        nome: 'todos em monitoria — limite de denúncias tem que sair',
        spec: spec(['BB', 'GD', 'VM'], {}, {
            BB: { modalidade: 'Monitoria' }, GD: { modalidade: 'Monitoria' }, VM: { modalidade: 'Monitoria' },
        }),
        checa: [semPlaceholder, naoContem('Limite de denúncias'), naoContem('Aprovação')],
    },
    {
        nome: 'BBP em monitoria não conta como atuação do contrato',
        spec: spec(['BBP', 'VM'], {}, { VM: { modalidade: 'Monitoria' } }),
        checa: [semPlaceholder, naoContem('Limite de denúncias')],
    },
    {
        nome: 'sem canal marcado — a linha some, não sai vazia',
        spec: spec(['BB'], {}, { BB: { canais: [] } }),
        checa: [semPlaceholder, naoContem('Google Search Ads'),
            (h) => !/<th scope="row">Canais<\/th>/.test(h) || 'linha "Canais" ficou no documento sem valor'],
    },
    {
        nome: 'BB só em App Store — sem linha de palavras-chave',
        spec: spec(['BB'], {}, { BB: { canais: [APP_STORE], quantidade: null } }),
        checa: [semPlaceholder, contem('App Store'), naoContem('Palavras-chave')],
    },
    {
        nome: 'escada de BB — uma linha por faixa, em ordem',
        spec: spec(['BB'], {}, { BB: { quantidade: 10, preco: 24900, faixas: [{ qtd: 30, preco: 42900 }, { qtd: 20, preco: 34900 }] } }),
        checa: [semPlaceholder, ordemDe('Até 10', 'Até 20', 'Até 30'),
            contem('R$ 24.900,00'), contem('R$ 34.900,00'), contem('R$ 42.900,00')],
    },
    {
        nome: 'escada de BBP com Sob Consulta marcado',
        spec: spec(['BBP'], {}, { BBP: { quantidade: 50, preco: 8900, faixas: [{ qtd: 100, preco: 12900 }], sobConsulta: true } }),
        checa: [semPlaceholder, ordemDe('Até 50', 'Até 100')],
    },
    {
        nome: 'pacote com desconto — De/Por aparece',
        spec: spec(['BB', 'VM'], { pacote: 15000 }),
        checa: [semPlaceholder, contem('Subtotal'), contem('condição combinada'),
            contem('R$ 17.800,00'), contem('R$ 15.000,00'), contem('Desconto de R$ 2.800,00')],
    },
    {
        nome: 'pacote igual à soma — sem linha de desconto',
        spec: spec(['BB', 'VM'], { pacote: 17800 }),
        checa: [semPlaceholder, naoContem('Subtotal'), naoContem('Desconto de')],
    },
    {
        nome: 'sem pacote — total é a soma',
        spec: spec(['BB', 'VM']),
        checa: [semPlaceholder, naoContem('Subtotal'), contem('R$ 17.800,00')],
    },
    {
        nome: 'várias marcas — todas aparecem',
        spec: spec(['BB'], { marcas: ['Elsys', 'Elsys Home', 'Elsys Pro'] }),
        checa: [semPlaceholder, contem('Elsys, Elsys Home, Elsys Pro')],
    },
    {
        nome: 'marca com HTML dentro — tem que sair escapado',
        spec: spec(['BB'], { marcas: ['<script>alert(1)</script>', 'Marca & Cia'] }),
        checa: [naoContem('<script>alert'), contem('&lt;script&gt;'), contem('Marca &amp; Cia')],
    },
    {
        nome: 'entregável declarado por dois produtos aparece uma vez',
        spec: spec(['BBP', 'VM']),
        checa: [conta('Relatório de status das ocorrências', 1)],
    },
    {
        nome: 'insumos do aceite seguem o que foi contratado',
        spec: spec(['GD']),
        checa: [contem('safelist de domínios'), naoContem('SKUs prioritários'),
            naoContem('palavras-chave a monitorar')],
    },
];

// Estes precisam de slug/substituida, que os demais não usam.
const CASOS_VERSAO = [
    {
        nome: 'versão atual oferece aceite e não avisa nada',
        args: { slug: 'atual1' },
        checa: [naoContem('foi substituída'), contem('Aceitar proposta')],
    },
    {
        nome: 'versão substituída avisa, aponta pra atual e não deixa aceitar',
        args: { slug: 'velha1', substituida: { revisao: 4, slug: 'novoSlug' } },
        checa: [contem('Esta versão foi substituída'), contem('/p/novoSlug'),
            contem('revisão 4'), naoContem('Aceitar proposta')],
    },
    {
        nome: 'substituída E vencida — o aviso da versão nova é o que importa',
        args: { slug: 'velha2', substituida: { revisao: 2, slug: 'x' }, emitidaEm: new Date('2026-01-01') },
        checa: [contem('foi substituída'), naoContem('venceu em')],
    },
    {
        nome: 'já aceita continua mostrando quem aceitou',
        args: { slug: 'a1', aceite: { quando: '2026-08-18T18:00:00Z', nome: 'Fulano', email: 'f@x.com', cargo: 'Diretor' } },
        checa: [contem('Fulano'), contem('Diretor'), naoContem('Aceitar proposta')],
    },
    {
        nome: 'preview sem link não oferece aceite a ninguém',
        args: {},
        checa: [naoContem('Aceitar proposta'), naoContem('Proposta aceita')],
    },
];

const CASOS_NOVOS = [
    {
        nome: 'canais digitados entram junto dos do catálogo',
        args: {},
        spec: spec(['BBP'], {}, { BBP: { canaisOutros: ['Shopee', 'Magalu'] } }),
        checa: [contem('Marketplaces, Shopee, Magalu')],
    },
    {
        nome: 'só canais digitados, sem nenhum do catálogo',
        args: {},
        spec: spec(['BBP'], {}, { BBP: { canais: [], canaisOutros: ['TikTok Shop'] } }),
        checa: [contem('TikTok Shop'), semPlaceholder],
    },
    {
        nome: 'canal digitado com HTML sai escapado',
        args: {},
        spec: spec(['BBP'], {}, { BBP: { canaisOutros: ['<b>Shopee</b>'] } }),
        checa: [naoContem('<b>Shopee</b>'), contem('&lt;b&gt;Shopee')],
    },
    {
        nome: 'condição negociada substitui a padrão',
        args: {},
        spec: spec(['BB'], { condicoes: { rescisao: 'Fidelidade de 12 meses, multa de 3 mensalidades' } }),
        checa: [contem('Fidelidade de 12 meses'), naoContem('Sem fidelidade')],
    },
    {
        nome: 'condição não tocada continua sendo a padrão',
        args: {},
        spec: spec(['BB'], { condicoes: { pagamento: 'Trimestral, antecipado' } }),
        checa: [contem('Trimestral, antecipado'), contem('Sem fidelidade'),
            contem('3 dias úteis a contar do aceite')],
    },
    {
        nome: 'condição em branco não apaga a cláusula',
        args: {},
        spec: spec(['BB'], { condicoes: { rescisao: '   ', vigencia: '' } }),
        checa: [contem('Sem fidelidade'), contem('renovação automática')],
    },
    {
        // A Branddi não cobra setup (19/08/2026). Os modelos-base diziam
        // "01 mensalidade" e a proposta enviada trazia riscado — o padrão
        // estava cobrando o que ninguém cobra.
        nome: 'setup sai bonificado por padrão, não cobrado',
        args: {},
        spec: spec(['BB']),
        checa: [contem('Bonificado'), naoContem('cobrada uma única vez')],
    },
    {
        nome: 'setup segue negociável, se um dia for cobrado',
        args: {},
        spec: spec(['BB'], { condicoes: { setup: '01 mensalidade, cobrada no início' } }),
        checa: [contem('01 mensalidade, cobrada no início'), naoContem('Bonificado')],
    },
    {
        nome: 'o que saiu do modelo não volta',
        args: {},
        spec: spec(['BBP', 'BB']),
        // cláusula legal removida a pedido; requisito do INPI ficou, virou escopo
        checa: [naoContem('Lei 9.279'), naoContem('Fundamentação legal'),
            contem('registro no INPI'),
            // a linha "Suporte" do BBP descrevia o COMO da entrega
            naoContem('cruzamento com bases'), naoContem('apoio à atuação comercial junto aos canais')],
    },
    {
        nome: 'a fonte da proposta é Montserrat',
        args: { slug: 'x' },
        spec: spec(['BB']),
        checa: [contem('family=Montserrat'), contem('"Montserrat"')],
    },
];

const ERROS = [
    // 'fr' não tem catálogo. Antes este caso usava 'en', que passou a ter.
    { nome: 'idioma sem catálogo é recusado', spec: spec(['BB'], { idioma: 'fr' }), esperado: /não existe modelo/ },
    { nome: 'spec sem produto é recusado', spec: spec([]), esperado: /sem produtos/ },
    { nome: 'negócio sem organização é recusado', spec: spec(['BB']), deal: { id: 1 }, esperado: /sem organiza/ },
];

// ─── Idiomas ────────────────────────────────────────────────────────
// Ortografia que só existe em português. Serve pra pegar o defeito que a
// auditoria de 11/08/2026 achou nos documentos antigos: português vazando no
// meio do inglês ("Google + Meta (Facebook e Instagram) + TLD's (Dominios)").
// "São Paulo" é nome próprio e sai da conta antes.
const SO_PORTUGUES = new RegExp(['ção', 'ções', 'não', 'ência', 'Entregável',
    'Aprovação', 'Validade', 'Atuação', 'Monitoria'].join('|'));

const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

const IDIOMAS = [
    {
        idioma: 'en',
        checa: [
            contem('Technical and commercial proposal'), contem('Identification'),
            contem('Purpose of the agreement'), contem('Commercial terms'), naoContem('Legal basis'), contem('Requirement'),
            contem('Client'), contem('Deliverable'), contem('Monitoring + Enforcement'),
            contem('No minimum term'), contem('Accept proposal'), contem('Download PDF'),
            contem('Waived'), naoContem('charged once'),
            // A data em inglês sai com o mês escrito: "08/18" e "18/08" são a
            // mesma string com sentidos diferentes.
            (h) => MESES_EN.some((m) => h.includes(m))
                || 'data em inglês devia trazer o mês escrito',
            // Condição que os documentos antigos em inglês vendiam e que NÃO
            // deve ter sido herdada.
            naoContem('annual'), naoContem('12 months'),
        ],
    },
    {
        idioma: 'es',
        checa: [
            contem('Propuesta técnica y comercial'), contem('Identificación'),
            contem('Objeto del contrato'), contem('Condiciones comerciales'), naoContem('Fundamento legal'), contem('Requisito'),
            contem('Entregable'), contem('Monitoreo + Actuación'), contem('Sin permanencia'),
            contem('Aceptar propuesta'), contem('Descargar en PDF'),
            contem('Bonificado'), naoContem('cobrada una única vez'),
            // O defeito real do espanhol antigo: "para cancelamento sem multa"
            // embutido no meio da cláusula de contrato.
            naoContem('cancelamento'), naoContem('sem multa'),
        ],
    },
];

/**
 * Os três catálogos precisam ter a MESMA forma. Idioma que esquece uma linha
 * gera proposta que promete menos que a portuguesa — e ninguém percebe, porque
 * o documento sai bonito.
 */
function mesmaForma() {
    const problemas = [];
    const cats = ['pt', 'en', 'es'].map((i) => [i, catalogoDoIdioma(i)]);
    const [, base] = cats[0];
    for (const [idioma, c] of cats.slice(1)) {
        const pk = Object.keys(base.blocos).sort().join(',');
        const ck = Object.keys(c.blocos).sort().join(',');
        if (pk !== ck) problemas.push(`${idioma}: produtos diferentes (${ck} vs ${pk})`);
        for (const code of Object.keys(base.blocos)) {
            const a = base.blocos[code]; const b = c.blocos[code];
            if (!b) continue;
            if (a.temModalidade !== b.temModalidade) problemas.push(`${idioma}/${code}: temModalidade divergente`);
            const marca = (arr) => arr.map((l) => l.so || '-').join('|');
            if (marca(a.especificacoes) !== marca(b.especificacoes)) {
                problemas.push(`${idioma}/${code}: especificações com ${b.especificacoes.length} linhas (pt tem ${a.especificacoes.length}) ou marcação "so" diferente`);
            }
            if (marca(a.sla) !== marca(b.sla)) problemas.push(`${idioma}/${code}: SLA divergente`);
            if (!b.objetivo) problemas.push(`${idioma}/${code}: sem objetivo`);
        }
        if (base.slaGeral.map((l) => l.so || '-').join('|') !== c.slaGeral.map((l) => l.so || '-').join('|')) {
            problemas.push(`${idioma}: SLA geral divergente`);
        }
        for (const k of Object.keys(base.insumos)) {
            if (!c.insumos[k]) problemas.push(`${idioma}: insumo de ${k} faltando`);
        }
    }
    return problemas;
}

// ─── Execução ───────────────────────────────────────────────────────
let ok = 0; const falhas = [];

for (const caso of CASOS) {
    let html;
    try { html = renderProposta({ deal: DEAL, spec: caso.spec }); }
    catch (e) { falhas.push([caso.nome, `estourou: ${e.message}`]); continue; }
    const erros = caso.checa.map((f) => f(html)).filter((r) => r !== true);
    if (erros.length) falhas.push([caso.nome, erros.join(' | ')]);
    else { ok++; console.log(`✅ ${caso.nome}`); }
}

for (const caso of CASOS_VERSAO) {
    let html;
    try { html = renderProposta({ deal: DEAL, spec: spec(['BB']), ...caso.args }); }
    catch (e) { falhas.push([caso.nome, `estourou: ${e.message}`]); continue; }
    const erros = caso.checa.map((f) => f(html)).filter((r) => r !== true);
    if (erros.length) falhas.push([caso.nome, erros.join(' | ')]);
    else { ok++; console.log(`✅ ${caso.nome}`); }
}

for (const caso of CASOS_NOVOS) {
    let html;
    try { html = renderProposta({ deal: DEAL, spec: caso.spec, ...caso.args }); }
    catch (e) { falhas.push([caso.nome, `estourou: ${e.message}`]); continue; }
    const erros = caso.checa.map((f) => f(html)).filter((r) => r !== true);
    if (erros.length) falhas.push([caso.nome, erros.join(' | ')]);
    else { ok++; console.log(`✅ ${caso.nome}`); }
}

for (const { idioma, checa } of IDIOMAS) {
    const nome = `documento em ${idioma}`;
    let html;
    try { html = renderProposta({ deal: DEAL, spec: spec(['BB', 'BBP', 'GD', 'VM'], { idioma }), slug: 'x' }); }
    catch (e) { falhas.push([nome, `estourou: ${e.message}`]); continue; }
    const erros = checa.map((f) => f(html)).filter((r) => r !== true);
    // O vazamento de português é conferido no documento inteiro, sem "São Paulo".
    const limpo = html.replace(/São Paulo/g, '');
    const vaza = limpo.match(SO_PORTUGUES);
    if (vaza) erros.push(`português vazando: "${vaza[0]}"`);
    // A moeda fica em real nos três idiomas — decisão comercial aberta.
    if (!html.includes('R$')) erros.push('a moeda devia seguir em real');
    if (erros.length) falhas.push([nome, erros.join(' | ')]);
    else { ok++; console.log(`✅ ${nome}`); }
}

const pForma = mesmaForma();
if (pForma.length) falhas.push(['os três catálogos têm a mesma forma', pForma.join(' | ')]);
else { ok++; console.log('✅ os três catálogos têm a mesma forma'); }

for (const caso of ERROS) {
    try {
        renderProposta({ deal: caso.deal || DEAL, spec: caso.spec });
        falhas.push([caso.nome, 'gerou quando devia recusar']);
    } catch (e) {
        if (caso.esperado.test(e.message)) { ok++; console.log(`✅ ${caso.nome}`); }
        else falhas.push([caso.nome, `recusou com a mensagem errada: ${e.message}`]);
    }
}

console.log('');
if (falhas.length) {
    console.log(`❌ ${falhas.length} caso(s) falharam:`);
    falhas.forEach(([n, e]) => console.log(`   ${n}\n      ${e}`));
    process.exit(1);
}
console.log(`✅ ${ok} casos, todos passaram`);
