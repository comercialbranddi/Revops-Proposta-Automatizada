/**
 * Preenche BBP.json, GD.json e VM.json.
 *
 * GD e VM reaproveitam a prosa dos documentos que o comercial já tinha em
 * inglês ([ENGLISH] Proposal_Branddi_FR e _BB_VM), que são tradução fiel do
 * português atual — só o bloco comercial de lá estava errado, e esse vem do
 * português. BBP é tradução nova: não existe Buy Box Protection em documento
 * nenhum em inglês.
 */
import fs from 'node:fs';

// Linhas iguais nos quatro bases.
const COMUM = {
  "São Paulo, XX de [mês] de [ano].": "São Paulo, Brazil, {{DATA}}.",
  "Para: {{MARCA}}": "To: {{MARCA}}",
  "Prezados,": "Dear Sir or Madam,",
  "Nossas Proteções": "Our Protections",
  "Especificações": "Specifications",
  "Marca a ser monitorada:": "Brand to be monitored:",
  "{{MARCA}}": "{{MARCA}}",
  "{{MARCA}} ": "{{MARCA}} ",
  "Plataformas Monitoradas: ": "Monitored Platforms: ",
  "Frequência do Monitoramento: ": "Monitoring Frequency: ",
  "Diário": "Daily",
  "Aspectos do Monitoramento:": "Monitoring Aspects:",
  "Identificar:": "Identifying:",
  "Entregáveis ": "Deliverables ",
  "Setup (Onboarding):": "Setup (Onboarding):",
  "Formas de atuação:": "Methods of action:",
  "Proposta Comercial ": "Business Proposal ",
  "Condições Comerciais": "Commercial Terms",
  "Setup: 01 mensalidade": "Setup: one monthly fee",
  "Limite de denúncias/mediações: Sem limite.": "Limit of reports/mediations: no limit.",
  "Prazo para início do monitoramento: 3 dias úteis.": "Monitoring start time: 3 business days.",
  "Condição de pagamento: Mensal - D+30 da emissão da NF": "Payment terms: monthly - D+30 from the invoice issue date",
  "Duração do contrato:  Contrato sem fidelidade, com aviso prévio de 60 dias para cancelamento sem multa":
    "Contract duration: no minimum term, with 60 days of prior notice for cancellation without penalty",
  "Proposta Válida por 15 dias": "Proposal valid for 15 days",
  "Branddi – Combata o uso indevido da sua marca e maximize seus resultados":
    "Branddi – Fight the misuse of your brand and maximize your results",
  "Apresentamos nossa proposta comercial para prestação de serviços especializados em monitoramento da marca {{MARCA}} no ambiente digital, visando proteger seus direitos de propriedade intelectual. Este serviço será executado pela Branddi, aliando a tecnologia de ponta da nossa ferramenta e a expertise para combater o desvio de clientela e maximizar seus esforços de construção de marca.":
    "We are pleased to present our commercial proposal for the provision of specialized services in monitoring the {{MARCA}} brand in the digital environment, aiming to protect your intellectual property rights. This service will be carried out by Branddi, combining the cutting-edge technology of our tool and our expertise to combat customer diversion and maximize your brand-building efforts.",
  "Apresentamos nossa proposta comercial para prestação de serviços especializados em monitoramento das marcas da {{MARCA}} no ambiente digital, visando proteger seus direitos de propriedade intelectual. Este serviço será executado pela Branddi, aliando a tecnologia de ponta da nossa ferramenta e a expertise para combater o desvio de clientela e maximizar seus esforços de construção de marca.":
    "We are pleased to present our commercial proposal for the provision of specialized services in monitoring the {{MARCA}} brands in the digital environment, aiming to protect your intellectual property rights. This service will be carried out by Branddi, combining the cutting-edge technology of our tool and our expertise to combat customer diversion and maximize your brand-building efforts.",
  "Reunião mensal: onde apresentamos relatório das violações por canal, taxa de sucesso e impacto financeiro estimado e as oportunidades identificadas para aprimorar o ambiente de proteção de marca":
    "Monthly meeting: where we present a report of infringements by channel, success rate, estimated financial impact, and the opportunities identified to strengthen the brand protection environment",
  "Relatório semanal: Enviado por e-mail relatório com situação das ocorrências que estão sendo tratadas. O cliente poderá customizar este relatório dentre as informações disponíveis pelo monitoramento.":
    "Weekly report: a report is sent by email with the status of the occurrences being handled. The client can customize this report from the information available through monitoring.",
  "A marca deve possuir o devido registro no INPI de titularidade do cliente;":
    "The brand must have proper registration with the INPI (Brazilian National Institute of Industrial Property) under the client's ownership;",
  "Ativação e configuração de robôs de monitoramento;": "Activation and configuration of monitoring robots;",
};

const BBP = {
  "Buy Box Protection ": "Buy Box Protection ",
  "O serviço de Buy Box Protection da Branddi é voltado à governança da conversão dos produtos da marca no {{CANAIS_BBP}}, atuando sobre a dinâmica do Buy Box para reduzir o desvio de vendas para sellers não autorizados e garantir maior previsibilidade de performance para a Loja Oficial.":
    "Branddi's Buy Box Protection service governs the conversion of the brand's products on {{CANAIS_BBP}}, acting on Buy Box dynamics to reduce the diversion of sales to unauthorized sellers and to give the Official Store greater predictability of performance.",
  "Diferente de abordagens focadas exclusivamente em preço, o Buy Box Protection tem como objetivo oferecer visibilidade, controle e inteligência sobre quem disputa a posição de compra dos produtos da marca, permitindo atuação estratégica e alinhada às políticas comerciais e de canal.":
    "Unlike approaches focused exclusively on price, Buy Box Protection aims to provide visibility, control, and intelligence over who competes for the buy position of the brand's products, enabling strategic action aligned with commercial and channel policies.",
  "Objetivos": "Objectives",
  "Proteção da conversão da marca: Reduzir o desvio de vendas para sellers não autorizados dentro do Buy Box.":
    "Protecting brand conversion: reduce the diversion of sales to unauthorized sellers within the Buy Box.",
  "Governança do canal marketplace: Garantir maior controle sobre quem disputa a posição de compra dos produtos da marca.":
    "Marketplace channel governance: ensure greater control over who competes for the buy position of the brand's products.",
  "Preservação de margem e política comercial: Evitar guerras de preço desnecessárias e desalinhadas à estratégia da marca.":
    "Preserving margin and commercial policy: avoid price wars that are unnecessary and misaligned with the brand's strategy.",
  "Melhoria da experiência do consumidor: Reduzir confusão no momento da compra e riscos reputacionais.":
    "Improving the customer experience: reduce confusion at the moment of purchase and reputational risk.",
  "Previsibilidade de performance: Apoiar a tomada de decisão com dados claros sobre a dinâmica do Buy Box.":
    "Predictability of performance: support decision-making with clear data on Buy Box dynamics.",
  "{{CANAIS_BBP}}": "{{CANAIS_BBP}}",
  "Sellers que disputam o Buy Box dos produtos da marca;": "Sellers competing for the Buy Box of the brand's products;",
  "Posição da Loja Oficial no Buy Box;": "Position of the Official Store in the Buy Box;",
  "Reincidência e padrões de disputa no Buy Box;": "Recurrence and patterns of competition in the Buy Box;",
  "Informações associadas aos sellers (perfil, histórico, relevância).": "Information associated with the sellers (profile, history, relevance).",
  "Classificação das ocorrências com base em critérios de relevância e comportamento comercial, realizada pela equipe especializada da Branddi.":
    "Classification of occurrences based on criteria of relevance and commercial behavior, carried out by Branddi's specialist team.",
  "Definição do portfólio de SKUs monitorados;": "Definition of the portfolio of monitored SKUs;",
  "Configuração dos robôs de monitoramento do Buy Box;": "Configuration of the Buy Box monitoring robots;",
  "Alinhamento de critérios de análise e priorização;": "Alignment of analysis and prioritization criteria;",
  "Integração com políticas comerciais da marca.": "Integration with the brand's commercial policies.",
  "Apoio à identificação de sellers não autorizados;": "Support in identifying unauthorized sellers;",
  "Cruzamento das informações coletadas com bases fornecidas pelo cliente;": "Cross-referencing the collected information with databases provided by the client;",
  "Suporte à atuação comercial da marca junto aos canais e parceiros.": "Support for the brand's commercial action with channels and partners.",
  "Reunião mensal: Apresentação dos principais achados; Discussão de cenários e oportunidades de melhoria; Recomendações estratégicas de governança do Buy Box.":
    "Monthly meeting: presentation of the main findings; discussion of scenarios and opportunities for improvement; strategic recommendations for Buy Box governance.",
  "1 - Proteção Buy Box Protection": "1 - Buy Box Protection",
  "Proposta: {{PRECO_BBP}}  ": "Price: {{PRECO_BBP}}  ",
  "Até {{CATALOGO_BBP}} SKUs": "Up to {{CATALOGO_BBP}} SKUs",
};

const GD = {
  "Fraudes Digitais e Impersonação de Marca": "Digital Frauds and Brand Impersonation",
  "Nosso serviço de Proteção Contra Fraudes Digitais e Impersonação de Marca é essencial para combater e neutralizar ameaças digitais que simulam ou clonam a identidade de marcas reconhecidas para prejudicar tanto a marca quanto seus consumidores. Utilizamos tecnologia avançada de monitoramento em uma ampla gama de plataformas digitais, assegurando que qualquer uso fraudulento ou malicioso da marca seja prontamente identificado e denunciado.":
    "Our Digital Fraud and Brand Impersonation Protection service is essential to combat and neutralize digital threats that simulate or clone the identity of recognized brands to harm both the brand and its consumers. We employ advanced monitoring technology across a wide range of digital platforms, ensuring that any fraudulent or malicious use of the brand is promptly identified and reported.",
  "Objetivos:": "Objectives:",
  "Preservar a Reputação da Marca: Proteger a imagem da marca contra associações com atividades fraudulentas ou maliciosas.":
    "Preserve Brand Reputation: protect the brand image from associations with fraudulent or malicious activities.",
  "Prevenir Fraudes: Identificar e neutralizar atividades fraudulentas que prejudicam tanto a marca quanto seus clientes, como esquemas de phishing e golpes.":
    "Prevent Fraud: identify and neutralize fraudulent activities that harm both the brand and its customers, such as phishing schemes and scams.",
  "Manter a Confiança do Cliente: Garantir que os consumidores possam confiar na autenticidade das comunicações e interações da marca.":
    "Maintain Customer Trust: ensure that consumers can trust the authenticity of the brand's communications and interactions.",
  "Registradores de Domínio: Monitoramos mais de 2800 registradores de domínios em todo o mundo para detectar registros suspeitos e prevenir ações de cybersquatting que possam confundir ou enganar consumidores e prejudicar a reputação da marca.":
    "Domain Registrars: we monitor over 2,800 domain registrars worldwide to detect suspicious registrations and prevent cybersquatting actions that may confuse or deceive consumers and harm the brand's reputation.",
  "Tipos de Domínios: Abrangemos uma vasta gama de domínios, incluindo mais de 746 TLDs (Top-Level Domains) e 1510 ccTLDs (Country Code Top-Level Domains), para uma cobertura completa em diferentes regiões geográficas e setores de mercado.":
    "Types of Domains: we cover a wide range of domains, including over 746 TLDs (Top-Level Domains) and 1,510 ccTLDs (Country Code Top-Level Domains), for comprehensive coverage across different geographical regions and market sectors.",
  "Criação de Domínios: Monitoramos aproximadamente 250.000 novos domínios criados diariamente, analisando rapidamente qualquer potencial uso indevido que possa estar associado a atividades fraudulentas.":
    "Domain Creation: we monitor approximately 250,000 new domains created daily, quickly analyzing any potential misuse that may be associated with fraudulent activities.",
  "Plataformas de E-commerce: Canal direto com centenas de plataformas de e-commerce":
    "E-commerce Platforms: direct channel with hundreds of e-commerce platforms",
  "Plataformas de Checkout / Carrinho: Canal direto com centenas de plataformas de gerenciamento de checkout e gateways de pagamento para agir rapidamente no bloqueio de métodos de pagamento..":
    "Checkout / Cart Platforms: direct channel with hundreds of checkout management platforms and payment gateway providers, to act swiftly in blocking payment methods.",
  "Provedores de Hospedagem: Canal direto com provedores de hospedagem para desativar sites fraudulentos que possam estar hospedando conteúdo prejudicial ou enganoso.":
    "Hosting Providers: direct channel with hosting providers to deactivate fraudulent websites that may be hosting harmful or deceptive content.",
  "Plataformas de Anúncios: Incluímos monitoramento contínuo de bibliotecas de anúncios e resultados de pesquisa patrocinados, garantindo que anúncios falsos ou enganosos não sejam utilizados para desviar tráfego ou prejudicar a integridade da marca.":
    "Ad Platforms: we include continuous monitoring of ad libraries and sponsored search results, ensuring that false or misleading ads are not used to divert traffic or harm brand integrity.",
  "Monitoramento contínuo": "Continuous monitoring",
  "Métodos de Impersonação Monitorados:": "Impersonation methods monitored:",
  "Contas Falsas nas Redes Sociais: Criação de perfis falsos que imitam as contas oficiais da marca, usados para disseminar desinformação ou golpes.":
    "Fake Social Media Accounts: creation of fake profiles mimicking the official brand accounts, used to spread misinformation or scams.",
  "Websites Falsos: Sites que se assemelham ao site oficial da marca, muitas vezes usados para aplicar golpes ou capturar dados de clientes.":
    "Fake Websites: sites that resemble the official brand website, often used to perpetrate scams or capture customer data.",
  "Uso de Domínios Falsos: Registro de nomes de domínio que se assemelham ao site oficial da marca com a intenção de induzir ao erro ou lucrar com a confusão da marca.":
    "Use of Fake Domains: registering domain names that resemble the official brand website with the intention to deceive or profit from brand confusion.",
  "Anúncios Falsos nas Redes Sociais: Publicação de anúncios enganosos que parecem ser da marca, mas direcionam para sites maliciosos ou golpes.":
    "Fake Ads on Social Media: posting deceptive ads that appear to be from the brand but redirect to malicious websites or scams.",
  "Anúncios de Resultados Patrocinados em Mecanismos de Pesquisa: Monitoramento de anúncios que utilizam indevidamente o nome da marca em resultados patrocinados, desviando tráfego e potencialmente prejudicando a imagem da marca":
    "Sponsored Search Results Ads: monitoring of ads that improperly use the brand's name in sponsored search results, diverting traffic and potentially harming the brand's image",
  "Triagem e Categorização das Ocorrências: Nossa equipe especializada em Brand Strategy realiza a filtragem para identificar falsos positivos e categorizar as ocorrências. Esta triagem é crucial para determinar a abordagem correta para cada tipo de ameaça detectada.":
    "Screening and Categorization of Occurrences: our specialized Brand Strategy team conducts filtering to identify false positives and categorize occurrences. This screening is crucial for determining the correct approach for each type of detected threat.",
  "Definição das regras de triagem e classificação junto ao cliente.": "Definition of screening and classification rules with the client.",
  "Triagem Diária: Envio diário de relatórios listando todas as ameaças identificadas, sujeitas à aprovação do cliente antes de prosseguir com qualquer ação. Opção de takedown automatizado disponível mediante aprovação expressa e fornecimento de uma safelist pelo cliente.":
    "Daily screening: daily submission of reports listing all identified threats, subject to client approval before any action proceeds. Automated takedown option available upon express approval and provision of a safelist by the client.",
  "Relatório semanal: Relatórios semanais enviados por e-mail com o status das ameaças que estão sendo tratadas, permitindo ao cliente customizar as informações conforme sua necessidade.":
    "Weekly report: weekly reports sent by email with the status of the threats being handled, allowing the client to customize the information as needed.",
  "Denúncias e Remoções: Executamos denúncias em todas as entidades e plataformas envolvidas para solicitar a remoção de conteúdos infratores ou bloqueio de domínios fraudulentos.":
    "Reports and Takedowns: we file reports with all entities and platforms involved to request the removal of infringing content or the blocking of fraudulent domains.",
  "Safelist: O cliente pode fornecer uma lista de URLs, domínios e perfis oficiais que serão incluídos numa safelist para otimizar a automação das ações de monitoramento e remoção.":
    "Safelist: the client can provide a list of official URLs, domains, and profiles to be included in a safelist, to optimize the automation of monitoring and takedown actions.",
  "Assessoria para Disputas de Domínios: Facilitamos a intermediação de disputas de nomes de domínios com escritórios parceiros ou escolhidos pelo cliente, abrangendo desde câmaras de arbitragem até ações judiciais para casos não resolvidos pelas vias administrativas.":
    "Domain Dispute Advisory: we facilitate the intermediation of domain name disputes with partner firms or firms chosen by the client, ranging from arbitration panels to legal action for cases not resolved through administrative channels.",
  "1 - Proteção Fraude": "1 - Digital Fraud Protection",
  "Proposta:": "Price:",
  "{{PRECO_GD}}": "{{PRECO_GD}}",
  "Plataformas: {{CANAIS_GD}}": "Platforms: {{CANAIS_GD}}",
};

const VM = {
  "Violação de Propriedade Intelectual": "Intellectual Property Infringement",
  "O serviço de proteção contra violação de propriedade intelectual da Branddi é projetado para identificar e mitigar proativamente o uso indevido de suas marcas registradas nas principais plataformas de venda online. Nosso objetivo primordial é localizar vendedores, empresas ou entidades que possam estar utilizando, intencional ou inadvertidamente, marcas de terceiros para promover ou vender produtos e serviços.":
    "Branddi's intellectual property infringement protection service is designed to proactively identify and mitigate the misuse of your trademarks on major online selling platforms. Our primary goal is to locate sellers, companies, or entities that may be intentionally or inadvertently using third-party trademarks to promote or sell products and services.",
  "Com base em ocorrências encontradas pelo nosso sistema de monitoramento, tomamos medidas adequadas para comunicar as violações às respectivas plataformas de venda, buscando a remoção de listagens inapropriadas ou a correção dos anúncios que possam estar infringindo os seus direitos de propriedade intelectual.":
    "Based on occurrences detected by our monitoring system, we take appropriate measures to communicate the infringements to the respective selling platforms, seeking the removal of inappropriate listings or the correction of advertisements that may be infringing on your intellectual property rights.",
  "De acordo com a legislação brasileira de propriedade intelectual, os titulares de marcas têm o direito inalienável de proteger sua marca contra usos não autorizados. A proteção de sua marca não é apenas um direito, mas uma responsabilidade para garantir a autenticidade e a confiança que os consumidores depositam em seus produtos e serviços. Nossos serviços são moldados para ajudá-lo a exercer esse direito e garantir que sua marca permaneça única e inconfundível no mercado.":
    "According to Brazilian intellectual property legislation, trademark holders have the inalienable right to protect their trademark against unauthorized uses. Protecting your brand is not only a right but also a responsibility, to ensure the authenticity and trust that consumers place in your products and services. Our services are shaped to assist you in exercising this right and ensuring that your brand remains unique and unmistakable in the market.",
  "{{CANAIS_VM}}": "{{CANAIS_VM}}",
  "anúncios de produtos que utilizam termos da marca no título ou conteúdo da oferta;":
    "product advertisements that use brand terms in the title or content of the offer;",
  "perfis em redes sociais que utilizem a marca no nome do usuário ou elementos gráficos da marca na foto de perfil.":
    "social media profiles that use the brand in the username, or brand graphics in the profile picture.",
  "anúncios em metaads que utilizem termos da marca no conteúdo do anúncio":
    "ads on Meta Ads that use brand terms in the ad content",
  "Triagem e categorização das ocorrências para determinar o tipo de violação. Esse trabalho é realizado pela nossa equipe de especialistas em Brand Strategy, trazendo a indicação de qual tratativa poderá ser adotada conforme o tipo de violação.":
    "Screening and categorization of occurrences to determine the type of infringement. This task is carried out by our team of Brand Strategy specialists, providing guidance on the appropriate action to be taken based on the type of infringement.",
  "Definição das regras de triagem e classificação junto ao cliente;": "Definition of screening and classification rules with the client;",
  "Customização dos modelos de aviso.": "Customization of notice templates.",
  "Triagem semanal: Envio semanal relacionando as violações identificadas para o cliente aprovar a atuação. Nenhum aviso de violação ou denúncia será iniciado sem aprovação expressa do cliente para cada um dos links":
    "Weekly screening: a weekly submission listing the infringements identified, for the client to approve the course of action. No infringement notice or report is initiated without the express approval of the client for each of the links",
  "Aviso de Violação: ": "Infringement Notice: ",
  "Envio de avisos de violação de marca para os infratores, buscando uma solução amistosa. ":
    "Sending trademark infringement notices to the offenders, seeking an amicable resolution. ",
  "Os avisos poderão ser enviados via mensagem de chat, através do próprio perfil da Branddi diretamente aos infratores, quando disponibilizado o canal pela plataforma. ":
    "The notices can be sent by chat message, through Branddi's own profile, directly to the offenders, when the platform provides such a channel. ",
  "Denúncia: ": "Reporting: ",
  "No caso de ocorrências classificadas como suspeita de Falsificação ou Uso Ilegal da Marca, ou não resolvidas de maneira amigável através dos avisos de violação, protocolamos as denúncias nas plataformas pedindo a remoção dos referidos conteúdos;":
    "For occurrences classified as suspected Counterfeiting or Illegal Use of the Brand, or not resolved amicably through infringement notices, we file reports with the platforms requesting the removal of the content in question;",
  "1 - Proteção Violação de marca": "1 - Intellectual Property Infringement Protection",
  "Proposta: {{PRECO_VM}}": "Price: {{PRECO_VM}}",
  "Plataformas: {{CANAIS_VM}}": "Platforms: {{CANAIS_VM}}",
  "Condição de pagamento: Mensal - D+30 da emissão da NFRenovação automática.":
    "Payment terms: monthly - D+30 from the invoice issue date. Automatic renewal.",
};

const MAPAS = { BBP: { ...COMUM, ...BBP }, GD: { ...COMUM, ...GD }, VM: { ...COMUM, ...VM } };

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
