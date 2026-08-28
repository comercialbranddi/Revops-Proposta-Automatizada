/**
 * O vocabulário do DOCUMENTO — títulos de cláusula, rótulos de tabela,
 * cláusula legal, bloco de aceite e faixas de aviso, nos três idiomas.
 *
 * Separado dos blocos de produto de propósito: `blocos-*.js` é o que a Branddi
 * VENDE (e muda quando o produto muda); isto é a moldura do documento (e muda
 * quando o modelo muda). Traduzir um sem o outro produziria uma proposta com
 * cláusula em inglês e cabeçalho em português — que é exatamente o defeito dos
 * documentos antigos, onde a lista de plataformas em inglês dizia
 * "Google + Meta (Facebook e Instagram) + TLD's (Dominios)".
 *
 * ─── O que NÃO foi traduzido, e por quê ─────────────────────────────
 *
 * **As condições comerciais seguem o português.** Decisão de 11/08/2026, depois
 * de auditar os nove documentos que o comercial mantinha em outro idioma: os
 * quatro em inglês vendiam CONTRATO ANUAL COM FIDELIDADE (e divergiam entre si
 * no aviso prévio — 90 dias num, 30 nos outros três), o oposto do que o
 * português oferece. Isso não é escolha de tradução, é cláusula de contrato.
 * Aqui, os três idiomas dizem sem fidelidade, aviso de 60 dias, setup de uma
 * mensalidade e validade de 15 dias.
 *
 * **A moeda segue em real.** Segue ABERTA e é decisão comercial: o espanhol
 * antigo cobrava em USD quando era Brand Bidding sozinho e em BRL no combo;
 * nenhum documento em inglês usava dólar no preço, mas todos usavam "$" na
 * linha de setup. Manter real é o único comportamento que não inventa uma
 * regra que ninguém definiu. Quando fechar, é aqui e no `brl()` do
 * renderizador que muda.
 *
 * **A base legal segue brasileira.** É onde a Branddi opera e de onde partem as
 * notificações. Para cliente que opere fora do Brasil isso pode não bastar —
 * pergunta jurídica, não de tradução. Sinalizado, não resolvido.
 */

// A modalidade é gravada no spec em PORTUGUÊS (é o valor canônico, o mesmo que
// o formulário e a planilha guardam). Só a exibição traduz — assim uma proposta
// gerada em inglês continua legível na planilha e no Pipedrive.
export const MODALIDADE_TRADUZIDA = {
    pt: { 'Monitoria + Atuação': 'Monitoria + Atuação', Monitoria: 'Monitoria' },
    en: { 'Monitoria + Atuação': 'Monitoring + Enforcement', Monitoria: 'Monitoring only' },
    es: { 'Monitoria + Atuação': 'Monitoreo + Actuación', Monitoria: 'Solo monitoreo' },
};

export const TEXTOS = {
    // ══════════════════════════════════════════════════════════════════
    pt: {
        locale: 'pt-BR',
        kicker: 'Proposta técnica e comercial',
        emissao: 'Emissão',
        validadeCurta: 'Validade',
        baixarPdf: 'Baixar em PDF',
        baixarPdfDica: 'Abre o PDF numa aba nova, pronto para salvar ou enviar.',
        rodape: 'Combata o uso indevido da sua marca e maximize seus resultados',
        rodapeValida: 'válida até',

        // ── Moldura do novo modelo (capa, rodapé de página, seções) ──────
        capaEyebrow: 'Proposta técnica & comercial',
        tagline: 'Blinde a sua marca.',
        site: 'branddi.com',
        // Título da capa quando há mais de um produto. Somar os nomes dava
        // "Brand Bidding + Buy Box Protection + Golpes Digitais + Violação de
        // Propriedade Intelectual para Fitoway" — quatro linhas de hero que
        // ninguém lê. "Frentes" é a palavra que o time usa pra falar de
        // produto, e o número mantém a frase honesta: não promete "completa".
        heroCombo: (n) => `Proteção de marca em ${['', '', 'duas', 'três', 'quatro'][n] || n} frentes`,
        heroConector: 'para',
        pagina: 'pág.',
        porMesCurto: '/mês',
        // Subtítulo abaixo do título de cada cláusula, na ordem de `clausulas`.
        clausulasSub: ['Partes e escopo contratual', 'O problema que esta proposta resolve',
            'O que a Branddi monitora e como atua', 'Valores mensais recorrentes, em reais',
            'Entregáveis, periodicidade e canal', 'Pagamento, vigência e rescisão',
            'Etapa · responsável · prazo'],
        // O loop da Branddi, exibido como faixa ao pé da Abordagem. A versão de
        // monitoria não notifica nem remove — entrega evidência pra Contratante agir.
        // Loop da Branddi (faixa da Abordagem). SÓ na modalidade de atuação — em
        // monitoria a Branddi não notifica nem remove, então a faixa não sai (não
        // inventar processo). Copy aprovada no modelo validado.
        loop: ['Detectar', 'Classificar', 'Notificar', 'Remover'],
        // Cards de pacote na cláusula de Investimento.
        avulso: 'Avulso',
        recomendado: 'Recomendado',
        pacoteLabel: 'Combo',
        avulsoDesc: 'Serviço contratado separadamente, pelo valor individual.',
        // Subtítulo (hero) da capa e nota-insight do Objetivo: SÓ por produto que
        // tem copy aprovada. Sem chave = elemento não aparece, e a capa cai no
        // objetivo do produto, que vem do catálogo.
        //
        // Esta copy NÃO sai de modelo antigo nenhum — é escrita aqui, e um
        // comentário anterior dizia que era "do modelo", o que não confere.
        // Por isso ela não afirma nada sobre o que a Branddi faz: descreve o
        // problema, e só. Duas coisas foram tiradas em 27/08/2026, na revisão
        // do closer:
        //
        //   • "A atuação da Branddi remove o anunciante e devolve o terreno à
        //     marca" — a Branddi NÃO remove; ela notifica e denuncia pedindo a
        //     remoção, que é decisão da plataforma.
        //   • "do monitoramento ao takedown" — takedown é promessa de atuação,
        //     e a capa não olha a modalidade: numa venda só de monitoria ela
        //     contradizia o corpo do próprio documento, que diz que a Branddi
        //     não notifica nem denuncia.
        //
        // "Concorrente" virou "outro anunciante" porque o catálogo é explícito
        // em "concorrentes OU NÃO" — quem anuncia na marca muitas vezes não é
        // concorrente.
        chamada: {
            BB: 'Recupere o tráfego que outros anunciantes capturam ao usar o nome da sua marca.',
        },
        insight: {
            BB: 'No brand bidding, o anúncio de outro anunciante aparece acima do seu resultado orgânico — você paga mais caro pelo próprio nome, ou perde o clique.',
        },

        // "Fundamentação legal" saiu em 18/08/2026, a pedido da Jessica. O
        // REQUISITO que estava dentro dela ficou — virou linha de escopo, porque
        // é pré-condição contratual, não argumentação jurídica.
        clausulas: ['Identificação', 'Objetivo da proposta', 'Abordagem', 'Investimento',
            'Escopo e níveis de serviço', 'Condições comerciais', 'Aceite e implantação'],
        requisito: 'Requisito',
        requisitoValor: 'A marca deve possuir registro no INPI de titularidade da Contratante. Toda ocorrência tratada gera registro de evidência — captura de tela, data, canal e identificação do infrator — arquivado e disponibilizado como subsídio a eventual medida judicial.',
        outrosCanais: 'Outros',
        obsProposta: 'Observações',

        contratante: 'Contratante',
        contratada: 'Contratada',
        // Só "Branddi", como nos modelos do time. "Branddi Tecnologia" era nome
        // inventado (24/08/2026): o CNPJ registrado é "Branddi Participações
        // S.A." — mas é holding, e quem fatura pode ser outra entidade. Quando
        // a Jessica confirmar a razão social que assina, entra aqui (com CNPJ).
        // "São Paulo/SP" vem do cabeçalho dos modelos ("São Paulo, XX de ...").
        contratadaValor: 'Branddi — São Paulo/SP',
        marcas: 'Marcas monitoradas',
        servicos: 'Serviços',
        regime: 'Regime',
        regimeValor: 'Mensal recorrente, sem fidelidade',
        valorMensal: 'Valor mensal',
        verClausula: (n) => `ver cláusula ${n}`,
        validade: 'Validade',
        validadeValor: (dias, data) => `${dias} dias corridos, até ${data}`,

        objetivoAbre: (varios) => `O escopo desta proposta responde a ${varios ? 'problemas distintos, que exigem tratamentos próprios' : 'um problema, que exige tratamento próprio'}:`,
        objetivoFecha: (varios, marca) => `Os serviços descritos a seguir endereçam ${varios ? 'cada um deles' : 'esse ponto'} para a marca ${marca}.`,

        modalidadeDe: (produto) => `Modalidade · ${produto}`,
        semModalidade: 'Monitoria e inteligência',

        // ─── Comparação de modalidades ──────────────────────────────
        // Quando a proposta apresenta as DUAS modalidades e o cliente
        // escolhe. A comparação é do CONTRATO inteiro, não produto a
        // produto — ver a nota em render-proposta.js.
        modalidadeOu: (a, b) => `${a} ou ${b}`,
        soEm: (mod) => `só em ${mod}`,
        opcoesModalidade: 'Modalidade',
        opcoesModalidadeNota: 'As duas modalidades cobrem o mesmo escopo de monitoramento. A diferença está na atuação: com ela, a Branddi notifica o infrator e protocola a denúncia; sem ela, a Contratante recebe o dossiê completo e conduz a medida que julgar cabível.',
        mesmoValorNasDuas: 'mesmo valor nas duas',
        idiomaRelatorios: 'Idioma dos relatórios',
        idiomaRelatoriosValor: 'Português',

        entregaveis: 'Entregáveis',
        thEntregavel: 'Entregável',
        thPeriodicidade: 'Periodicidade',
        thCanal: 'Canal',

        thItem: 'Item',
        thEscopo: 'Escopo',
        thMensal: 'Mensal',
        ate: (n) => `Até ${n}`,
        // A unidade da escada, no singular e no plural. Vive aqui, e não na
        // config, porque é TEXTO do documento: em config só existia a versão
        // em português, e uma proposta em inglês saía com "Up to 5 palavras".
        // Golpes Digitais não entra — não tem quantidade contratada.
        unidades: {
            BB: ['palavra', 'palavras'],
            BBP: ['SKU', 'SKUs'],
            VM: ['marketplace simultâneo', 'marketplaces simultâneos'],
        },
        opcoesPacote: 'Combo',
        thOpcao: 'Pacote',
        thComposicao: 'Composição',
        aPartirDe: (v) => `a partir de ${v}`,
        economiaDe: (v) => `economia de ${v}/mês`,
        semDesconto: 'sem desconto',
        opcoesNota: 'Escolha uma das opções acima. Os serviços também podem ser contratados separadamente, pelos valores individuais.',
        pacoteN: (n) => `Opção ${n}`,
        subtotal: 'Subtotal — itens contratados separadamente',
        totalCombinado: 'Valor contratado — condição combinada',
        total: 'Valor contratado',
        descontoDe: (v) => `Desconto de ${v}/mês`,
        setup: 'Setup (implantação)',
        // Não é cobrado (confirmado em 19/08/2026). Os modelos-base dizem
        // "01 mensalidade", mas a proposta que o time envia traz isso riscado:
        // é bonificação. O valor segue escrito pro cliente ver o que está sendo
        // dado — era o que o risco comunicava.
        setupValor: 'Bonificado (01 mensalidade, não cobrada)',
        impostos: 'Impostos',
        impostosValor: 'Valores líquidos; tributos conforme legislação vigente',

        pagamento: 'Condição de pagamento',
        pagamentoValor: 'Mensal, D+30 da emissão da nota fiscal',
        vigencia: 'Vigência',
        // "Renovação automática" saiu em 24/08/2026: só o modelo de VM trazia a
        // expressão, e num contrato mensal sem fidelidade ela não acrescenta
        // nada — só assusta o jurídico do cliente.
        vigenciaValor: 'Indeterminada',
        rescisao: 'Rescisão',
        rescisaoValor: '<strong>Sem fidelidade.</strong> Aviso prévio de 60 dias, sem multa',
        implantacao: 'Prazo de implantação',
        implantacaoValor: '3 dias úteis a contar do aceite',
        validadeProposta: 'Validade da proposta',

        legalP1: 'A legislação brasileira de propriedade industrial assegura ao titular o direito de impedir o uso não autorizado de marca registrada por terceiros. A atuação prevista nesta proposta se apoia nesse direito e no entendimento consolidado dos tribunais quanto à concorrência desleal.',
        legalCitacao: 'Os tribunais brasileiros reconhecem que a utilização de marca registrada de terceiro para desvio de clientela constitui prática de concorrência desleal, podendo gerar a obrigação de abstenção de uso e o dever de indenizar.',
        legalFonte: 'Lei 9.279/96, arts. 129 e 195',
        legalP2: 'Toda ocorrência tratada gera registro de evidência — captura de tela, data, canal e identificação do infrator — arquivado e disponibilizado à Contratante como subsídio a eventual medida judicial. Requisito: a marca deve possuir registro no INPI de titularidade da Contratante.',

        thEtapa: 'Etapa',
        thResponsavel: 'Responsável',
        thPrazo: 'Prazo',
        etapaAceite: 'Aceite formal da proposta',
        etapaEnvio: (insumos) => `Envio de ${insumos}`,
        etapaConfig: 'Configuração de robôs e critérios de triagem',
        etapaPrimeira: 'Primeira entrega de ocorrências',
        etapaReuniao: 'Primeira reunião de acompanhamento',
        respContratante: 'Contratante',
        respAmbas: 'Ambas',
        prazoAte: (d) => `Até ${d}`,
        prazoUteis: 'D+3 úteis',
        // "D+7" saiu em 24/08/2026: nenhum modelo promete prazo pra primeira
        // entrega, e prazo em proposta vira cobrança contratual. O que tem
        // fonte é o início em 3 dias úteis; a entrega vem na sequência.
        prazoAposInicio: 'Após o início do monitoramento',
        insumoINPI: 'comprovante de registro da marca no INPI',

        aceiteTitulo: 'Aceite',
        aceiteAceitaTitulo: 'Proposta aceita',
        aceiteProsa: 'O aceite desta proposta registra o compromisso comercial. A Branddi é notificada e inicia a implantação em 3 dias úteis; o contrato é formalizado em seguida.',
        aceiteNome: 'Nome completo',
        aceiteEmail: 'E-mail corporativo',
        aceiteCargo: 'Cargo',
        aceiteOpcional: '(opcional)',
        aceiteBotao: 'Aceitar proposta',
        aceiteEnviando: 'Enviando…',
        aceiteErro: (m) => `Não consegui registrar: ${m}. Tente de novo ou responda o e-mail do seu contato.`,
        aceitaPor: (nome, cargo, email, quando) => `Aceita por <strong>${nome}</strong>${cargo ? ` — ${cargo}` : ''} (${email}) em <strong>${quando}</strong>.`,
        aceitaNota: 'A Branddi foi notificada e entrará em contato para a implantação.',

        substituidaTitulo: 'Esta versão foi substituída.',
        substituidaTexto: (rev) => `Uma proposta mais recente (revisão ${rev}) foi emitida para esta negociação.`,
        substituidaLink: 'Abrir a versão atual',
        vencidaTitulo: (data) => `Esta proposta venceu em ${data}.`,
        vencidaTexto: 'Os valores e condições precisam ser reconfirmados — fale com seu contato na Branddi para receber uma versão atualizada.',
    },

    // ══════════════════════════════════════════════════════════════════
    // Vocabulário dos documentos que o comercial já tinha em inglês:
    // "Our Protections", "Business Proposal", "Commercial Terms", "Keywords".
    en: {
        locale: 'en-US',
        kicker: 'Technical and commercial proposal',
        emissao: 'Issued',
        validadeCurta: 'Valid until',
        baixarPdf: 'Download PDF',
        baixarPdfDica: 'Opens the PDF in a new tab, ready to save or forward.',
        rodape: 'Fight the misuse of your brand and maximize your results',
        rodapeValida: 'valid until',

        capaEyebrow: 'Technical & commercial proposal',
        tagline: 'Shield your brand.',
        site: 'branddi.com',
        heroCombo: (n) => `Brand protection on ${['', '', 'two', 'three', 'four'][n] || n} fronts`,
        heroConector: 'for',
        pagina: 'p.',
        porMesCurto: '/month',
        clausulasSub: ['Parties and contractual scope', 'The problem this proposal solves',
            'What Branddi monitors and how it acts', 'Recurring monthly values, in BRL',
            'Deliverables, frequency and channel', 'Payment, term and termination',
            'Step · owner · timing'],
        loop: ['Detect', 'Classify', 'Notify', 'Remove'],
        loopMonitoria: ['Detect', 'Classify', 'Document', 'Deliver'],
        avulso: 'Standalone',
        recomendado: 'Recommended',
        pacoteLabel: 'Bundle',
        avulsoDesc: 'Service contracted separately, at its individual price.',
        // Só Brand Bidding, como no português. BBP, GD e VM tinham chamada aqui
        // e NÃO tinham em pt: a copy que esperava aprovação já estava indo pro
        // cliente, em inglês. As três terminavam em "from monitoring to
        // takedown" — promessa de atuação numa capa que não olha a modalidade.
        chamada: {
            BB: 'Win back the traffic other advertisers capture by using your brand name.',
        },
        insight: {
            BB: 'In brand bidding, another advertiser’s ad shows above your organic result — you pay more for your own name, or lose the click.',
        },

        clausulas: ['Identification', 'Purpose of the proposal', 'Approach', 'Investment',
            'Scope and service levels', 'Commercial terms', 'Acceptance and onboarding'],
        requisito: 'Requirement',
        requisitoValor: 'The trademark must be registered with the Brazilian INPI in the Client name. Every occurrence handled generates an evidence record — screenshot, date, channel and identification of the infringer — archived and made available as support for any legal action.',
        outrosCanais: 'Other',
        obsProposta: 'Notes',

        contratante: 'Client',
        contratada: 'Provider',
        contratadaValor: 'Branddi — São Paulo, Brazil',
        marcas: 'Brands monitored',
        servicos: 'Services',
        regime: 'Engagement',
        regimeValor: 'Monthly recurring, no minimum term',
        valorMensal: 'Monthly value',
        verClausula: (n) => `see clause ${n}`,
        validade: 'Validity',
        validadeValor: (dias, data) => `${dias} calendar days, until ${data}`,

        objetivoAbre: (varios) => `The scope of this proposal addresses ${varios ? 'distinct problems, each requiring its own treatment' : 'one problem, requiring its own treatment'}:`,
        objetivoFecha: (varios, marca) => `The services described below address ${varios ? 'each of them' : 'that point'} for the ${marca} brand.`,

        modalidadeDe: (produto) => `Mode · ${produto}`,
        semModalidade: 'Monitoring and intelligence',

        // Ver a nota no bloco em português.
        modalidadeOu: (a, b) => `${a} or ${b}`,
        soEm: (mod) => `${mod} only`,
        opcoesModalidade: 'Service level',
        opcoesModalidadeNota: 'Both service levels cover the same monitoring scope. The difference is enforcement: with it, Branddi notifies the infringer and files the complaint; without it, the Client receives the complete evidence file and takes the action it deems appropriate.',
        mesmoValorNasDuas: 'same price in both',
        idiomaRelatorios: 'Reporting language',
        idiomaRelatoriosValor: 'English',

        entregaveis: 'Deliverables',
        thEntregavel: 'Deliverable',
        thPeriodicidade: 'Frequency',
        thCanal: 'Channel',

        thItem: 'Item',
        thEscopo: 'Scope',
        thMensal: 'Monthly',
        ate: (n) => `Up to ${n}`,
        // Vocabulário do catálogo em inglês: "keywords", "SKUs", marketplaces
        // monitorados simultaneamente.
        unidades: {
            BB: ['keyword', 'keywords'],
            BBP: ['SKU', 'SKUs'],
            VM: ['simultaneous marketplace', 'simultaneous marketplaces'],
        },
        opcoesPacote: 'Bundle',
        thOpcao: 'Bundle',
        thComposicao: 'Composition',
        aPartirDe: (v) => `from ${v}`,
        economiaDe: (v) => `saving of ${v}/month`,
        semDesconto: 'no discount',
        opcoesNota: 'Choose one of the options above. The services may also be contracted separately, at their individual prices.',
        pacoteN: (n) => `Option ${n}`,
        subtotal: 'Subtotal — items contracted separately',
        totalCombinado: 'Contracted value — bundled terms',
        total: 'Contracted value',
        descontoDe: (v) => `Discount of ${v}/month`,
        setup: 'Setup (onboarding)',
        setupValor: 'Waived (one monthly fee, not charged)',
        impostos: 'Taxes',
        impostosValor: 'Net values; taxes as per applicable law',

        pagamento: 'Payment terms',
        pagamentoValor: 'Monthly, 30 days from invoice issuance',
        vigencia: 'Term',
        vigenciaValor: 'Open-ended',
        rescisao: 'Termination',
        rescisaoValor: '<strong>No minimum term.</strong> 60 days written notice, no penalty',
        implantacao: 'Onboarding time',
        implantacaoValor: '3 business days from acceptance',
        validadeProposta: 'Proposal validity',

        legalP1: 'Brazilian industrial property law grants the trademark owner the right to prevent unauthorized use of a registered mark by third parties. The enforcement described in this proposal rests on that right and on the settled understanding of the Brazilian courts regarding unfair competition.',
        legalCitacao: 'Brazilian courts recognize that using a third party’s registered trademark to divert customers constitutes unfair competition, and may give rise to both an obligation to cease use and a duty to compensate.',
        legalFonte: 'Brazilian Law 9.279/96, articles 129 and 195',
        legalP2: 'Every occurrence handled generates an evidence record — screenshot, date, channel and identification of the infringer — archived and made available to the Client as support for any legal action. Requirement: the trademark must be registered with the Brazilian INPI in the Client’s name.',

        thEtapa: 'Step',
        thResponsavel: 'Owner',
        thPrazo: 'Timing',
        etapaAceite: 'Formal acceptance of the proposal',
        etapaEnvio: (insumos) => `Delivery of ${insumos}`,
        etapaConfig: 'Configuration of crawlers and screening criteria',
        etapaPrimeira: 'First delivery of occurrences',
        etapaReuniao: 'First review meeting',
        respContratante: 'Client',
        respAmbas: 'Both',
        prazoAte: (d) => `By ${d}`,
        prazoUteis: 'D+3 business days',
        prazoAposInicio: 'After monitoring starts',
        insumoINPI: 'proof of trademark registration with the Brazilian INPI',

        aceiteTitulo: 'Acceptance',
        aceiteAceitaTitulo: 'Proposal accepted',
        aceiteProsa: 'Accepting this proposal records the commercial commitment. Branddi is notified and onboarding starts within 3 business days; the agreement is formalized next.',
        aceiteNome: 'Full name',
        aceiteEmail: 'Business e-mail',
        aceiteCargo: 'Role',
        aceiteOpcional: '(optional)',
        aceiteBotao: 'Accept proposal',
        aceiteEnviando: 'Sending…',
        aceiteErro: (m) => `Could not record it: ${m}. Please try again or reply to your contact’s e-mail.`,
        aceitaPor: (nome, cargo, email, quando) => `Accepted by <strong>${nome}</strong>${cargo ? ` — ${cargo}` : ''} (${email}) on <strong>${quando}</strong>.`,
        aceitaNota: 'Branddi has been notified and will be in touch to start onboarding.',

        substituidaTitulo: 'This version has been superseded.',
        substituidaTexto: (rev) => `A more recent proposal (revision ${rev}) has been issued for this negotiation.`,
        substituidaLink: 'Open the current version',
        vencidaTitulo: (data) => `This proposal expired on ${data}.`,
        vencidaTexto: 'Values and terms need to be reconfirmed — please contact Branddi for an updated version.',
    },

    // ══════════════════════════════════════════════════════════════════
    // Vocabulário dos documentos que o comercial já tinha em espanhol:
    // "Nuestras Protecciones", "Propuesta Comercial", "Condiciones Comerciales",
    // "Palabras clave: hasta N palabras", "Sin permanencia".
    es: {
        locale: 'es-ES',
        kicker: 'Propuesta técnica y comercial',
        emissao: 'Emisión',
        validadeCurta: 'Validez',
        baixarPdf: 'Descargar en PDF',
        baixarPdfDica: 'Abre el PDF en una pestaña nueva, listo para guardar o enviar.',
        rodape: 'Combata el uso indebido de su marca y maximice sus resultados',
        rodapeValida: 'válida hasta',

        capaEyebrow: 'Propuesta técnica & comercial',
        tagline: 'Blinde su marca.',
        site: 'branddi.com',
        heroCombo: (n) => `Protección de marca en ${['', '', 'dos', 'tres', 'cuatro'][n] || n} frentes`,
        heroConector: 'para',
        pagina: 'pág.',
        porMesCurto: '/mes',
        clausulasSub: ['Partes y alcance contractual', 'El problema que esta propuesta resuelve',
            'Qué monitorea Branddi y cómo actúa', 'Valores mensuales recurrentes, en reales',
            'Entregables, periodicidad y canal', 'Pago, vigencia y rescisión',
            'Etapa · responsable · plazo'],
        loop: ['Detectar', 'Clasificar', 'Notificar', 'Eliminar'],
        loopMonitoria: ['Detectar', 'Clasificar', 'Documentar', 'Entregar'],
        avulso: 'Individual',
        recomendado: 'Recomendado',
        pacoteLabel: 'Paquete',
        avulsoDesc: 'Servicio contratado por separado, a su valor individual.',
        // Só Brand Bidding, como no português — ver a nota no bloco em inglês.
        chamada: {
            BB: 'Recupere el tráfico que otros anunciantes capturan al usar el nombre de su marca.',
        },
        insight: {
            BB: 'En el brand bidding, el anuncio de otro anunciante aparece por encima de su resultado orgánico — usted paga más caro por su propio nombre, o pierde el clic.',
        },

        clausulas: ['Identificación', 'Objeto de la propuesta', 'Enfoque', 'Inversión',
            'Alcance y niveles de servicio', 'Condiciones comerciales', 'Aceptación e implantación'],
        requisito: 'Requisito',
        requisitoValor: 'La marca debe estar registrada en el INPI brasileño a nombre de la Contratante. Cada ocurrencia tratada genera un registro de evidencia — captura de pantalla, fecha, canal e identificación del infractor — archivado y puesto a disposición como respaldo para eventuales medidas judiciales.',
        outrosCanais: 'Otros',
        obsProposta: 'Observaciones',

        contratante: 'Contratante',
        contratada: 'Contratada',
        contratadaValor: 'Branddi — São Paulo, Brasil',
        marcas: 'Marcas monitoreadas',
        servicos: 'Servicios',
        regime: 'Régimen',
        regimeValor: 'Mensual recurrente, sin permanencia',
        valorMensal: 'Valor mensual',
        verClausula: (n) => `ver cláusula ${n}`,
        validade: 'Validez',
        validadeValor: (dias, data) => `${dias} días corridos, hasta ${data}`,

        objetivoAbre: (varios) => `El alcance de esta propuesta responde a ${varios ? 'problemas distintos, que exigen tratamientos propios' : 'un problema, que exige tratamiento propio'}:`,
        objetivoFecha: (varios, marca) => `Los servicios descritos a continuación atienden ${varios ? 'cada uno de ellos' : 'ese punto'} para la marca ${marca}.`,

        modalidadeDe: (produto) => `Modalidad · ${produto}`,
        semModalidade: 'Monitoreo e inteligencia',

        // Ver a nota no bloco em português.
        modalidadeOu: (a, b) => `${a} o ${b}`,
        soEm: (mod) => `solo en ${mod}`,
        opcoesModalidade: 'Modalidad',
        opcoesModalidadeNota: 'Ambas modalidades cubren el mismo alcance de monitoreo. La diferencia está en la actuación: con ella, Branddi notifica al infractor y presenta la denuncia; sin ella, la Contratante recibe el expediente completo y adopta la medida que considere pertinente.',
        mesmoValorNasDuas: 'mismo valor en ambas',
        idiomaRelatorios: 'Idioma de los informes',
        idiomaRelatoriosValor: 'Español',

        entregaveis: 'Entregables',
        thEntregavel: 'Entregable',
        thPeriodicidade: 'Periodicidad',
        thCanal: 'Canal',

        thItem: 'Ítem',
        thEscopo: 'Alcance',
        thMensal: 'Mensual',
        ate: (n) => `Hasta ${n}`,
        // Vocabulário do catálogo em espanhol: "palabras", "SKUs", marketplaces
        // monitoreados simultáneamente.
        unidades: {
            BB: ['palabra', 'palabras'],
            BBP: ['SKU', 'SKUs'],
            VM: ['marketplace simultáneo', 'marketplaces simultáneos'],
        },
        opcoesPacote: 'Paquete',
        thOpcao: 'Paquete',
        thComposicao: 'Composición',
        aPartirDe: (v) => `desde ${v}`,
        economiaDe: (v) => `ahorro de ${v}/mes`,
        semDesconto: 'sin descuento',
        opcoesNota: 'Elija una de las opciones anteriores. Los servicios también pueden contratarse por separado, a sus valores individuales.',
        pacoteN: (n) => `Opción ${n}`,
        subtotal: 'Subtotal — ítems contratados por separado',
        totalCombinado: 'Valor contratado — condición combinada',
        total: 'Valor contratado',
        descontoDe: (v) => `Descuento de ${v}/mes`,
        setup: 'Setup (implantación)',
        setupValor: 'Bonificado (01 mensualidad, no cobrada)',
        impostos: 'Impuestos',
        impostosValor: 'Valores netos; tributos según la legislación vigente',

        pagamento: 'Condición de pago',
        pagamentoValor: 'Mensual, 30 días desde la emisión de la factura',
        vigencia: 'Vigencia',
        vigenciaValor: 'Indeterminada',
        rescisao: 'Rescisión',
        rescisaoValor: '<strong>Sin permanencia.</strong> Aviso previo de 60 días, sin multa',
        implantacao: 'Plazo de implantación',
        implantacaoValor: '3 días hábiles a contar de la aceptación',
        validadeProposta: 'Validez de la propuesta',

        legalP1: 'La legislación brasileña de propiedad industrial garantiza al titular el derecho de impedir el uso no autorizado de una marca registrada por terceros. La actuación prevista en esta propuesta se apoya en ese derecho y en el entendimiento consolidado de los tribunales brasileños sobre competencia desleal.',
        legalCitacao: 'Los tribunales brasileños reconocen que la utilización de la marca registrada de un tercero para desviar clientela constituye competencia desleal, y puede generar tanto la obligación de cesar el uso como el deber de indemnizar.',
        legalFonte: 'Ley brasileña 9.279/96, arts. 129 y 195',
        legalP2: 'Cada ocurrencia tratada genera un registro de evidencia — captura de pantalla, fecha, canal e identificación del infractor — archivado y puesto a disposición de la Contratante como respaldo para eventuales medidas judiciales. Requisito: la marca debe estar registrada en el INPI brasileño a nombre de la Contratante.',

        thEtapa: 'Etapa',
        thResponsavel: 'Responsable',
        thPrazo: 'Plazo',
        etapaAceite: 'Aceptación formal de la propuesta',
        etapaEnvio: (insumos) => `Envío de ${insumos}`,
        etapaConfig: 'Configuración de robots y criterios de clasificación',
        etapaPrimeira: 'Primera entrega de ocurrencias',
        etapaReuniao: 'Primera reunión de seguimiento',
        respContratante: 'Contratante',
        respAmbas: 'Ambas',
        prazoAte: (d) => `Hasta ${d}`,
        prazoUteis: 'D+3 hábiles',
        prazoAposInicio: 'Tras el inicio del monitoreo',
        insumoINPI: 'comprobante de registro de la marca en el INPI brasileño',

        aceiteTitulo: 'Aceptación',
        aceiteAceitaTitulo: 'Propuesta aceptada',
        aceiteProsa: 'La aceptación de esta propuesta registra el compromiso comercial. Branddi es notificada e inicia la implantación en 3 días hábiles; el contrato se formaliza a continuación.',
        aceiteNome: 'Nombre completo',
        aceiteEmail: 'Correo corporativo',
        aceiteCargo: 'Cargo',
        aceiteOpcional: '(opcional)',
        aceiteBotao: 'Aceptar propuesta',
        aceiteEnviando: 'Enviando…',
        aceiteErro: (m) => `No pude registrarlo: ${m}. Inténtelo de nuevo o responda el correo de su contacto.`,
        aceitaPor: (nome, cargo, email, quando) => `Aceptada por <strong>${nome}</strong>${cargo ? ` — ${cargo}` : ''} (${email}) el <strong>${quando}</strong>.`,
        aceitaNota: 'Branddi fue notificada y se pondrá en contacto para la implantación.',

        substituidaTitulo: 'Esta versión fue reemplazada.',
        substituidaTexto: (rev) => `Se emitió una propuesta más reciente (revisión ${rev}) para esta negociación.`,
        substituidaLink: 'Abrir la versión actual',
        vencidaTitulo: (data) => `Esta propuesta venció el ${data}.`,
        vencidaTexto: 'Los valores y condiciones deben reconfirmarse — hable con su contacto en Branddi para recibir una versión actualizada.',
    },
};

/**
 * As condições que o formulário deixa o closer mudar. A chave é o campo do
 * spec; o valor é o texto padrão, no idioma. Sai preenchido na tela — o closer
 * só toca no que foi negociado, e o que não tocar continua sendo a condição
 * padrão da Branddi.
 */
export const CONDICOES_EDITAVEIS = ['pagamento', 'vigencia', 'rescisao', 'implantacao', 'setup', 'validadeDias'];

/**
 * A validade padrão, em DIAS. É o único número entre as condições — vive aqui,
 * junto do texto que o documento escreve com ele, e não duplicado no
 * renderizador. O closer altera pelo formulário; o documento continua
 * calculando a data a partir da emissão, então uma proposta regerada dias
 * depois não nasce vencida.
 */
export const VALIDADE_DIAS_PADRAO = 15;

/** Os textos padrão das condições editáveis, num idioma. */
export function condicoesPadrao(idioma) {
    const t = TEXTOS[idioma] || TEXTOS.pt;
    return {
        pagamento: { rotulo: t.pagamento, valor: t.pagamentoValor },
        vigencia: { rotulo: t.vigencia, valor: t.vigenciaValor },
        rescisao: { rotulo: t.rescisao, valor: t.rescisaoValor },
        implantacao: { rotulo: t.implantacao, valor: t.implantacaoValor },
        setup: { rotulo: t.setup, valor: t.setupValor },
        // `dias` no lugar de `valor` é o que diz ao formulário que este campo é
        // número, não texto livre: a data e o aviso de vencida dependem dele.
        validadeDias: { rotulo: t.validadeProposta, dias: VALIDADE_DIAS_PADRAO },
    };
}

/** O vocabulário do idioma, ou o português se o idioma não existir. */
export function textosDoDocumento(idioma) {
    return TEXTOS[idioma] || TEXTOS.pt;
}

/** A modalidade escrita no idioma do documento. O spec guarda em português. */
export function modalidadeNoIdioma(modalidade, idioma) {
    if (!modalidade) return null;
    return MODALIDADE_TRADUZIDA[idioma]?.[modalidade] || modalidade;
}
