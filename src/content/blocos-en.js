/**
 * Catálogo de blocos — inglês.
 *
 * Espelha `blocos-pt.js` linha por linha: mesmos rótulos, mesmas linhas
 * marcadas com `so`, mesma ausência de modalidade em BBP. Se um dos dois ganhar
 * uma linha, o outro precisa ganhar também — a bateria confere isso.
 *
 * ─── De onde vem o vocabulário ──────────────────────────────────────
 *
 * Os nomes de produto são os que o comercial já usava nos quatro documentos em
 * inglês: Brand Bidding, Digital Fraud Protection, Intellectual Property
 * Infringement. Buy Box Protection é o único que não aparece em NENHUM dos nove
 * documentos em outro idioma — procurado por "Buy Box", "BBP" e "caja de
 * compra", zero ocorrência — então esse bloco foi escrito do zero, a partir do
 * português.
 *
 * ─── O que foi deliberadamente NÃO herdado ──────────────────────────
 *
 * Os documentos antigos em inglês vendiam contrato anual com fidelidade. Isso
 * fica de fora: as condições são as do português (ver `textos.js`).
 *
 * Também ficaram fora três defeitos que a auditoria de 11/08/2026 encontrou
 * neles e que seriam herdados de graça: português vazando no meio do inglês
 * ("Google + Meta (Facebook e Instagram) + TLD's (Dominios)"), o bloco de
 * Violação listando as plataformas de Golpes Digitais, e a ausência da linha de
 * limite de palavras-chave que o português tem.
 */

const NO_ENFORCEMENT = (quem) =>
    `Branddi does not notify ${quem} nor file takedown requests under this mode.`;

export const BLOCOS_EN = {

    // ─────────────────────────────────────────────────────────────────
    BB: {
        titulo: 'Brand Bidding',
        objetivo: 'competitors and third parties bid on the brand name as a keyword and capture traffic that belonged to the Client, at the very moment the consumer was already searching for it',
        temModalidade: true,
        prosa: {
            ambos: 'Monitoring of the brand across search engines to identify which brands, entities or companies — competitors or not — are using the Client’s term as a search keyword to advertise their own products and services. When advertisers are found engaging in this practice, <strong>Branddi carries out the legal work</strong>: drafting, sending and following up on cease-and-desist notices, aimed at discouraging the unlawful use of the mark and at building support for any future legal action.',
            monitoria: `Monitoring of the brand across search engines to identify which brands, entities or companies — competitors or not — are using the Client’s term as a search keyword to advertise their own products and services. <strong>Each occurrence is delivered as a complete evidence file</strong> — keyword monitored, date, geolocation, on-screen position, headline, displayed domain, ad link and a screenshot of the evidence — <strong>so that the Client may pursue whatever measure it deems appropriate</strong>. ${NO_ENFORCEMENT('advertisers')}`,
        },
        especificacoes: [
            { rotulo: 'Channels', valor: '{{CANAIS}}' },
            { rotulo: 'Keywords', valor: 'Up to {{QUANTIDADE}} [[keyword|keywords]]' },
            { rotulo: 'Frequency', valor: 'Daily, at varying times' },
            { rotulo: 'Data captured', valor: 'For every ad found: keyword monitored, date, geolocation, environment (desktop or mobile), on-screen position, headline, link, advertised brand, displayed domain, description and a screenshot of the evidence' },
            { rotulo: 'Screening', valor: 'Screening and classification of occurrences by type of violation, carried out by Branddi’s specialist team' },
            { rotulo: 'Enforcement', so: 'ambos', valor: 'Cease-and-desist notice to the advertiser, seeking an amicable resolution; takedown request to the platform asking for removal of the content, in cases classified as suspected fraud or trademark violation; report to the hosting provider where a fraudulent site is involved' },
            { rotulo: 'Evidence delivery', so: 'monitoria', valor: 'An evidence file per occurrence, in a format suitable to support a cease-and-desist notice or takedown request pursued by the Client or its counsel' },
            { rotulo: 'Approval', so: 'ambos', valor: 'No notice or takedown request is initiated without the Client’s express approval, link by link' },
        ],
        sla: [
            { entregavel: 'Monitoring report', periodicidade: 'Daily', canal: 'E-mail, as PDF' },
            { entregavel: 'Screening of violations for approval', so: 'ambos', periodicidade: 'Weekly', canal: 'E-mail' },
            { entregavel: 'Report of classified occurrences', so: 'monitoria', periodicidade: 'Weekly', canal: 'E-mail' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    // Escrito do zero: Buy Box Protection não existe em nenhum documento que o
    // comercial tinha em inglês.
    BBP: {
        titulo: 'Buy Box Protection',
        objetivo: 'the official store loses the buy box position on marketplaces to unauthorized sellers, which diverts revenue without any trademark infringement taking place',
        temModalidade: false,
        // A linha "Suporte"/"Support"/"Apoyo" saiu em 18/08/2026: descrevia o
        // COMO da entrega, que é assunto do relatório mensal, não da proposta.
        // O que a proposta precisa dizer sobre isso já está na prosa — a
        // atuação comercial é conduzida pela Contratante.
        prosa: {
            unica: 'Governance over the conversion of the brand’s products on marketplaces, acting on buy box dynamics to reduce sales diverted to unauthorized sellers. Unlike price-driven approaches, the service provides visibility, control and intelligence over who competes for the buy box position. <strong>Commercial action with the channels is conducted by the Client</strong>, with Branddi’s support.',
        },
        especificacoes: [
            { rotulo: 'Channels', valor: '{{CANAIS}}' },
            { rotulo: 'Catalogue monitored', valor: 'Up to {{QUANTIDADE}} [[SKU|SKUs]]' },
            { rotulo: 'Frequency', valor: 'Daily' },
            { rotulo: 'Data captured', valor: 'Sellers competing for the buy box on the brand’s products; the official store’s position; recurrence and competition patterns; profile, history and relevance of each seller' },
            { rotulo: 'Screening', valor: 'Classification of occurrences by relevance and commercial behaviour, carried out by Branddi’s specialist team' },
            { rotulo: 'Onboarding', valor: 'Definition of the monitored SKU portfolio; configuration of monitoring crawlers; alignment of analysis and prioritization criteria; integration with the brand’s commercial policies' },
        ],
        sla: [
            { entregavel: 'Occurrence status report', periodicidade: 'Weekly', canal: 'E-mail, customizable' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    GD: {
        titulo: 'Digital Fraud Protection',
        objetivo: 'fake sites, look-alike domains and impostor profiles pose as the brand to run scams, harming the consumer and transferring the reputational damage to the Client',
        temModalidade: true,
        prosa: {
            ambos: 'Detection and neutralization of digital threats that simulate or clone the brand’s identity in order to harm the Client and its consumers — fake sites, look-alike domains, impostor profiles and fraudulent ads. Based on the occurrences found, <strong>Branddi files takedown requests</strong> with the platforms, registrars and hosting providers involved, seeking removal of the infringing content or blocking of the domain.',
            monitoria: `Detection of digital threats that simulate or clone the brand’s identity in order to harm the Client and its consumers — fake sites, look-alike domains, impostor profiles and fraudulent ads. <strong>Each occurrence is delivered as a complete evidence file</strong> — domain or profile, detection date, registrar or platform, hosting provider, threat classification and a screenshot — <strong>so that the Client may pursue whatever measure it deems appropriate</strong>. ${NO_ENFORCEMENT('domain or profile owners')}`,
        },
        especificacoes: [
            { rotulo: 'Channels', valor: '{{CANAIS}}' },
            { rotulo: 'Coverage', valor: 'Over 2,800 domain registrars, 746 TLDs and 1,510 ccTLDs; around 250,000 newly created domains analysed per day; e-commerce, checkout and payment gateway platforms; hosting providers; ad libraries and sponsored search results' },
            { rotulo: 'Frequency', valor: 'Continuous monitoring' },
            { rotulo: 'Data captured', valor: 'Fake social media accounts; websites imitating the official site; domains registered with similarity to the brand; misleading ads on social media and in sponsored search results' },
            { rotulo: 'Screening', valor: 'Filtering of false positives and categorization of occurrences, carried out by the Brand Strategy team' },
            { rotulo: 'Enforcement', so: 'ambos', valor: 'Takedown requests to the entities and platforms involved, asking for removal of the content or blocking of the domain; assistance in domain disputes, from arbitration panels to legal action, with partner firms or firms appointed by the Client' },
            { rotulo: 'Evidence delivery', so: 'monitoria', valor: 'An evidence file per occurrence, with registrar, hosting provider and reporting channel identified, in a format suitable to support the measure pursued by the Client or its counsel' },
            { rotulo: 'Safelist', valor: 'The Client may provide a list of official URLs, domains and profiles, which are then disregarded by the monitoring' },
            { rotulo: 'Approval', so: 'ambos', valor: 'No takedown request is initiated without the Client’s express approval. Automated takedown available upon authorization and safelist' },
        ],
        sla: [
            { entregavel: 'Screening of identified threats', periodicidade: 'Daily', canal: 'E-mail' },
            { entregavel: 'Threat status report', periodicidade: 'Weekly', canal: 'E-mail, customizable' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    VM: {
        titulo: 'Intellectual Property Infringement',
        objetivo: 'third parties use the brand’s distinctive signs without authorization to sell products and services, diluting the mark and confusing the consumer',
        temModalidade: true,
        prosa: {
            ambos: 'Identification of the unauthorized use of the Client’s registered trademarks across the main online sales platforms. Based on the occurrences found, <strong>Branddi reports the violations to the platforms</strong>, seeking removal of the infringing listings or correction of the ads.',
            monitoria: `Identification of the unauthorized use of the Client’s registered trademarks across the main online sales platforms. <strong>Each occurrence is delivered as a complete evidence file</strong> — screenshot, date, channel, identification of the infringer and classification of the type of violation — <strong>so that the Client may pursue whatever measure it deems appropriate</strong>. ${NO_ENFORCEMENT('infringers')}`,
        },
        especificacoes: [
            { rotulo: 'Channels', valor: 'Up to {{QUANTIDADE}} [[marketplace monitored|marketplaces monitored]] simultaneously' },
            { rotulo: 'Frequency', valor: 'Daily' },
            { rotulo: 'Data captured', valor: 'Product listings using brand terms in the title or in the body of the offer; profiles using the brand in the username or the brand’s graphic elements in the profile; Meta Ads using brand terms' },
            { rotulo: 'Screening', valor: 'Screening and categorization by type of violation, carried out by the Brand Strategy team, with an indication of the applicable course of action' },
            { rotulo: 'Enforcement', so: 'ambos', valor: 'Infringement notice to the offender, including via the platform’s chat where that channel is available; formal takedown request in cases of counterfeiting, unlawful use of the mark, or where the amicable route fails' },
            { rotulo: 'Evidence delivery', so: 'monitoria', valor: 'An evidence file per occurrence, in a format suitable to support a cease-and-desist notice or takedown request pursued by the Client or its counsel' },
            { rotulo: 'Approval', so: 'ambos', valor: 'No notice or takedown request is initiated without the Client’s express approval, link by link' },
        ],
        sla: [
            { entregavel: 'Screening of violations for approval', so: 'ambos', periodicidade: 'Weekly', canal: 'E-mail' },
            { entregavel: 'Report of classified occurrences', so: 'monitoria', periodicidade: 'Weekly', canal: 'E-mail' },
            { entregavel: 'Occurrence status report', periodicidade: 'Weekly', canal: 'E-mail, customizable' },
        ],
    },
};

export const SLA_GERAL_EN = [
    { entregavel: 'Monitoring starts after acceptance', periodicidade: '3 business days', canal: '—' },
    { entregavel: 'Review meeting', periodicidade: 'Monthly', canal: 'Remote' },
    { entregavel: 'Limit on takedown requests and mediations', so: 'ambos', periodicidade: 'No limit', canal: '—' },
];

/** Insumos do aceite, por produto — o cliente só é cobrado do que contratou. */
export const INSUMOS_EN = {
    BBP: 'the list of priority SKUs and of authorized sellers',
    BB: 'the list of keywords to monitor',
    GD: 'a safelist of official domains and profiles',
};
