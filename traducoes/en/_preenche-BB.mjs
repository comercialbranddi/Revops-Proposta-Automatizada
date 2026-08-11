/**
 * Preenche traducoes/en/BB.json. Descartável — o que importa é o JSON gerado.
 * Fica aqui só pra deixar rastro de qual texto foi escolhido pra cada linha.
 */
import fs from 'node:fs';

const T = {
  "São Paulo, XX de [mês] de [ano].": "São Paulo, Brazil, {{DATA}}.",
  "Para: {{MARCA}}": "To: {{MARCA}}",
  "Prezados,": "Dear Sir or Madam,",
  "Apresentamos nossa proposta comercial para prestação de serviços especializados em monitoramento da marca {{MARCA}} no ambiente digital, visando proteger seus direitos de propriedade intelectual. Este serviço será executado pela Branddi, aliando a tecnologia de ponta da nossa ferramenta e a expertise para combater o desvio de clientela e maximizar seus esforços de construção de marca.":
    "We are pleased to present our commercial proposal for the provision of specialized services in monitoring the {{MARCA}} brand in the digital environment, aiming to protect your intellectual property rights. This service will be carried out by Branddi, combining the cutting-edge technology of our tool and our expertise to combat customer diversion and maximize your brand-building efforts.",
  "Nossas Proteções": "Our Protections",
  "Brand Bidding": "Brand Bidding",
  "Através do monitoramento de marca no Google, nosso objetivo é localizar e informar quais outras marcas, entidades ou empresas, concorrentes ou não, estão utilizando a marca  {{MARCA}} como palavra de busca para anunciar marcas, produtos e serviços.":
    "Through brand monitoring on Google, our goal is to locate and report which other brands, entities, or companies, whether competitors or not, are using the {{MARCA}} brand as a search term to advertise brands, products, and services.",
  "Ao identificarmos anunciantes realizando estas práticas com sua marca, executamos o serviço de assessoria jurídica que contempla a redação, envio e acompanhamento de notificações extrajudiciais com o objetivo de desestimular o uso ilícito da marca e fornecer subsídios para eventual proposição de ação judicial.":
    "Upon identifying advertisers engaging in these practices with your brand, we carry out the legal advisory service, which includes drafting, sending, and following up on extrajudicial notifications aimed at discouraging the illicit use of the brand and providing grounds for potential legal action.",
  "Atualmente os tribunais brasileiros reconhecem que a utilização de marcas registradas de terceiros para o desvio de clientela por meio de links patrocinados, constitui prática de concorrência desleal e pode gerar a obrigação de abstenção de uso e o dever de indenizar.":
    "Brazilian courts currently recognize that using third-party registered trademarks to divert customers through sponsored links constitutes unfair competition, and may give rise to an obligation to cease such use and a duty to indemnify.",
  "Portanto, a conduta de utilização de marca de terceiros em links patrocinados pode constituir prática de concorrência desleal, uma vez que tem o potencial de desviar clientela de forma ilícita, bem como gerar confusão entre os consumidores.":
    "Therefore, using a third-party trademark in sponsored links may constitute unfair competition, as it has the potential to unlawfully divert clientele and to create confusion among consumers.",
  "Especificações": "Specifications",
  "Marca a ser monitorada:": "Brand to be monitored:",
  "{{MARCA}}": "{{MARCA}}",
  "Plataforma(s) Monitorada(s): ": "Monitored Platform(s): ",
  "{{CANAIS_BB}}": "{{CANAIS_BB}}",
  "Frequência do Monitoramento: ": "Monitoring Frequency: ",
  "Diária, em horários diversos.": "Daily, at various times.",
  "Aspectos do Monitoramento": "Monitoring Aspects",
  "Serão monitoradas e capturadas as seguintes informações de cada anúncio encontrado nos resultados de busca:":
    "The following information is monitored and captured for each advertisement found in the search results:",
  "Palavra monitorada": "Monitored keyword",
  "Data do monitoramento": "Monitoring date",
  "Geolocalização": "Geolocation",
  "Tipo de ambiente – desktop / mobile": "Environment type – desktop / mobile",
  "Posição do anúncio em tela": "Advertisement position on screen",
  "Título do anúncio": "Advertisement title",
  "Link do anúncio": "Advertisement link",
  "Link de resultado do site de busca": "Search engine results page link",
  "Marca anunciada": "Advertised brand",
  "Domínio exibido no anúncio": "Domain displayed in the advertisement",
  "Link apresentado no anúncio": "Link presented in the advertisement",
  "Descrição apresentada no anúncio": "Description presented in the advertisement",
  "Captura de tela da evidência da busca efetuada": "Screenshot of the search evidence captured",
  "Entregáveis": "Deliverables",
  "Relatório diário: as informações do monitoramento serão entregues diariamente no período da manhã, via e-mail, no formato de relatório PDF anexado ao e-mail.":
    "Daily report: monitoring information is delivered every morning by email, as a PDF report attached to the message.",
  "Triagem semanal: Envio semanal relacionando as violações identificadas para o cliente aprovar a atuação. Nenhuma notificação ou denúncia será realizada sem aprovação expressa do cliente para cada um dos links":
    "Weekly screening: a weekly submission listing the infringements identified, for the client to approve the course of action. No notification or report is filed without the express approval of the client for each of the links",
  "Formas de atuação:": "Methods of action:",
  "Envio de Notificações: ": "Sending notifications: ",
  "Envio de avisos de violação de marca para os infratores, buscando uma solução amistosa. ":
    "Sending trademark infringement notices to the offenders, seeking an amicable resolution. ",
  "Denúncia: ": "Reporting: ",
  "No caso de ocorrências classificadas como Suspeita de Fraude ou Violação de Marca, protocolamos as denúncias na plataforma pedindo a remoção dos referidos conteúdos;":
    "For occurrences classified as Suspected Fraud or Trademark Infringement, we file reports with the platform requesting the removal of the content in question;",
  "No caso de ocorrências de Suspeita de Fraude, onde o agressor cria um site com fins fraudulentos, protocolamos a denúncia junto ao serviço de hospedagem do respectivo site":
    "For occurrences of Suspected Fraud, where the offender creates a website for fraudulent purposes, we file the report with the hosting provider of that website",
  "Reunião mensal: onde apresentamos relatório das violações por canal, taxa de sucesso e impacto financeiro estimado e as oportunidades identificadas para aprimorar o ambiente de proteção de marca":
    "Monthly meeting: where we present a report of infringements by channel, success rate, estimated financial impact, and the opportunities identified to strengthen the brand protection environment",
  "Proposta Comercial ": "Business Proposal ",
  "1 - Proteção Brand Bidding": "1 - Brand Bidding Protection",
  "Proposta: {{PRECO_BB}}  ": "Price: {{PRECO_BB}}  ",
  "Palavras-chave: Até {{PALAVRAS_BB}} palavras.": "Keywords: up to {{PALAVRAS_BB}} keywords.",
  "Condições Comerciais": "Commercial Terms",
  "Setup: 01 mensalidade": "Setup: one monthly fee",
  "Limite de denúncias/mediações: Sem limite.": "Limit of reports/mediations: no limit.",
  "Prazo para início do monitoramento: 3 dias úteis.": "Monitoring start time: 3 business days.",
  "Condição de pagamento: Mensal - D+30 da emissão da NF": "Payment terms: monthly - D+30 from the invoice issue date",
  "Duração do contrato:  Contrato sem fidelidade, com aviso prévio de 60 dias para cancelamento sem multa":
    "Contract duration: no minimum term, with 60 days of prior notice for cancellation without penalty",
  "Proposta Válida por 15 dias": "Proposal valid for 15 days",
};

const p = new URL('./BB.json', import.meta.url);
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const faltando = [];
let n = 0;
for (const par of d.pares) {
  if (T[par.original] !== undefined) { par.traducao = T[par.original]; n++; }
  else faltando.push(par.original);
}
fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
console.log(`preenchidos ${n}/${d.pares.length}`);
for (const f of faltando) console.log('  SEM tradução: ' + JSON.stringify(f.slice(0, 80)));
