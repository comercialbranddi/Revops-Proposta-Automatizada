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
 *   • "Limite de atuações: sem limite" some pelo mesmo motivo.
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
const SEM_ATUACAO = (quem, denuncia = true) =>
    `A Branddi não notifica ${quem}${denuncia ? ' nem protocola denúncias' : ''} nesta modalidade.`;

export const BLOCOS_PT = {

    // ─────────────────────────────────────────────────────────────────
    BB: {
        titulo: 'Brand Bidding',
        // Frase do problema que o produto resolve. Monta a cláusula "Objetivo do
        // contrato" sem que o gerador precise redigir nada na hora.
        objetivo: 'concorrentes e terceiros usam o nome da marca como palavra-chave e capturam tráfego que era da Contratante, no momento em que o consumidor já a estava procurando',
        temModalidade: true,
        prosa: {
            ambos: 'Monitoramento da marca nos buscadores para localizar quais marcas, entidades ou empresas — concorrentes ou não — utilizam o termo da Contratante como palavra de busca para anunciar seus próprios produtos e serviços. Ao identificarmos anunciantes nessa prática, <strong>a Branddi conduz a mediação com o anunciante</strong> — notificação extrajudicial, por via administrativa, pedindo que ele negative a palavra-chave da marca no Google, em correspondência ampla e em nível de conta.',
            monitoria: `Monitoramento da marca nos buscadores para localizar quais marcas, entidades ou empresas — concorrentes ou não — utilizam o termo da Contratante como palavra de busca para anunciar seus próprios produtos e serviços. <strong>Cada ocorrência é entregue com o dossiê completo</strong> — palavra monitorada, data, geolocalização, posição em tela, título, domínio exibido, link do anúncio e captura de tela da evidência — <strong>para que a Contratante conduza a medida que julgar cabível</strong>. ${SEM_ATUACAO('anunciantes', false)}`,
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
            { rotulo: 'Palavras-chave', valor: 'Até {{QUANTIDADE}} [[palavra|palavras]]' },
            { rotulo: 'Frequência', valor: 'Diária, em horários diversos' },
            { rotulo: 'Coleta', valor: 'De cada anúncio encontrado: palavra monitorada, data, geolocalização, tipo de ambiente (desktop ou mobile), posição em tela, título, link, marca anunciada, domínio exibido, descrição e captura de tela da evidência' },
            { rotulo: 'Tratamento', valor: 'Triagem e classificação das ocorrências por tipo de violação e ranqueamento dos anunciantes por agressividade, que identifica os principais ofensores da marca, por equipe especializada da Contratada' },
            { rotulo: 'Atuação', so: 'ambos', valor: 'Mediação com o anunciante: notificação extrajudicial administrativa pedindo a negativação da palavra-chave da marca no Google, em correspondência ampla e em nível de conta' },
            { rotulo: 'Entrega de evidências', so: 'monitoria', valor: 'Dossiê por ocorrência, em formato apto a instruir notificação extrajudicial ou denúncia conduzida pela Contratante ou por seu escritório' },
            { rotulo: 'Aprovação', so: 'ambos', valor: 'Nenhuma mediação é iniciada sem aprovação expressa da Contratante, link a link' },
        ],
        sla: [
            { entregavel: 'Relatório de monitoramento', periodicidade: 'Diária', canal: 'E-mail, em PDF' },
            { entregavel: 'Triagem de violações para aprovação', so: 'ambos', periodicidade: 'Semanal', canal: 'E-mail' },
            { entregavel: 'Relatório de ocorrências classificadas', so: 'monitoria', periodicidade: 'Semanal', canal: 'E-mail' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Reescrito em 27/08/2026 a partir do KB do report-engine
    // (docs/BBP-BASE-CONHECIMENTO-MATERIAL-COMERCIAL.md e
    // docs/KB-DADOS-PARA-PPT-COMERCIAL-2026-07-18.md), que é a descrição ATUAL
    // do produto. O modelo antigo do Google Docs está defasado aqui: diz só
    // Mercado Livre, e a operação roda Mercado Livre + Amazon.
    //
    // Duas travas de vocabulário que vêm do próprio KB:
    //
    //   • Quem disputa o Buy Box pode ser a loja oficial, um revendedor
    //     AUTORIZADO, o 1P do marketplace ou um terceiro não autorizado. Tratar
    //     todo mundo como não autorizado é falso em três dos quatro casos.
    //   • Preço: "~74% dos SKUs usam mediana como referência — nesses, a
    //     afirmação correta é dispersão de preço / suspeita, NUNCA infração".
    //     Por isso "distância do preço de referência", e nunca "infração de
    //     preço" nem "queima de PMA".
    //
    // O "~90% das vendas do anúncio" que o KB cita ficou de fora de propósito:
    // é comportamento do marketplace, não medição da Branddi.
    BBP: {
        titulo: 'Buy Box Protection',
        objetivo: 'a loja oficial perde o Buy Box dos próprios produtos para outros sellers, autorizados ou não, e a marca não enxerga quem disputa, em quais SKUs nem a que preço',
        temModalidade: false,
        // A linha "Suporte"/"Support"/"Apoyo" saiu em 18/08/2026: descrevia o
        // COMO da entrega, que é assunto do relatório mensal, não da proposta.
        // O que a proposta precisa dizer sobre isso já está na prosa — a
        // atuação comercial é conduzida pela Contratante.
        // O modelo antigo intitulava esta lista "Formas de atuação", o que
        // sugeria que a Branddi atuava. Ela não atua: apoia, cruza e dá
        // suporte. Corrigido em 18/08/2026 — a promessa fica igual ao serviço.
        prosa: {
            unica: 'Monitoramento do catálogo da marca nos marketplaces: em cada anúncio, quem vence o Buy Box, a que preço e quais sellers disputam a posição. A entrega é o diagnóstico — quem disputa, em quais SKUs, a que distância do preço de referência e quanto de Buy Box a loja oficial perde —, com os sellers ranqueados por relevância e agressividade. <strong>A atuação comercial junto aos canais é conduzida pela Contratante</strong>, com suporte da Branddi.',
        },
        especificacoes: [
            { rotulo: 'Canais', valor: '{{CANAIS}}' },
            { rotulo: 'Catálogo monitorado', valor: 'Até {{QUANTIDADE}} [[SKU|SKUs]]' },
            { rotulo: 'Frequência', valor: 'Diária' },
            { rotulo: 'Coleta', valor: 'Sellers que disputam o Buy Box dos produtos da marca; posição da loja oficial; preço do Buy Box e preço de cada seller frente ao preço de referência do SKU; reincidência e padrões de disputa; perfil, histórico e relevância de cada seller, com identificação de quem está por trás do nome fantasia' },
            { rotulo: 'Tratamento', valor: 'Ranqueamento dos sellers por relevância e agressividade, por equipe especializada da Contratada' },
            { rotulo: 'Implantação', valor: 'Cadastro da marca nos Brand Protection Programs dos marketplaces monitorados; definição do portfólio de SKUs; configuração dos robôs de monitoramento; alinhamento de critérios de análise e priorização; integração às políticas comerciais da marca' },
        ],
        sla: [
            { entregavel: 'Relatório de situação das ocorrências', periodicidade: 'Semanal', canal: 'E-mail, customizável' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    GD: {
        titulo: 'Golpes Digitais',
        objetivo: 'sites, domínios, perfis e anúncios suspeitos se passam pela marca para aplicar golpes, o que lesa o consumidor e transfere o dano reputacional para a Contratante',
        temModalidade: true,
        prosa: {
            ambos: 'Detecção e neutralização de ameaças digitais que simulam ou clonam a identidade da marca para lesar a Contratante e seus consumidores — sites falsos, domínios semelhantes, perfis e anúncios fraudulentos. Com base nas ocorrências encontradas, <strong>a Branddi protocola denúncias</strong> junto às plataformas, registradores e provedores de hospedagem envolvidos, solicitando a remoção do conteúdo infrator ou o bloqueio do domínio.',
            monitoria: `Detecção de ameaças digitais que simulam ou clonam a identidade da marca para lesar a Contratante e seus consumidores — sites falsos, domínios semelhantes, perfis e anúncios fraudulentos. <strong>Cada ocorrência é entregue com o dossiê completo</strong> — domínio ou perfil, data de detecção, registrador ou plataforma, provedor de hospedagem, classificação da ameaça e captura de tela — <strong>para que a Contratante conduza a medida que julgar cabível</strong>. ${SEM_ATUACAO('responsáveis por domínios e perfis')}`,
        },
        especificacoes: [
            { rotulo: 'Canais', valor: '{{CANAIS}}' },
            { rotulo: 'Cobertura', valor: 'Mais de 2.800 registradores de domínio, 746 TLDs e 1.510 ccTLDs; cerca de 250.000 novos domínios analisados por dia; plataformas de e-commerce, de checkout e gateways de pagamento; provedores de hospedagem; bibliotecas de anúncios e resultados patrocinados' },
            { rotulo: 'Frequência', valor: 'Monitoramento contínuo' },
            { rotulo: 'Coleta', valor: 'Contas falsas em redes sociais; websites que imitam o site oficial; domínios registrados com semelhança à marca; anúncios enganosos em redes sociais e em resultados patrocinados no Google' },
            { rotulo: 'Tratamento', valor: 'Filtragem de falsos positivos e categorização das ocorrências, por equipe de Brand Strategy' },
            { rotulo: 'Atuação', so: 'ambos', valor: 'Denúncia às entidades e plataformas envolvidas pedindo a remoção do conteúdo ou o bloqueio do domínio, com acompanhamento até a remoção' },
            { rotulo: 'Entrega de evidências', so: 'monitoria', valor: 'Dossiê por ocorrência, com registrador, hospedagem e canal de denúncia identificados, em formato apto a instruir a medida conduzida pela Contratante ou por seu escritório' },
            { rotulo: 'Safelist', valor: 'A Contratante pode fornecer lista de URLs, domínios e perfis oficiais, que passam a ser desconsiderados pelo monitoramento' },
            { rotulo: 'Aprovação', so: 'ambos', valor: 'Nenhuma denúncia é iniciada sem aprovação expressa da Contratante. Takedown automatizado disponível mediante autorização e safelist' },
        ],
        sla: [
            { entregavel: 'Triagem de ameaças identificadas', periodicidade: 'Diária', canal: 'E-mail' },
            // Diferencial da solução: o cliente recebe o relatório NO DIA em que
            // a ameaça é encontrada, não num resumo semanal (comercial,
            // 27/08/2026). "Relatório de status" com cadência semanal
            // subestimava o serviço — parecia um digest periódico, quando na
            // prática é notificação por ocorrência.
            { entregavel: 'Relatório da ocorrência identificada', periodicidade: 'No mesmo dia da identificação', canal: 'E-mail' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Onde o VM olha, decidido em 27/08/2026 com o time de operação:
    // MARKETPLACE é o eixo — é o que a quantidade contratada conta — e PERFIL
    // é escopo onde ele existir, no marketplace ou em rede social ("olhamos
    // meta, principalmente perfis").
    //
    // ANÚNCIO em Meta ficou de FORA, e não por esquecimento: a busca é por
    // palavra-chave e, sobre anúncio, "não conseguimos fazer um bom trabalho".
    // O modelo antigo do Google Docs listava "anúncios em metaads" na coleta —
    // é exatamente o tipo de linha que promete o que não se entrega.
    VM: {
        titulo: 'Violação de Propriedade Intelectual',
        objetivo: 'terceiros usam o sinal distintivo da marca sem autorização para vender produtos e serviços nos marketplaces, o que dilui a marca e confunde o consumidor',
        temModalidade: true,
        prosa: {
            ambos: 'Identificação do uso indevido das marcas registradas da Contratante nos principais marketplaces. Com base nas ocorrências encontradas, <strong>a Branddi comunica as violações às plataformas</strong>, buscando a remoção das listagens infratoras ou a correção dos anúncios.',
            monitoria: `Identificação do uso indevido das marcas registradas da Contratante nos principais marketplaces. <strong>Cada ocorrência é entregue com o dossiê completo</strong> — captura de tela, data, canal, identificação do infrator e classificação do tipo de violação — <strong>para que a Contratante conduza a medida que julgar cabível</strong>. ${SEM_ATUACAO('infratores')}`,
        },
        especificacoes: [
            { rotulo: 'Canais', valor: 'Até {{QUANTIDADE}} [[marketplace monitorado|marketplaces monitorados]] simultaneamente' },
            { rotulo: 'Frequência', valor: 'Diária' },
            { rotulo: 'Coleta', valor: 'Anúncios que utilizem termos da marca no título ou no conteúdo da oferta, relacionados a produtos falsificados ou a uso indevido da marca ou da imagem; perfis que usem a marca no nome de usuário ou elementos gráficos da marca no marketplace' },
            { rotulo: 'Tratamento', valor: 'Triagem e categorização por tipo de violação, por equipe de Brand Strategy, com indicação da tratativa aplicável' },
            { rotulo: 'Implantação', valor: 'Cadastro da marca nos Brand Protection Programs dos marketplaces monitorados; definição das regras de triagem e classificação junto à Contratante' },
            { rotulo: 'Atuação', so: 'ambos', valor: 'Aviso de violação ao infrator, inclusive por chat da plataforma quando o canal estiver disponível; denúncia formal nos casos de falsificação, uso indevido da marca ou da imagem, ou insucesso da via amigável, com acompanhamento até a remoção do anúncio' },
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
// "Limite de atuações" só faz sentido se ALGUM produto estiver em atuação —
// num contrato só de monitoria a linha promete um limite para algo que a
// Branddi não faz.
export const SLA_GERAL = [
    { entregavel: 'Início do monitoramento após aceite', periodicidade: '3 dias úteis', canal: '—' },
    { entregavel: 'Reunião de acompanhamento', periodicidade: 'Mensal', canal: 'Remota' },
    { entregavel: 'Limite de atuações', so: 'ambos', periodicidade: 'Sem limite', canal: '—' },
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
