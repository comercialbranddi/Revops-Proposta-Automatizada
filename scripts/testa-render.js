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
import { alturaDeBalanco } from '../src/services/pdf.js';

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
// {{...}} é marcador de valor; [[um|muitos]] é marcador de plural. Os dois têm
// que sumir na geração — um marcador vazando é texto de gente de dentro no
// documento que vai pro cliente.
const semPlaceholder = (h) => (!/\{\{/.test(h) && !/\[\[/.test(h)) || 'sobrou marcador ({{...}} ou [[...]])';
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
/**
 * A capa e a nota-insight não podem prometer atuação.
 *
 * As duas são copy sem fonte em modelo antigo, e nenhuma das duas olha a
 * modalidade: numa venda só de monitoria, elas contradiziam o corpo do próprio
 * documento, que diz que a Branddi não notifica nem denuncia. Confere SÓ esses
 * dois elementos, e não o documento inteiro — "takedown request" é a tradução
 * corrente de "denúncia" e aparece de forma legítima no corpo em inglês,
 * inclusive na frase que diz que a Branddi NÃO faz.
 */
const capaSemPromessa = (h) => {
    const hero = (h.match(/<p class="herosub">([^<]*)<\/p>/) || [])[1] || '';
    const nota = (h.match(/note-ic">i<\/span><p>([\s\S]*?)<\/p>/) || [])[1] || '';
    const promessa = /takedown|remo[çc][ãa]o|removal|remoci[óo]n|remove |removes |elimina /i;
    const achou = [hero, nota].find((t) => promessa.test(t));
    return !achou || `capa ou nota prometem atuação: "${achou.slice(0, 90)}"`;
};

/**
 * A capa não carrega número de proposta nem nome de pessoa.
 *
 * Os dois saíram em 27/08/2026: o "PC-<id do card>" é numeração interna que não
 * diz nada ao cliente e ainda entrega o tamanho da base, e o destinatário
 * pessoal não cabe num documento entre empresas — quem assina pode não ser quem
 * recebeu o e-mail. Ambos vinham de dado do card, então voltariam calados na
 * primeira mexida no cabeçalho.
 */
const capaSemIdInterno = (h) => {
    const achados = [];
    if (/PC-\d+/.test(h)) achados.push('número de proposta');
    if (/Destinat|Attention|Destinatario/.test(h)) achados.push('linha de destinatário');
    if (/Contato Teste/.test(h)) achados.push('nome do contato');
    return !achados.length || `capa traz ${achados.join(' e ')}`;
};

/**
 * Em combo, o hero é frase curta — não a soma dos nomes dos produtos.
 *
 * Somar dava "Brand Bidding + Buy Box Protection + Golpes Digitais + Violação
 * de Propriedade Intelectual para <cliente>": quatro linhas de título que
 * ninguém lê. Os nomes continuam na capa, na linha de serviços, e na cláusula 1
 * — o que esta checagem garante é que o hero não volte a ser a lista.
 */
const heroDeCombo = (codes) => (h) => {
    const hero = (h.match(/<span class="l1">([^<]*)<\/span>/) || [])[1] || '';
    const serv = (h.match(/<p class="heroserv">([^<]*)<\/p>/) || [])[1] || '';
    if (codes.length === 1) return !serv || 'produto único não devia ter linha de serviços';
    if (hero.includes('+')) return `hero de combo ainda soma nomes: "${hero}"`;
    if (!/frentes|fronts/.test(hero)) return `hero de combo sem a frase curta: "${hero}"`;
    const faltando = codes.filter((c) => !serv.includes(TITULOS[c]));
    return !faltando.length || `linha de serviços sem ${faltando.join(', ')}`;
};

/** Nenhum produto não contratado aparece — o vazamento mais caro possível. */
const semVazamento = (codes) => (h) => {
    const fora = Object.keys(BLOCOS_PT).filter((c) => !codes.includes(c));
    for (const c of fora) {
        if (h.includes(BLOCOS_PT[c].titulo)) return `vazou o bloco de ${c} ("${BLOCOS_PT[c].titulo}")`;
    }
    return true;
};

const TITULOS = Object.fromEntries(Object.entries(BLOCOS_PT).map(([c, b]) => [c, b.titulo]));

// ─── Casos ──────────────────────────────────────────────────────────
const CASOS = [
    {
        nome: 'BB sozinho, com atuação',
        spec: spec(['BB']),
        checa: [semPlaceholder, semVazamento(['BB']), contem('Brand Bidding'),
            capaSemIdInterno, heroDeCombo(['BB']),
            contem('Aprovação'), contem('Limite de atuações'), naoContem('Entrega de evidências'),
            contem('Google Search Ads'), contem('Até 3'),
            contem('lista de palavras-chave a monitorar')],
    },
    {
        nome: 'BB sozinho, só monitoria',
        spec: spec(['BB'], {}, { BB: { modalidade: 'Monitoria' } }),
        checa: [semPlaceholder, contem('Entrega de evidências'),
            naoContem('Aprovação'), naoContem('Limite de atuações'),
            contem('não notifica anunciantes')],
    },
    {
        nome: 'BBP sozinho — não tem modalidade',
        spec: spec(['BBP']),
        checa: [semPlaceholder, semVazamento(['BBP']), contem('Monitoria e inteligência'),  // agora vem como selo ao lado do título
            contem('atuação comercial junto aos canais é conduzida pela Contratante'),
            naoContem('Aprovação'), contem('Até 25 SKUs'),
            contem('relação de SKUs prioritários'),
            // BBP puro disputa Buy Box, não marca: o requisito do INPI e o
            // comprovante no aceite não saem — o modelo antigo não os pedia.
            naoContem('INPI')],
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
            contem('Limite de atuações'),
            // ordem canônica: BB, BBP, GD, VM
            ordemDe('3.1</span> Brand Bidding', '3.2</span> Buy Box Protection',
                '3.3</span> Golpes Digitais', '3.4</span> Violação de Propriedade Intelectual')],
    },
    {
        nome: 'todos em monitoria — limite de denúncias tem que sair',
        spec: spec(['BB', 'GD', 'VM'], {}, {
            BB: { modalidade: 'Monitoria' }, GD: { modalidade: 'Monitoria' }, VM: { modalidade: 'Monitoria' },
        }),
        checa: [semPlaceholder, naoContem('Limite de atuações'), naoContem('Aprovação')],
    },
    {
        nome: 'BBP em monitoria não conta como atuação do contrato',
        spec: spec(['BBP', 'VM'], {}, { VM: { modalidade: 'Monitoria' } }),
        checa: [semPlaceholder, naoContem('Limite de atuações')],
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
            contem('R$ 24.900,00'), contem('R$ 34.900,00'), contem('R$ 42.900,00'),
            // Um grupo por produto: é ele que segura as faixas juntas e dá o
            // respiro antes do próximo produto.
            conta('<div class="igroup">', 1)],
    },
    {
        // Até 27/08/2026 os canais só saíam nos produtos SEM escada: o escopo
        // composto era montado e descartado no ramo das faixas. Quem comprava
        // Brand Bidding com escada não via em que canais era monitorado.
        nome: 'produto com escada mostra os canais na tabela de valores',
        spec: spec(['BB'], {}, { BB: { quantidade: 10, preco: 24900, faixas: [{ qtd: 20, preco: 34900 }] } }),
        checa: [semPlaceholder,
            (h) => /<span class="i-canais">[^<]*Google Search Ads/.test(h) || 'canais não saíram sob o nome do produto',
            // Uma vez por produto, não uma por faixa.
            conta('class="i-canais"', 1)],
    },
    {
        nome: 'cada produto é um grupo na tabela, canais uma vez cada',
        spec: spec(['BB', 'BBP', 'GD', 'VM']),
        checa: [semPlaceholder, conta('<div class="igroup">', 4), conta('class="i-canais"', 4),
            capaSemIdInterno, heroDeCombo(['BB', 'BBP', 'GD', 'VM'])],
    },
    {
        nome: 'produto sem canal não deixa a linha de canais vazia',
        spec: spec(['BB'], {}, { BB: { canais: [] } }),
        checa: [semPlaceholder, conta('class="i-canais"', 0)],
    },
    {
        // "Até 1 marketplaces simultâneos" ia no documento do cliente sempre que
        // a faixa era de um. A unidade acompanha o número de cada faixa.
        nome: 'faixa de 1 vai no singular, as demais no plural',
        spec: spec(['VM'], {}, { VM: { quantidade: 1, faixas: [{ qtd: 2, preco: 12900 }] } }),
        checa: [semPlaceholder, contem('Até 1 marketplace simultâneo'),
            naoContem('Até 1 marketplaces'), contem('Até 2 marketplaces simultâneos')],
    },
    {
        // A unidade vinha da config, que só existe em português: a proposta em
        // inglês dizia "Up to 5 palavras" na tabela de valores.
        nome: 'a unidade da escada sai no idioma do documento',
        spec: spec(['BB'], { idioma: 'en' }, { BB: { quantidade: 5, faixas: [{ qtd: 10, preco: 16900 }] } }),
        checa: [semPlaceholder, contem('Up to 5 keywords'), contem('Up to 10 keywords'),
            naoContem('palavras')],
    },
    {
        nome: 'e em espanhol também',
        spec: spec(['BBP'], { idioma: 'es' }, { BBP: { quantidade: 1, faixas: [{ qtd: 50, preco: 12900 }] } }),
        checa: [semPlaceholder, contem('Hasta 1 SKU<'), contem('Hasta 50 SKUs')],
    },
    {
        nome: 'escada de BBP com Sob Consulta marcado',
        spec: spec(['BBP'], {}, { BBP: { quantidade: 50, preco: 8900, faixas: [{ qtd: 100, preco: 12900 }], sobConsulta: true } }),
        checa: [semPlaceholder, ordemDe('Até 50', 'Até 100')],
    },
    {
        nome: 'pacote único com desconto — cards avulso × pacote',
        spec: spec(['BB', 'VM'], { pacote: 15000 }),
        // Um pacote que cobre tudo e sai mais barato vira comparação lado a lado:
        // cada serviço avulso (R$ 8.900) e o pacote (R$ 15.000) marcado como
        // recomendado, com a economia. A tabela não repete o total combinado.
        checa: [semPlaceholder, contem('Opções de pacote'), contem('Recomendado'),
            contem('R$ 8.900,00'), contem('R$ 15.000,00'), contem('economia de R$ 2.800,00'),
            naoContem('Subtotal'), naoContem('condição combinada')],
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
        nome: 'versão atual mostra a mensagem de aceite e não avisa nada',
        args: { slug: 'atual1' },
        // Sem formulário de aceite online (removido): sai só a mensagem.
        checa: [naoContem('foi substituída'), contem('registra o compromisso comercial'), naoContem('Aceitar proposta')],
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
        checa: [contem('Sem fidelidade'), contem('Indeterminada')],
    },
    {
        // A validade negociada tem que alcançar os DOIS lugares onde o prazo é
        // escrito — Identificação e Condições —, senão o documento se contradiz
        // numa cláusula que o cliente lê pra saber até quando pode aceitar.
        nome: 'validade negociada vale nos dois lugares do documento',
        args: {},
        spec: spec(['BB'], { condicoes: { validadeDias: 30 } }),
        checa: [conta('30 dias corridos', 2), naoContem('15 dias corridos')],
    },
    {
        nome: 'validade absurda cai no padrão de 15 dias',
        args: {},
        spec: spec(['BB'], { condicoes: { validadeDias: -3 } }),
        checa: [conta('15 dias corridos', 2), naoContem('-3')],
    },
    {
        nome: 'validade em texto livre não passa por número',
        args: {},
        spec: spec(['BB'], { condicoes: { validadeDias: 'até o fim do mês' } }),
        checa: [conta('15 dias corridos', 2), naoContem('fim do mês')],
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
            naoContem('cruzamento com bases'), naoContem('apoio à atuação comercial junto aos canais'),
            // revisão contra os docs (24/08/2026): "D+7" e "renovação automática"
            // não existem em modelo nenhum — prazo inventado vira cobrança.
            naoContem('D+7'), naoContem('renovação automática'),
            contem('Após o início do monitoramento')],
    },
    {
        // Revisão do closer, 27/08/2026. Os três vinham do modelo antigo, palavra
        // por palavra — mas a Branddi não presta assessoria jurídica, as NEs são
        // administrativas e o objetivo não é litígio. O modelo antigo dizia o que
        // a Branddi não faz; o documento novo não repete.
        nome: 'a proposta não promete assessoria jurídica nem litígio',
        args: {},
        spec: spec(['BB']),
        checa: [naoContem('assessoria jurídica'), naoContem('ação judicial'), naoContem('uso ilícito'),
            contem('notificação extrajudicial'), contem('administrativa')],
    },
    {
        // A ação do Brand Bidding, descrita pela operação em 27/08/2026: "fazer
        // o trabalho de mediação com esses anunciantes, solicitando que
        // negativem a palavra-chave da sua marca no Google, em correspondência
        // ampla e em nível de conta". O documento dizia só "buscando a solução
        // amigável", que não informa nada — e a condição "Limite de denúncias e
        // MEDIAÇÕES: sem limite" já estava lá sem que nada dissesse o que uma
        // mediação é.
        nome: 'Brand Bidding diz qual é o pedido da mediação',
        args: {},
        spec: spec(['BB']),
        checa: [contem('mediação'), contem('negative a palavra-chave'),
            contem('correspondência ampla'), contem('nível de conta'),
            // Ranqueamento por agressividade = os "principais ofensores".
            contem('principais ofensores'),
            // A ação do BB é a mediação e mais nada. Denúncia à plataforma e ao
            // serviço de hospedagem a Branddi faz — mas é Golpes Digitais, e
            // dentro de uma proposta de BB confunde o cliente sobre o que ele
            // contratou. Vale também pela negativa: a frase de monitoria não
            // pode dizer "nem protocola denúncias", que insinuaria que na outra
            // modalidade protocola.
            naoContem('denúncia'), naoContem('denúncias'), naoContem('hospedagem')],
    },
    {
        nome: 'Brand Bidding em monitoria nega só o que ele faria',
        args: {},
        spec: spec(['BB'], {}, { BB: { modalidade: 'Monitoria' } }),
        checa: [contem('não notifica anunciantes nesta modalidade'),
            naoContem('nem protocola denúncias')],
    },
    {
        // Não aparece na descrição do serviço que a operação deu, e ninguém
        // confirmou que existe. Promessa sem dono não fica em documento
        // assinado — se existir, volta em uma linha.
        nome: 'Golpes Digitais não promete disputa de domínio',
        args: {},
        spec: spec(['GD']),
        checa: [naoContem('disputas de domínio'), naoContem('câmaras de arbitragem'),
            naoContem('intermediação'), contem('acompanhamento até a remoção')],
    },
    {
        // Cadastro nos Brand Protection Programs é entrega de implantação nos
        // dois produtos de marketplace, e não estava em lugar nenhum.
        nome: 'marketplace declara o cadastro nos Brand Protection Programs',
        args: {},
        spec: spec(['BBP', 'VM']),
        checa: [conta('Brand Protection Programs', 2),
            contem('quem está por trás do nome fantasia'),
            contem('acompanhamento até a remoção')],
    },
    {
        // "compram o nome da marca" afirmava a compra da palavra; o monitoramento
        // enxerga o anúncio, não o lance. O modelo antigo diz "utilizando".
        nome: 'o objetivo do Brand Bidding não afirma a compra da palavra',
        args: {},
        spec: spec(['BB']),
        checa: [naoContem('compram o nome da marca'), contem('usam o nome da marca')],
    },
    {
        // No Buy Box o seller que disputa pode ser autorizado — o modelo antigo
        // monitora "sellers que disputam o Buy Box", sem qualificar.
        nome: 'o Buy Box não trata todo seller que disputa como não autorizado',
        args: {},
        spec: spec(['BBP']),
        checa: [contem('autorizados ou não'), naoContem('sem que haja qualquer infração')],
    },
    {
        // Anúncios falsos em redes sociais e em resultados patrocinados estão no
        // modelo antigo e na linha de Coleta; faltavam na frase que vai pra capa.
        nome: 'o objetivo do Golpes Digitais inclui os anúncios',
        args: {},
        spec: spec(['GD']),
        checa: [contem('perfis e anúncios falsos')],
    },
    {
        // O VM segue a descrição que a operação deu do serviço: marketplace,
        // anúncio, produto falsificado, uso indevido da marca ou da imagem.
        // Rede social NÃO entra — nem anúncio (a busca é por palavra-chave e
        // ali "não conseguimos fazer um bom trabalho"), nem perfil, que é
        // assunto de outro produto. O perfil fica escopado ao marketplace.
        nome: 'VM é marketplace: sem Meta Ads e sem rede social',
        args: {},
        spec: spec(['VM']),
        checa: [contem('nos marketplaces'), naoContem('Meta Ads'),
            naoContem('plataformas de venda online'), naoContem('redes sociais'),
            contem('no marketplace'), contem('produtos falsificados')],
    },
    {
        // O KB do report-engine é explícito: ~74% dos SKUs usam a mediana como
        // referência, e nesses o certo é falar em dispersão/suspeita, nunca em
        // infração. A proposta não pode afirmar o que o dado não sustenta.
        nome: 'Buy Box fala em preço de referência, não em infração de preço',
        args: {},
        spec: spec(['BBP']),
        checa: [contem('preço de referência'), contem('autorizados ou não'),
            naoContem('infração de preço'), naoContem('queima'),
            naoContem('sem que haja qualquer infração'),
            // A entrega é diagnóstico; quem age junto aos canais é a marca.
            contem('diagnóstico'), contem('conduzida pela Contratante')],
    },
    // A capa e a nota-insight NÃO olham a modalidade. Enquanto for assim, a copy
    // delas não pode prometer atuação: numa venda só de monitoria o corpo diz
    // que a Branddi não notifica nem denuncia, e a capa dizia "do monitoramento
    // ao takedown". Em inglês e espanhol havia chamada nos quatro produtos, sem
    // equivalente em português — copy esperando aprovação já ia pro cliente.
    ...[['pt', 'BB'], ['en', 'VM'], ['es', 'GD']].map(([idioma, code]) => ({
        nome: `venda de monitoria não promete atuação na capa (${idioma})`,
        args: {},
        spec: spec([code], { idioma }, { [code]: { modalidade: 'Monitoria' } }),
        checa: [capaSemPromessa],
    })),
    {
        nome: 'a fonte da proposta é Inter (Branddi Design System)',
        args: { slug: 'x' },
        spec: spec(['BB']),
        checa: [contem('family=Inter'), contem('"Inter"'), contem('JetBrains+Mono')],
    },
];

const CASOS_OBS = [
    {
        nome: 'observação da proposta SAI no documento',
        args: { slug: 'x' },
        spec: spec(['BB'], { obsProposta: 'Relatórios quinzenais acordados com o cliente' }),
        checa: [contem('Relatórios quinzenais acordados'), contem('>Observações<')],
    },
    {
        nome: 'observação interna NUNCA sai',
        args: { slug: 'x' },
        spec: spec(['BB'], { observacoes: 'ANOTACAO INTERNA DO TIME', obsProposta: '' }),
        checa: [naoContem('ANOTACAO INTERNA DO TIME'), naoContem('>Observações<')],
    },
    {
        nome: 'observação com HTML sai escapada',
        args: { slug: 'x' },
        spec: spec(['BB'], { obsProposta: '<script>x</script>' }),
        checa: [naoContem('<script>x'), contem('&lt;script&gt;x')],
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
            contem('Technical &amp; commercial proposal'), contem('Identification'),
            contem('Purpose of the proposal'), contem('Commercial terms'), naoContem('Legal basis'), contem('Requirement'),
            contem('Client'), contem('Deliverable'), contem('Monitoring + Enforcement'),
            contem('No minimum term'), contem('commercial commitment'), contem('Download PDF'),
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
            contem('Propuesta técnica &amp; comercial'), contem('Identificación'),
            contem('Objeto de la propuesta'), contem('Condiciones comerciales'), naoContem('Fundamento legal'), contem('Requisito'),
            contem('Entregable'), contem('Monitoreo + Actuación'), contem('Sin permanencia'),
            contem('compromiso comercial'), contem('Descargar en PDF'),
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

for (const caso of CASOS_OBS) {
    let html;
    try { html = renderProposta({ deal: DEAL, spec: caso.spec, ...caso.args }); }
    catch (e) { falhas.push([caso.nome, ]); continue; }
    const erros = caso.checa.map((f) => f(html)).filter((r) => r !== true);
    if (erros.length) falhas.push([caso.nome, erros.join(' | ')]);
    else { ok++; console.log(); }
}

for (const caso of ERROS) {
    try {
        renderProposta({ deal: caso.deal || DEAL, spec: caso.spec });
        falhas.push([caso.nome, 'gerou quando devia recusar']);
    } catch (e) {
        if (caso.esperado.test(e.message)) { ok++; console.log(`✅ ${caso.nome}`); }
        else falhas.push([caso.nome, `recusou com a mensagem errada: ${e.message}`]);
    }
}

// ─── Balanço da última folha ────────────────────────────────────────
// A conta que decide quanto empurrar o fecho pra baixo. Vive no pdf.js, mas é
// função pura — dá pra conferir aqui, sem navegador, e é onde um erro sairia
// caro: empurrar demais joga o fecho pra uma folha nova.
const A4 = 1123;              // altura da folha em px, a 96dpi
const MM = A4 / 297;
const BALANCO = [
    ['folha cheia não é empurrada', { folga: 5 * MM, alturaPagina: A4 }, 0],
    ['folga menor que o mínimo não é empurrada', { folga: 30 * MM, alturaPagina: A4 }, 0],
    ['folga de 100mm empurra 50mm', { folga: 100 * MM, alturaPagina: A4 }, Math.round(50 * MM)],
    ['folga de 200mm empurra 100mm', { folga: 200 * MM, alturaPagina: A4 }, Math.round(100 * MM)],
    // Folha praticamente vazia: metade da folga passaria de 45% da folha, e o
    // teto segura — senão o fecho ficaria boiando no centro do nada.
    ['teto de 45% da folha', { folga: 290 * MM, alturaPagina: A4 }, Math.round(A4 * 0.45)],
    // Defensivos: medida ausente ou absurda não pode virar empurrão.
    ['folga negativa não empurra', { folga: -50, alturaPagina: A4 }, 0],
    ['sem altura de página não empurra', { folga: 200 * MM, alturaPagina: 0 }, 0],
];
for (const [nome, entrada, esperado] of BALANCO) {
    const obtido = alturaDeBalanco({ ...entrada, mm: MM });
    if (obtido === esperado) { ok++; console.log(`✅ balanço: ${nome}`); }
    else falhas.push([`balanço: ${nome}`, `empurrou ${obtido}px, esperava ${esperado}px`]);
}

console.log('');
if (falhas.length) {
    console.log(`❌ ${falhas.length} caso(s) falharam:`);
    falhas.forEach(([n, e]) => console.log(`   ${n}\n      ${e}`));
    process.exit(1);
}
console.log(`✅ ${ok} casos, todos passaram`);
