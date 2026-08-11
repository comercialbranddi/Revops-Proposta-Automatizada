/**
 * Preenche os quatro JSON de tradução para o espanhol.
 *
 * Vocabulário tirado dos documentos que o comercial já tinha
 * (Propuesta_Branddi_BB e _BB_FR): "Nuestras Protecciones", "Propuesta
 * Comercial", "Protección Brand Bidding", "Palabras clave: Hasta N palabras".
 *
 * Uma escolha deliberada de conteúdo: mantive "tribunales brasileños" onde o
 * documento antigo dizia só "los tribunales". Todo o enquadramento jurídico do
 * texto é brasileiro (INPI, legislação brasileira de propriedade intelectual),
 * então omitir o país deixa a frase ambígua para um cliente de fora.
 */
import fs from 'node:fs';

const COMUM = {
  "São Paulo, XX de [mês] de [ano].": "São Paulo, Brasil, {{DATA}}.",
  "Para: {{MARCA}}": "Para: {{MARCA}}",
  "Prezados,": "Estimados,",
  "Nossas Proteções": "Nuestras Protecciones",
  "Especificações": "Especificaciones",
  "Marca a ser monitorada:": "Marca a ser monitoreada:",
  "{{MARCA}}": "{{MARCA}}",
  "{{MARCA}} ": "{{MARCA}} ",
  "Plataformas Monitoradas: ": "Plataformas Monitoreadas: ",
  "Frequência do Monitoramento: ": "Frecuencia del Monitoreo: ",
  "Diário": "Diario",
  "Aspectos do Monitoramento:": "Aspectos del Monitoreo:",
  "Identificar:": "Identificar:",
  "Entregáveis ": "Entregables ",
  "Setup (Onboarding):": "Setup (Onboarding):",
  "Formas de atuação:": "Formas de actuación:",
  "Proposta Comercial ": "Propuesta Comercial ",
  "Condições Comerciais": "Condiciones Comerciales",
  "Setup: 01 mensalidade": "Setup: 01 mensualidad",
  "Limite de denúncias/mediações: Sem limite.": "Límite de denuncias/mediaciones: Sin límite.",
  "Prazo para início do monitoramento: 3 dias úteis.": "Plazo para inicio del monitoreo: 3 días hábiles.",
  "Condição de pagamento: Mensal - D+30 da emissão da NF": "Condición de pago: Mensual - D+30 de la emisión de la factura",
  "Duração do contrato:  Contrato sem fidelidade, com aviso prévio de 60 dias para cancelamento sem multa":
    "Duración del contrato: Contrato sin permanencia, con aviso previo de 60 días para cancelación sin multa",
  "Proposta Válida por 15 dias": "Propuesta válida por 15 días",
  "Branddi – Combata o uso indevido da sua marca e maximize seus resultados":
    "Branddi – Combata el uso indebido de su marca y maximice sus resultados",
  "Apresentamos nossa proposta comercial para prestação de serviços especializados em monitoramento da marca {{MARCA}} no ambiente digital, visando proteger seus direitos de propriedade intelectual. Este serviço será executado pela Branddi, aliando a tecnologia de ponta da nossa ferramenta e a expertise para combater o desvio de clientela e maximizar seus esforços de construção de marca.":
    "Presentamos nuestra propuesta comercial para la prestación de servicios especializados en el monitoreo de la marca {{MARCA}} en el entorno digital, con el objetivo de proteger sus derechos de propiedad intelectual. Este servicio será ejecutado por Branddi, combinando la tecnología de punta de nuestra herramienta y la experiencia necesaria para combatir el desvío de clientes y maximizar sus esfuerzos de construcción de marca.",
  "Apresentamos nossa proposta comercial para prestação de serviços especializados em monitoramento das marcas da {{MARCA}} no ambiente digital, visando proteger seus direitos de propriedade intelectual. Este serviço será executado pela Branddi, aliando a tecnologia de ponta da nossa ferramenta e a expertise para combater o desvio de clientela e maximizar seus esforços de construção de marca.":
    "Presentamos nuestra propuesta comercial para la prestación de servicios especializados en el monitoreo de las marcas de {{MARCA}} en el entorno digital, con el objetivo de proteger sus derechos de propiedad intelectual. Este servicio será ejecutado por Branddi, combinando la tecnología de punta de nuestra herramienta y la experiencia necesaria para combatir el desvío de clientes y maximizar sus esfuerzos de construcción de marca.",
  "Reunião mensal: onde apresentamos relatório das violações por canal, taxa de sucesso e impacto financeiro estimado e as oportunidades identificadas para aprimorar o ambiente de proteção de marca":
    "Reunión mensual: donde presentamos el informe de violaciones por canal, tasa de éxito, impacto financiero estimado y las oportunidades identificadas para mejorar el entorno de protección de la marca",
  "Relatório semanal: Enviado por e-mail relatório com situação das ocorrências que estão sendo tratadas. O cliente poderá customizar este relatório dentre as informações disponíveis pelo monitoramento.":
    "Informe semanal: se envía por correo electrónico un informe con la situación de las incidencias que se están tratando. El cliente podrá personalizar este informe entre las informaciones disponibles del monitoreo.",
  "A marca deve possuir o devido registro no INPI de titularidade do cliente;":
    "La marca debe contar con el debido registro en el INPI (Instituto Nacional de la Propiedad Industrial de Brasil) a nombre del cliente;",
  "Ativação e configuração de robôs de monitoramento;": "Activación y configuración de robots de monitoreo;",
};

const BB = {
  "Brand Bidding": "Brand Bidding",
  "Através do monitoramento de marca no Google, nosso objetivo é localizar e informar quais outras marcas, entidades ou empresas, concorrentes ou não, estão utilizando a marca  {{MARCA}} como palavra de busca para anunciar marcas, produtos e serviços.":
    "A través del monitoreo de marca en Google, nuestro objetivo es localizar e informar qué otras marcas, entidades o empresas, competidoras o no, están utilizando la marca {{MARCA}} como palabra de búsqueda para anunciar marcas, productos y servicios.",
  "Ao identificarmos anunciantes realizando estas práticas com sua marca, executamos o serviço de assessoria jurídica que contempla a redação, envio e acompanhamento de notificações extrajudiciais com o objetivo de desestimular o uso ilícito da marca e fornecer subsídios para eventual proposição de ação judicial.":
    "Al identificar anunciantes realizando estas prácticas con su marca, ejecutamos el servicio de asesoría jurídica que contempla la redacción, envío y seguimiento de notificaciones extrajudiciales con el objetivo de desincentivar el uso ilícito de la marca y proporcionar fundamentos para una eventual interposición de acción judicial.",
  "Atualmente os tribunais brasileiros reconhecem que a utilização de marcas registradas de terceiros para o desvio de clientela por meio de links patrocinados, constitui prática de concorrência desleal e pode gerar a obrigação de abstenção de uso e o dever de indenizar.":
    "Actualmente, los tribunales brasileños reconocen que la utilización de marcas registradas de terceros para el desvío de clientes por medio de enlaces patrocinados constituye una práctica de competencia desleal y puede generar la obligación de abstención de uso y el deber de indemnizar.",
  "Portanto, a conduta de utilização de marca de terceiros em links patrocinados pode constituir prática de concorrência desleal, uma vez que tem o potencial de desviar clientela de forma ilícita, bem como gerar confusão entre os consumidores.":
    "Por lo tanto, la conducta de utilizar marcas de terceros en enlaces patrocinados puede constituir una práctica de competencia desleal, ya que tiene el potencial de desviar clientes de forma ilícita, así como generar confusión entre los consumidores.",
  "Plataforma(s) Monitorada(s): ": "Plataforma(s) Monitoreada(s): ",
  "{{CANAIS_BB}}": "{{CANAIS_BB}}",
  "Diária, em horários diversos.": "Diaria, en horarios diversos.",
  "Aspectos do Monitoramento": "Aspectos del Monitoreo",
  "Serão monitoradas e capturadas as seguintes informações de cada anúncio encontrado nos resultados de busca:":
    "Se monitorearán y capturarán las siguientes informaciones de cada anuncio encontrado en los resultados de búsqueda:",
  "Palavra monitorada": "Palabra monitoreada",
  "Data do monitoramento": "Fecha del monitoreo",
  "Geolocalização": "Geolocalización",
  "Tipo de ambiente – desktop / mobile": "Tipo de entorno – desktop / móvil",
  "Posição do anúncio em tela": "Posición del anuncio en pantalla",
  "Título do anúncio": "Título del anuncio",
  "Link do anúncio": "Enlace del anuncio",
  "Link de resultado do site de busca": "Enlace de resultado del buscador",
  "Marca anunciada": "Marca anunciada",
  "Domínio exibido no anúncio": "Dominio mostrado en el anuncio",
  "Link apresentado no anúncio": "Enlace presentado en el anuncio",
  "Descrição apresentada no anúncio": "Descripción presentada en el anuncio",
  "Captura de tela da evidência da busca efetuada": "Captura de pantalla de la evidencia de la búsqueda realizada",
  "Entregáveis": "Entregables",
  "Relatório diário: as informações do monitoramento serão entregues diariamente no período da manhã, via e-mail, no formato de relatório PDF anexado ao e-mail.":
    "Informe diario: las informaciones del monitoreo se entregarán diariamente por la mañana, vía correo electrónico, en formato de informe PDF adjunto.",
  "Triagem semanal: Envio semanal relacionando as violações identificadas para o cliente aprovar a atuação. Nenhuma notificação ou denúncia será realizada sem aprovação expressa do cliente para cada um dos links":
    "Revisión semanal: envío semanal relacionando las violaciones identificadas para que el cliente apruebe la actuación. Ninguna notificación o denuncia se realizará sin la aprobación expresa del cliente para cada uno de los enlaces",
  "Envio de Notificações: ": "Envío de Notificaciones: ",
  "Envio de avisos de violação de marca para os infratores, buscando uma solução amistosa. ":
    "Envío de avisos de violación de marca a los infractores, buscando una solución amistosa. ",
  "Denúncia: ": "Denuncia: ",
  "No caso de ocorrências classificadas como Suspeita de Fraude ou Violação de Marca, protocolamos as denúncias na plataforma pedindo a remoção dos referidos conteúdos;":
    "En casos clasificados como Sospecha de Fraude o Violación de Marca, protocolamos las denuncias en la plataforma solicitando la eliminación de dichos contenidos;",
  "No caso de ocorrências de Suspeita de Fraude, onde o agressor cria um site com fins fraudulentos, protocolamos a denúncia junto ao serviço de hospedagem do respectivo site":
    "En el caso de incidencias de Sospecha de Fraude, donde el infractor crea un sitio web con fines fraudulentos, protocolamos la denuncia ante el servicio de alojamiento (hosting) del sitio correspondiente",
  "1 - Proteção Brand Bidding": "1 - Protección Brand Bidding",
  "Proposta: {{PRECO_BB}}  ": "Propuesta: {{PRECO_BB}}  ",
  "Palavras-chave: Até {{PALAVRAS_BB}} palavras.": "Palabras clave: hasta {{PALAVRAS_BB}} palabras.",
};

const BBP = {
  "Buy Box Protection ": "Buy Box Protection ",
  "O serviço de Buy Box Protection da Branddi é voltado à governança da conversão dos produtos da marca no {{CANAIS_BBP}}, atuando sobre a dinâmica do Buy Box para reduzir o desvio de vendas para sellers não autorizados e garantir maior previsibilidade de performance para a Loja Oficial.":
    "El servicio de Buy Box Protection de Branddi está orientado a la gobernanza de la conversión de los productos de la marca en {{CANAIS_BBP}}, actuando sobre la dinámica del Buy Box para reducir el desvío de ventas hacia sellers no autorizados y garantizar mayor previsibilidad de desempeño para la Tienda Oficial.",
  "Diferente de abordagens focadas exclusivamente em preço, o Buy Box Protection tem como objetivo oferecer visibilidade, controle e inteligência sobre quem disputa a posição de compra dos produtos da marca, permitindo atuação estratégica e alinhada às políticas comerciais e de canal.":
    "A diferencia de enfoques centrados exclusivamente en el precio, Buy Box Protection tiene como objetivo ofrecer visibilidad, control e inteligencia sobre quién disputa la posición de compra de los productos de la marca, permitiendo una actuación estratégica y alineada con las políticas comerciales y de canal.",
  "Objetivos": "Objetivos",
  "Proteção da conversão da marca: Reduzir o desvio de vendas para sellers não autorizados dentro do Buy Box.":
    "Protección de la conversión de la marca: reducir el desvío de ventas hacia sellers no autorizados dentro del Buy Box.",
  "Governança do canal marketplace: Garantir maior controle sobre quem disputa a posição de compra dos produtos da marca.":
    "Gobernanza del canal marketplace: garantizar mayor control sobre quién disputa la posición de compra de los productos de la marca.",
  "Preservação de margem e política comercial: Evitar guerras de preço desnecessárias e desalinhadas à estratégia da marca.":
    "Preservación del margen y de la política comercial: evitar guerras de precios innecesarias y desalineadas con la estrategia de la marca.",
  "Melhoria da experiência do consumidor: Reduzir confusão no momento da compra e riscos reputacionais.":
    "Mejora de la experiencia del consumidor: reducir la confusión en el momento de la compra y los riesgos reputacionales.",
  "Previsibilidade de performance: Apoiar a tomada de decisão com dados claros sobre a dinâmica do Buy Box.":
    "Previsibilidad de desempeño: apoyar la toma de decisiones con datos claros sobre la dinámica del Buy Box.",
  "{{CANAIS_BBP}}": "{{CANAIS_BBP}}",
  "Sellers que disputam o Buy Box dos produtos da marca;": "Sellers que disputan el Buy Box de los productos de la marca;",
  "Posição da Loja Oficial no Buy Box;": "Posición de la Tienda Oficial en el Buy Box;",
  "Reincidência e padrões de disputa no Buy Box;": "Reincidencia y patrones de disputa en el Buy Box;",
  "Informações associadas aos sellers (perfil, histórico, relevância).": "Informaciones asociadas a los sellers (perfil, historial, relevancia).",
  "Classificação das ocorrências com base em critérios de relevância e comportamento comercial, realizada pela equipe especializada da Branddi.":
    "Clasificación de las incidencias con base en criterios de relevancia y comportamiento comercial, realizada por el equipo especializado de Branddi.",
  "Definição do portfólio de SKUs monitorados;": "Definición del portafolio de SKUs monitoreados;",
  "Configuração dos robôs de monitoramento do Buy Box;": "Configuración de los robots de monitoreo del Buy Box;",
  "Alinhamento de critérios de análise e priorização;": "Alineación de criterios de análisis y priorización;",
  "Integração com políticas comerciais da marca.": "Integración con las políticas comerciales de la marca.",
  "Apoio à identificação de sellers não autorizados;": "Apoyo en la identificación de sellers no autorizados;",
  "Cruzamento das informações coletadas com bases fornecidas pelo cliente;": "Cruce de las informaciones recolectadas con bases proporcionadas por el cliente;",
  "Suporte à atuação comercial da marca junto aos canais e parceiros.": "Soporte a la actuación comercial de la marca ante canales y socios.",
  "Reunião mensal: Apresentação dos principais achados; Discussão de cenários e oportunidades de melhoria; Recomendações estratégicas de governança do Buy Box.":
    "Reunión mensual: presentación de los principales hallazgos; discusión de escenarios y oportunidades de mejora; recomendaciones estratégicas de gobernanza del Buy Box.",
  "1 - Proteção Buy Box Protection": "1 - Protección Buy Box Protection",
  "Proposta: {{PRECO_BBP}}  ": "Propuesta: {{PRECO_BBP}}  ",
  "Até {{CATALOGO_BBP}} SKUs": "Hasta {{CATALOGO_BBP}} SKUs",
};

const GD = {
  "Fraudes Digitais e Impersonação de Marca": "Fraudes Digitales y Suplantación de Marca",
  "Nosso serviço de Proteção Contra Fraudes Digitais e Impersonação de Marca é essencial para combater e neutralizar ameaças digitais que simulam ou clonam a identidade de marcas reconhecidas para prejudicar tanto a marca quanto seus consumidores. Utilizamos tecnologia avançada de monitoramento em uma ampla gama de plataformas digitais, assegurando que qualquer uso fraudulento ou malicioso da marca seja prontamente identificado e denunciado.":
    "Nuestro servicio de Protección Contra Fraudes Digitales y Suplantación de Marca es esencial para combatir y neutralizar amenazas digitales que simulan o clonan la identidad de marcas reconocidas para perjudicar tanto a la marca como a sus consumidores. Utilizamos tecnología avanzada de monitoreo en una amplia gama de plataformas digitales, asegurando que cualquier uso fraudulento o malicioso de la marca sea identificado y denunciado rápidamente.",
  "Objetivos:": "Objetivos:",
  "Preservar a Reputação da Marca: Proteger a imagem da marca contra associações com atividades fraudulentas ou maliciosas.":
    "Preservar la Reputación de la Marca: proteger la imagen de la marca contra asociaciones con actividades fraudulentas o maliciosas.",
  "Prevenir Fraudes: Identificar e neutralizar atividades fraudulentas que prejudicam tanto a marca quanto seus clientes, como esquemas de phishing e golpes.":
    "Prevenir Fraudes: identificar y neutralizar actividades fraudulentas que perjudican tanto a la marca como a sus clientes, tales como esquemas de phishing y estafas.",
  "Manter a Confiança do Cliente: Garantir que os consumidores possam confiar na autenticidade das comunicações e interações da marca.":
    "Mantener la Confianza del Cliente: garantizar que los consumidores puedan confiar en la autenticidad de las comunicaciones e interacciones de la marca.",
  "Registradores de Domínio: Monitoramos mais de 2800 registradores de domínios em todo o mundo para detectar registros suspeitos e prevenir ações de cybersquatting que possam confundir ou enganar consumidores e prejudicar a reputação da marca.":
    "Registradores de Dominio: monitoreamos más de 2.800 registradores de dominios en todo el mundo para detectar registros sospechosos y prevenir acciones de cybersquatting que puedan confundir o engañar a los consumidores y perjudicar la reputación de la marca.",
  "Tipos de Domínios: Abrangemos uma vasta gama de domínios, incluindo mais de 746 TLDs (Top-Level Domains) e 1510 ccTLDs (Country Code Top-Level Domains), para uma cobertura completa em diferentes regiões geográficas e setores de mercado.":
    "Tipos de Dominios: abarcamos una amplia gama de dominios, incluyendo más de 746 TLDs (Top-Level Domains) y 1.510 ccTLDs (Country Code Top-Level Domains), para una cobertura completa en diferentes regiones geográficas y sectores de mercado.",
  "Criação de Domínios: Monitoramos aproximadamente 250.000 novos domínios criados diariamente, analisando rapidamente qualquer potencial uso indevido que possa estar associado a atividades fraudulentas.":
    "Creación de Dominios: monitoreamos aproximadamente 250.000 nuevos dominios creados diariamente, analizando rápidamente cualquier potencial uso indebido que pueda estar asociado a actividades fraudulentas.",
  "Plataformas de E-commerce: Canal direto com centenas de plataformas de e-commerce":
    "Plataformas de E-commerce: canal directo con cientos de plataformas de e-commerce",
  "Plataformas de Checkout / Carrinho: Canal direto com centenas de plataformas de gerenciamento de checkout e gateways de pagamento para agir rapidamente no bloqueio de métodos de pagamento..":
    "Plataformas de Checkout / Carrito: canal directo con cientos de plataformas de gestión de checkout y pasarelas de pago para actuar rápidamente en el bloqueo de métodos de pago.",
  "Provedores de Hospedagem: Canal direto com provedores de hospedagem para desativar sites fraudulentos que possam estar hospedando conteúdo prejudicial ou enganoso.":
    "Proveedores de Alojamiento: canal directo con proveedores de hosting para desactivar sitios fraudulentos que puedan estar alojando contenido perjudicial o engañoso.",
  "Plataformas de Anúncios: Incluímos monitoramento contínuo de bibliotecas de anúncios e resultados de pesquisa patrocinados, garantindo que anúncios falsos ou enganosos não sejam utilizados para desviar tráfego ou prejudicar a integridade da marca.":
    "Plataformas de Anuncios: incluimos monitoreo continuo de bibliotecas de anuncios y resultados de búsqueda patrocinados, garantizando que anuncios falsos o engañosos no sean utilizados para desviar tráfico o perjudicar la integridad de la marca.",
  "Monitoramento contínuo": "Monitoreo continuo",
  "Métodos de Impersonação Monitorados:": "Métodos de Suplantación Monitoreados:",
  "Contas Falsas nas Redes Sociais: Criação de perfis falsos que imitam as contas oficiais da marca, usados para disseminar desinformação ou golpes.":
    "Cuentas Falsas en Redes Sociales: creación de perfiles falsos que imitan las cuentas oficiales de la marca, usados para difundir desinformación o estafas.",
  "Websites Falsos: Sites que se assemelham ao site oficial da marca, muitas vezes usados para aplicar golpes ou capturar dados de clientes.":
    "Sitios Web Falsos: sitios que se asemejan al sitio oficial de la marca, muchas veces usados para cometer estafas o capturar datos de clientes.",
  "Uso de Domínios Falsos: Registro de nomes de domínio que se assemelham ao site oficial da marca com a intenção de induzir ao erro ou lucrar com a confusão da marca.":
    "Uso de Dominios Falsos: registro de nombres de dominio que se asemejan al sitio oficial de la marca con la intención de inducir a error o lucrar con la confusión de la marca.",
  "Anúncios Falsos nas Redes Sociais: Publicação de anúncios enganosos que parecem ser da marca, mas direcionam para sites maliciosos ou golpes.":
    "Anuncios Falsos en Redes Sociales: publicación de anuncios engañosos que parecen ser de la marca, pero dirigen a sitios maliciosos o estafas.",
  "Anúncios de Resultados Patrocinados em Mecanismos de Pesquisa: Monitoramento de anúncios que utilizam indevidamente o nome da marca em resultados patrocinados, desviando tráfego e potencialmente prejudicando a imagem da marca":
    "Anuncios de Resultados Patrocinados en Buscadores: monitoreo de anuncios que utilizan indebidamente el nombre de la marca en resultados patrocinados, desviando tráfico y potencialmente perjudicando la imagen de la marca",
  "Triagem e Categorização das Ocorrências: Nossa equipe especializada em Brand Strategy realiza a filtragem para identificar falsos positivos e categorizar as ocorrências. Esta triagem é crucial para determinar a abordagem correta para cada tipo de ameaça detectada.":
    "Filtro y Categorización de las Incidencias: nuestro equipo especializado en Brand Strategy realiza el filtrado para identificar falsos positivos y categorizar las incidencias. Este filtro es crucial para determinar el enfoque correcto para cada tipo de amenaza detectada.",
  "Definição das regras de triagem e classificação junto ao cliente.": "Definición de las reglas de filtro y clasificación junto al cliente.",
  "Triagem Diária: Envio diário de relatórios listando todas as ameaças identificadas, sujeitas à aprovação do cliente antes de prosseguir com qualquer ação. Opção de takedown automatizado disponível mediante aprovação expressa e fornecimento de uma safelist pelo cliente.":
    "Filtro diario: envío diario de informes listando todas las amenazas identificadas, sujetas a la aprobación del cliente antes de proceder con cualquier acción. Opción de takedown automatizado disponible mediante aprobación expresa y provisión de una safelist por parte del cliente.",
  "Relatório semanal: Relatórios semanais enviados por e-mail com o status das ameaças que estão sendo tratadas, permitindo ao cliente customizar as informações conforme sua necessidade.":
    "Informe semanal: informes semanales enviados por correo electrónico con el estado de las amenazas que se están tratando, permitiendo al cliente personalizar las informaciones según su necesidad.",
  "Denúncias e Remoções: Executamos denúncias em todas as entidades e plataformas envolvidas para solicitar a remoção de conteúdos infratores ou bloqueio de domínios fraudulentos.":
    "Denuncias y Remociones: ejecutamos denuncias ante todas las entidades y plataformas involucradas para solicitar la eliminación de contenidos infractores o el bloqueo de dominios fraudulentos.",
  "Safelist: O cliente pode fornecer uma lista de URLs, domínios e perfis oficiais que serão incluídos numa safelist para otimizar a automação das ações de monitoramento e remoção.":
    "Safelist: el cliente puede proporcionar una lista de URLs, dominios y perfiles oficiales que serán incluidos en una safelist para optimizar la automatización de las acciones de monitoreo y remoción.",
  "Assessoria para Disputas de Domínios: Facilitamos a intermediação de disputas de nomes de domínios com escritórios parceiros ou escolhidos pelo cliente, abrangendo desde câmaras de arbitragem até ações judiciais para casos não resolvidos pelas vias administrativas.":
    "Asesoría para Disputas de Dominios: facilitamos la intermediación de disputas de nombres de dominio con despachos socios o elegidos por el cliente, abarcando desde cámaras de arbitraje hasta acciones judiciales para casos no resueltos por las vías administrativas.",
  "1 - Proteção Fraude": "1 - Protección Fraude",
  "Proposta:": "Propuesta:",
  "{{PRECO_GD}}": "{{PRECO_GD}}",
  "Plataformas: {{CANAIS_GD}}": "Plataformas: {{CANAIS_GD}}",
};

const VM = {
  "Violação de Propriedade Intelectual": "Violación de Propiedad Intelectual",
  "O serviço de proteção contra violação de propriedade intelectual da Branddi é projetado para identificar e mitigar proativamente o uso indevido de suas marcas registradas nas principais plataformas de venda online. Nosso objetivo primordial é localizar vendedores, empresas ou entidades que possam estar utilizando, intencional ou inadvertidamente, marcas de terceiros para promover ou vender produtos e serviços.":
    "El servicio de protección contra violación de propiedad intelectual de Branddi está diseñado para identificar y mitigar proactivamente el uso indebido de sus marcas registradas en las principales plataformas de venta online. Nuestro objetivo primordial es localizar vendedores, empresas o entidades que puedan estar utilizando, intencional o inadvertidamente, marcas de terceros para promover o vender productos y servicios.",
  "Com base em ocorrências encontradas pelo nosso sistema de monitoramento, tomamos medidas adequadas para comunicar as violações às respectivas plataformas de venda, buscando a remoção de listagens inapropriadas ou a correção dos anúncios que possam estar infringindo os seus direitos de propriedade intelectual.":
    "Con base en las incidencias encontradas por nuestro sistema de monitoreo, tomamos las medidas adecuadas para comunicar las violaciones a las respectivas plataformas de venta, buscando la eliminación de listados inapropiados o la corrección de los anuncios que puedan estar infringiendo sus derechos de propiedad intelectual.",
  "De acordo com a legislação brasileira de propriedade intelectual, os titulares de marcas têm o direito inalienável de proteger sua marca contra usos não autorizados. A proteção de sua marca não é apenas um direito, mas uma responsabilidade para garantir a autenticidade e a confiança que os consumidores depositam em seus produtos e serviços. Nossos serviços são moldados para ajudá-lo a exercer esse direito e garantir que sua marca permaneça única e inconfundível no mercado.":
    "De acuerdo con la legislación brasileña de propiedad intelectual, los titulares de marcas tienen el derecho inalienable de proteger su marca contra usos no autorizados. La protección de su marca no es solo un derecho, sino también una responsabilidad para garantizar la autenticidad y la confianza que los consumidores depositan en sus productos y servicios. Nuestros servicios están diseñados para ayudarlo a ejercer ese derecho y garantizar que su marca permanezca única e inconfundible en el mercado.",
  "{{CANAIS_VM}}": "{{CANAIS_VM}}",
  "anúncios de produtos que utilizam termos da marca no título ou conteúdo da oferta;":
    "anuncios de productos que utilizan términos de la marca en el título o contenido de la oferta;",
  "perfis em redes sociais que utilizem a marca no nome do usuário ou elementos gráficos da marca na foto de perfil.":
    "perfiles en redes sociales que utilicen la marca en el nombre de usuario o elementos gráficos de la marca en la foto de perfil.",
  "anúncios em metaads que utilizem termos da marca no conteúdo do anúncio":
    "anuncios en Meta Ads que utilicen términos de la marca en el contenido del anuncio",
  "Triagem e categorização das ocorrências para determinar o tipo de violação. Esse trabalho é realizado pela nossa equipe de especialistas em Brand Strategy, trazendo a indicação de qual tratativa poderá ser adotada conforme o tipo de violação.":
    "Filtro y categorización de las incidencias para determinar el tipo de violación. Este trabajo lo realiza nuestro equipo de especialistas en Brand Strategy, indicando qué tratamiento podrá adoptarse según el tipo de violación.",
  "Definição das regras de triagem e classificação junto ao cliente;": "Definición de las reglas de filtro y clasificación junto al cliente;",
  "Customização dos modelos de aviso.": "Personalización de los modelos de aviso.",
  "Triagem semanal: Envio semanal relacionando as violações identificadas para o cliente aprovar a atuação. Nenhum aviso de violação ou denúncia será iniciado sem aprovação expressa do cliente para cada um dos links":
    "Revisión semanal: envío semanal relacionando las violaciones identificadas para que el cliente apruebe la actuación. Ningún aviso de violación o denuncia se iniciará sin la aprobación expresa del cliente para cada uno de los enlaces",
  "Aviso de Violação: ": "Aviso de Violación: ",
  "Envio de avisos de violação de marca para os infratores, buscando uma solução amistosa. ":
    "Envío de avisos de violación de marca a los infractores, buscando una solución amistosa. ",
  "Os avisos poderão ser enviados via mensagem de chat, através do próprio perfil da Branddi diretamente aos infratores, quando disponibilizado o canal pela plataforma. ":
    "Los avisos podrán ser enviados vía mensaje de chat, a través del propio perfil de Branddi directamente a los infractores, cuando la plataforma disponga del canal. ",
  "Denúncia: ": "Denuncia: ",
  "No caso de ocorrências classificadas como suspeita de Falsificação ou Uso Ilegal da Marca, ou não resolvidas de maneira amigável através dos avisos de violação, protocolamos as denúncias nas plataformas pedindo a remoção dos referidos conteúdos;":
    "En el caso de incidencias clasificadas como sospecha de Falsificación o Uso Ilegal de la Marca, o no resueltas de manera amistosa a través de los avisos de violación, protocolamos las denuncias en las plataformas solicitando la eliminación de dichos contenidos;",
  "1 - Proteção Violação de marca": "1 - Protección Violación de Marca",
  "Proposta: {{PRECO_VM}}": "Propuesta: {{PRECO_VM}}",
  "Plataformas: {{CANAIS_VM}}": "Plataformas: {{CANAIS_VM}}",
};

// A linha de pagamento do VM tem um vertical tab no meio (quebra dentro do
// parágrafo). Precisa sobreviver, senão as duas linhas viram uma.
const VT = String.fromCharCode(11);
VM[`Condição de pagamento: Mensal - D+30 da emissão da NF${VT}Renovação automática.`] =
  `Condición de pago: Mensual - D+30 de la emisión de la factura${VT}Renovación automática.`;

const MAPAS = { BB: { ...COMUM, ...BB }, BBP: { ...COMUM, ...BBP }, GD: { ...COMUM, ...GD }, VM: { ...COMUM, ...VM } };

for (const [produto, T] of Object.entries(MAPAS)) {
  const p = new URL(`./${produto}.json`, import.meta.url);
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const faltando = [];
  let n = 0;
  for (const par of d.pares) {
    if (T[par.original] !== undefined) { par.traducao = T[par.original]; n++; }
    else faltando.push(par.original);
  }
  fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
  console.log(`${produto}: ${n}/${d.pares.length}`);
  for (const f of faltando) console.log(`   SEM tradução: ${JSON.stringify(f.slice(0, 90))}`);
}
