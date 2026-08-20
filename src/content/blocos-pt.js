/**
 * Catálogo de blocos da proposta — português.
 *
 * Isto substitui os 45 Google Docs pré-montados. O motivo é aritmético: com
 * modalidade por produto (decisão de 18/08/2026), a matriz de documentos
 * prontos iria a 90 arquivos, e cada correção de vírgula teria que ser
 * replicada em todos. Aqui o texto de cada produto existe UMA vez e a
 * combinação é montada na hora.
 *
 * ─── O que varia por modalidade ─────────────────────────────────────
 *
 * Não é troca de palavra: são linhas que EXISTEM ou NÃO existem. Em
 * "Monitoria" a Branddi não notifica ninguém, então:
 *
 *   • a prosa deixa de prometer comunicação às plataformas;
 *   • a linha "Atuação" vira "Entrega de evidências";
 *   • "Aprovação link a link" some — não há o que aprovar;
 *   • "Limite de denúncias: sem limite" some pelo mesmo motivo.
 *
 * É por isso que placeholder em documento pronto não resolvia.
 *
 * ─── Por que BBP não tem modalidade ─────────────────────────────────
 *
 * Lendo o que cada bloco promete em "Formas de atuação": BB envia notificação
 * extrajudicial, GD executa denúncias e remoções, VM envia aviso e protocola
 * denúncia. BBP diz "apoio à identificação", "cruzamento de bases" e "suporte
 * à atuação comercial DA MARCA" — quem atua é o cliente. Não há atuação da
 * Branddi ali pra tirar.
 *
 * ─── Fidelidade ao que já era enviado ───────────────────────────────
 *
 * A variante "ambos" é o texto dos modelos que o time já usa (pasta "Modelo
 * Propostas", importada em 10/08/2026), reescrita só no que era impreciso —
 * ver a nota no bloco de BBP. A variante "monitoria" foi redigida em
 * 18/08/2026 e validada pela Jessica no bloco de VM antes de ser estendida a
 * BB e GD, pra que os três falem igual.
 *
 * `so: 'ambos' | 'monitoria'` marca a linha que só aparece naquela
 * modalidade. Sem `so`, a linha aparece nas duas.
 */

// Frase de fechamento da variante de monitoria. Repetida de propósito em cada
// bloco (em vez de concatenada pelo renderer) porque o objeto direto muda:
// "anunciantes", "infratores", "responsáveis pelos domínios".
const SEM_ATUACAO = (quem) =>
    `A Branddi não notifica ${quem} nem protocola denúncias nesta modalidade.`;

export const BLOCOS_PT = {

    // ─────────────────────────────────────────────────────────────────
    BB: {
        titulo: 'Brand Bidding',
        // Frase do problema que o produto resolve. Monta a cláusula "Objetivo do
        // contrato" sem que o gerador precise redigir nada na hora.
        objetivo: 'concorrentes e terceiros compram o nome da marca como palavra-chave e capturam tráfego que era da Contratante, no momento em que o consumidor já a estava procurando',
        temModalidade: true,
        prosa: {
            ambos: 'Monitoramento da marca nos buscadores para localizar quais marcas, entidades ou empresas — concorrentes ou não — utilizam o termo da Contratante como palavra de busca para anunciar seus próprios produtos e serviços. Ao identificarmos anunciantes nessa prática, <strong>a Branddi executa a assessoria jurídica</strong> que contempla a redação, o envio e o acompanhamento de notificações extrajudiciais, com o objetivo de desestimular o uso ilícito da marca e de reunir subsídios para eventual ação judicial.',
            monitoria: `Monitoramento da marca nos buscadores para localizar quais marcas, entidades ou empresas — concorrentes ou não — utilizam o termo da Contratante como palavra de busca para anunciar seus próprios produtos e serviços. <strong>Cada ocorrência é entregue com o dossiê completo</strong> — palavra monitorada, data, geolocalização, posição em tela, título, domínio exibido, link do anúncio e captura de tela da evidência — <strong>para que a Contratante conduza a medida que julgar cabível</strong>. ${SEM_ATUACAO('anunciantes')}`,
        },
        especificacoes: [
            { rotulo: 'Canais', valor: '{{CANAIS}}' },
            // O modelo antigo trazia "Palavras-chave: Até N palavras." e a
            // primeira versão deste catálogo perdeu a linha — proposta de Brand
            // Bidding saía sem declarar o limite contratado, que é item de
            // escopo. Achado pela bateria em 18/08/2026.
            //
            // Fica sem valor quando a venda é só de App Store: ali não se
            // contrata por palavra, e valorLinha() faz a linha inteira sumir.
            { rotulo: 'Palavras-chave', valor: 'Até {{QUANTIDADE}} palavras' },
            { rotulo: 'Frequência', valor: 'Diária, em horários diversos' },
            { rotulo: 'Coleta', valor: 'De cada anúncio encontrado: palavra monitorada, data, geolocalização, tipo de ambiente (desktop ou mobile), posição em tela, título, link, marca anunciada, domínio exibido, descrição e captura de tela da evidência' },
            { rotulo: 'Tratamento', valor: 'Triagem e classificação das ocorrências por tipo de violação, por equipe especializada da Contratada' },
            { rotulo: 'Atuação', so: 'ambos', valor: 'Notificação extrajudicial ao anunciante, buscando solução amigável; denúncia à plataforma pedindo a remoção do conteúdo, nos casos classificados como suspeita de fraude ou violação de marca; denúncia ao serviço de hospedagem quando houver site fraudulento' },
            { rotulo: 'Entrega de evidências', so: 'monitoria', valor: 'Dossiê por ocorrência, em formato apto a instruir notificação extrajudicial ou denúncia conduzida pela Contratante ou por seu escritório' },
            { rotulo: 'Aprovação', so: 'ambos', valor: 'Nenhuma notificação ou denúncia é iniciada sem aprovação expressa da Contratante, link a link' },
        ],
        sla: [
            { entregavel: 'Relatório de monitoramento', periodicidade: 'Diária', canal: 'E-mail, em PDF' },
            { entregavel: 'Triagem de violações para aprovação', so: 'ambos', periodicidade: 'Semanal', canal: 'E-mail' },
            { entregavel: 'Relatório de ocorrências classificadas', so: 'monitoria', periodicidade: 'Semanal', canal: 'E-mail' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    BBP: {
        titulo: 'Buy Box Protection',
        objetivo: 'a loja oficial perde a posição de compra nos marketplaces para sellers não autorizados, o que desloca receita sem que haja qualquer infração de marca',
        temModalidade: false,
        // A linha "Suporte"/"Support"/"Apoyo" saiu em 18/08/2026: descrevia o
        // COMO da entrega, que é assunto do relatório mensal, não da proposta.
        // O que a proposta precisa dizer sobre isso já está na prosa — a
        // atuação comercial é conduzida pela Contratante.
        // O modelo antigo intitulava esta lista "Formas de atuação", o que
        // sugeria que a Branddi atuava. Ela não atua: apoia, cruza e dá
        // suporte. Corrigido em 18/08/2026 — a promessa fica igual ao serviço.
        prosa: {
            unica: 'Governança da conversão dos produtos da marca nos marketplaces, atuando sobre a dinâmica do Buy Box para reduzir o desvio de vendas a sellers não autorizados. Diferente de abordagens focadas em preço, o serviço oferece visibilidade, controle e inteligência sobre quem disputa a posição de compra dos produtos da marca. <strong>A atuação comercial junto aos canais é conduzida pela Contratante</strong>, com suporte da Branddi.',
        },
        especificacoes: [
            { rotulo: 'Canais', valor: '{{CANAIS}}' },
            { rotulo: 'Catálogo monitorado', valor: 'Até {{QUANTIDADE}} SKUs' },
            { rotulo: 'Frequência', valor: 'Diária' },
            { rotulo: 'Coleta', valor: 'Sellers que disputam o Buy Box dos produtos da marca; posição da loja oficial; reincidência e padrões de disputa; perfil, histórico e relevância de cada seller' },
            { rotulo: 'Tratamento', valor: 'Classificação das ocorrências por relevância e comportamento comercial, por equipe especializada da Contratada' },
            { rotulo: 'Implantação', valor: 'Definição do portfólio de SKUs; configuração dos robôs de monitoramento; alinhamento de critérios de análise e priorização; integração às políticas comerciais da marca' },
        ],
        sla: [
            { entregavel: 'Relatório de situação das ocorrências', periodicidade: 'Semanal', canal: 'E-mail, customizável' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    GD: {
        titulo: 'Golpes Digitais',
        objetivo: 'sites, domínios e perfis falsos se passam pela marca para aplicar golpes, o que lesa o consumidor e transfere o dano reputacional para a Contratante',
        temModalidade: true,
        prosa: {
            ambos: 'Detecção e neutralização de ameaças digitais que simulam ou clonam a identidade da marca para lesar a Contratante e seus consumidores — sites falsos, domínios semelhantes, perfis e anúncios fraudulentos. Com base nas ocorrências encontradas, <strong>a Branddi protocola denúncias</strong> junto às plataformas, registradores e provedores de hospedagem envolvidos, solicitando a remoção do conteúdo infrator ou o bloqueio do domínio.',
            monitoria: `Detecção de ameaças digitais que simulam ou clonam a identidade da marca para lesar a Contratante e seus consumidores — sites falsos, domínios semelhantes, perfis e anúncios fraudulentos. <strong>Cada ocorrência é entregue com o dossiê completo</strong> — domínio ou perfil, data de detecção, registrador ou plataforma, provedor de hospedagem, classificação da ameaça e captura de tela — <strong>para que a Contratante conduza a medida que julgar cabível</strong>. ${SEM_ATUACAO('responsáveis por domínios e perfis')}`,
        },
        especificacoes: [
            { rotulo: 'Canais', valor: '{{CANAIS}}' },
            { rotulo: 'Cobertura', valor: 'Mais de 2.800 registradores de domínio, 746 TLDs e 1.510 ccTLDs; cerca de 250.000 novos domínios analisados por dia; plataformas de e-commerce, de checkout e gateways de pagamento; provedores de hospedagem; bibliotecas de anúncios e resultados patrocinados' },
            { rotulo: 'Frequência', valor: 'Monitoramento contínuo' },
            { rotulo: 'Coleta', valor: 'Contas falsas em redes sociais; websites que imitam o site oficial; domínios registrados com semelhança à marca; anúncios enganosos em redes sociais e em resultados patrocinados' },
            { rotulo: 'Tratamento', valor: 'Filtragem de falsos positivos e categorização das ocorrências, por equipe de Brand Strategy' },
            { rotulo: 'Atuação', so: 'ambos', valor: 'Denúncia às entidades e plataformas envolvidas pedindo a remoção do conteúdo ou o bloqueio do domínio; assessoria em disputas de domínio, de câmaras de arbitragem a ações judiciais, com escritórios parceiros ou indicados pela Contratante' },
            { rotulo: 'Entrega de evidências', so: 'monitoria', valor: 'Dossiê por ocorrência, com registrador, hospedagem e canal de denúncia identificados, em formato apto a instruir a medida conduzida pela Contratante ou por seu escritório' },
            { rotulo: 'Safelist', valor: 'A Contratante pode fornecer lista de URLs, domínios e perfis oficiais, que passam a ser desconsiderados pelo monitoramento' },
            { rotulo: 'Aprovação', so: 'ambos', valor: 'Nenhuma denúncia é iniciada sem aprovação expressa da Contratante. Takedown automatizado disponível mediante autorização e safelist' },
        ],
        sla: [
            { entregavel: 'Triagem de ameaças identificadas', periodicidade: 'Diária', canal: 'E-mail' },
            { entregavel: 'Relatório de status das ameaças', periodicidade: 'Semanal', canal: 'E-mail, customizável' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    VM: {
        titulo: 'Violação de Propriedade Intelectual',
        objetivo: 'terceiros usam o sinal distintivo da marca sem autorização para vender produtos e serviços, o que dilui a marca e confunde o consumidor',
        temModalidade: true,
        prosa: {
            ambos: 'Identificação do uso indevido das marcas registradas da Contratante nas principais plataformas de venda online. Com base nas ocorrências encontradas, <strong>a Branddi comunica as violações às plataformas</strong>, buscando a remoção das listagens infratoras ou a correção dos anúncios.',
            monitoria: `Identificação do uso indevido das marcas registradas da Contratante nas principais plataformas de venda online. <strong>Cada ocorrência é entregue com o dossiê completo</strong> — captura de tela, data, canal, identificação do infrator e classificação do tipo de violação — <strong>para que a Contratante conduza a medida que julgar cabível</strong>. ${SEM_ATUACAO('infratores')}`,
        },
        especificacoes: [
            { rotulo: 'Canais', valor: 'Até {{QUANTIDADE}} marketplaces monitorados simultaneamente' },
            { rotulo: 'Frequência', valor: 'Diária' },
            { rotulo: 'Coleta', valor: 'Anúncios que utilizem termos da marca no título ou no conteúdo da oferta; perfis com a marca no nome de usuário ou elementos gráficos da marca no perfil; anúncios em Meta Ads que utilizem termos da marca' },
            { rotulo: 'Tratamento', valor: 'Triagem e categorização por tipo de violação, por equipe de Brand Strategy, com indicação da tratativa aplicável' },
            { rotulo: 'Atuação', so: 'ambos', valor: 'Aviso de violação ao infrator, inclusive por chat da plataforma quando o canal estiver disponível; denúncia formal nos casos de falsificação, uso ilegal da marca ou insucesso da via amigável' },
            { rotulo: 'Entrega de evidências', so: 'monitoria', valor: 'Dossiê por ocorrência, em formato apto a instruir notificação extrajudicial ou denúncia conduzida pela Contratante ou por seu escritório' },
            { rotulo: 'Aprovação', so: 'ambos', valor: 'Nenhum aviso ou denúncia é iniciado sem aprovação expressa da Contratante, link a link' },
        ],
        sla: [
            { entregavel: 'Triagem de violações para aprovação', so: 'ambos', periodicidade: 'Semanal', canal: 'E-mail' },
            { entregavel: 'Relatório de ocorrências classificadas', so: 'monitoria', periodicidade: 'Semanal', canal: 'E-mail' },
            { entregavel: 'Relatório de status das ocorrências', periodicidade: 'Semanal', canal: 'E-mail, customizável' },
        ],
    },
};

// SLA e condições que valem pro contrato inteiro, independentes de produto.
// "Limite de denúncias" só faz sentido se ALGUM produto estiver em atuação —
// num contrato só de monitoria a linha promete um limite para algo que a
// Branddi não faz.
export const SLA_GERAL = [
    { entregavel: 'Início do monitoramento após aceite', periodicidade: '3 dias úteis', canal: '—' },
    { entregavel: 'Reunião de acompanhamento', periodicidade: 'Mensal', canal: 'Remota' },
    { entregavel: 'Limite de denúncias e mediações', so: 'ambos', periodicidade: 'Sem limite', canal: '—' },
];

/** As linhas que valem para uma modalidade. Sem `so`, a linha sempre vale. */
export function linhasDaModalidade(linhas, modalidade) {
    const chave = modalidade === 'Monitoria' ? 'monitoria' : 'ambos';
    return linhas.filter((l) => !l.so || l.so === chave);
}

/** A prosa do produto na modalidade pedida. Produto sem modalidade usa `unica`. */
export function prosaDoBloco(code, modalidade) {
    const b = BLOCOS_PT[code];
    if (!b) return null;
    if (!b.temModalidade) return b.prosa.unica;
    return modalidade === 'Monitoria' ? b.prosa.monitoria : b.prosa.ambos;
}

/**
 * True se ALGUM produto do contrato está em atuação — decide as linhas gerais
 * que só existem quando a Branddi notifica alguém.
 */
export function contratoTemAtuacao(porProduto) {
    return Object.entries(porProduto || {}).some(([code, p]) => {
        const b = BLOCOS_PT[code];
        if (!b) return false;
        // BBP não tem modalidade e nunca conta como atuação da Branddi.
        return b.temModalidade && p.modalidade !== 'Monitoria';
    });
}

/**
 * Insumos do aceite, por produto — o cliente só é cobrado do que contratou.
 * Estava cravado no renderizador; virou dado pra existir nos três idiomas.
 */
export const INSUMOS_PT = {
    BBP: 'relação de SKUs prioritários e de sellers autorizados',
    BB: 'lista de palavras-chave a monitorar',
    GD: 'safelist de domínios e perfis oficiais',
};
