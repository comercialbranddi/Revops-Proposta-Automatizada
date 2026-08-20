/**
 * Catálogo de blocos — espanhol.
 *
 * Espelha `blocos-pt.js` linha por linha, igual ao inglês. A bateria confere que
 * os três tenham os mesmos rótulos e as mesmas linhas marcadas com `so`.
 *
 * ─── De onde vem o vocabulário ──────────────────────────────────────
 *
 * Dos documentos que o comercial já tinha em espanhol: "Nuestras Protecciones",
 * "Protección Brand Bidding", "Palabras clave: hasta N palabras", "Sin
 * permanencia". Os nomes de produto são os de `PROPOSAL_TEMPLATES.es` —
 * Protección Fraude e Violación de Propiedad Intelectual.
 *
 * Buy Box Protection foi escrito do zero: não aparece em nenhum dos nove
 * documentos em outro idioma.
 *
 * ─── Defeitos dos documentos antigos que NÃO foram herdados ─────────
 *
 * A auditoria de 11/08/2026 achou português embutido no meio do espanhol, e
 * duplicado na mesma frase:
 *
 *   "Duración del contrato: Contrato sin permanencia mínima (fidelidad), con un
 *    aviso previo PARA CANCELAMENTO SEM MULTA de 60 días para cancelación sin
 *    multa."
 *
 * As condições daqui vêm de `textos.js`, escritas uma vez e em espanhol só.
 *
 * ─── Moeda ──────────────────────────────────────────────────────────
 *
 * Segue em real. O espanhol antigo cobrava em USD quando era Brand Bidding
 * sozinho ("4.900 USD/mes") e em real no combo ("R$ 9.900/mes") — duas decisões
 * contraditórias dentro do mesmo idioma. Enquanto o comercial não fechar, real é
 * o único comportamento que não inventa regra.
 */

const SIN_ACTUACION = (quem) =>
    `Branddi no notifica a ${quem} ni presenta denuncias en esta modalidad.`;

export const BLOCOS_ES = {

    // ─────────────────────────────────────────────────────────────────
    BB: {
        titulo: 'Brand Bidding',
        objetivo: 'competidores y terceros compran el nombre de la marca como palabra clave y capturan tráfico que era de la Contratante, justo cuando el consumidor ya la estaba buscando',
        temModalidade: true,
        prosa: {
            ambos: 'Monitoreo de la marca en los buscadores para localizar qué marcas, entidades o empresas — competidoras o no — utilizan el término de la Contratante como palabra de búsqueda para anunciar sus propios productos y servicios. Al identificar anunciantes en esa práctica, <strong>Branddi ejecuta la asesoría jurídica</strong>: redacción, envío y seguimiento de notificaciones extrajudiciales, con el objetivo de desalentar el uso ilícito de la marca y reunir respaldo para una eventual acción judicial.',
            monitoria: `Monitoreo de la marca en los buscadores para localizar qué marcas, entidades o empresas — competidoras o no — utilizan el término de la Contratante como palabra de búsqueda para anunciar sus propios productos y servicios. <strong>Cada ocurrencia se entrega con el expediente completo</strong> — palabra monitoreada, fecha, geolocalización, posición en pantalla, título, dominio exhibido, enlace del anuncio y captura de pantalla de la evidencia — <strong>para que la Contratante adopte la medida que considere pertinente</strong>. ${SIN_ACTUACION('anunciantes')}`,
        },
        especificacoes: [
            { rotulo: 'Canales', valor: '{{CANAIS}}' },
            { rotulo: 'Palabras clave', valor: 'Hasta {{QUANTIDADE}} palabras' },
            { rotulo: 'Frecuencia', valor: 'Diaria, en horarios diversos' },
            { rotulo: 'Datos capturados', valor: 'De cada anuncio encontrado: palabra monitoreada, fecha, geolocalización, tipo de entorno (escritorio o móvil), posición en pantalla, título, enlace, marca anunciada, dominio exhibido, descripción y captura de pantalla de la evidencia' },
            { rotulo: 'Clasificación', valor: 'Clasificación de las ocurrencias por tipo de violación, realizada por el equipo especializado de Branddi' },
            { rotulo: 'Actuación', so: 'ambos', valor: 'Notificación extrajudicial al anunciante, buscando una solución amistosa; denuncia a la plataforma solicitando la remoción del contenido, en los casos clasificados como sospecha de fraude o violación de marca; denuncia al proveedor de alojamiento cuando exista un sitio fraudulento' },
            { rotulo: 'Entrega de evidencias', so: 'monitoria', valor: 'Expediente por ocurrencia, en formato apto para instruir una notificación extrajudicial o denuncia conducida por la Contratante o su despacho' },
            { rotulo: 'Aprobación', so: 'ambos', valor: 'Ninguna notificación o denuncia se inicia sin la aprobación expresa de la Contratante, enlace por enlace' },
        ],
        sla: [
            { entregavel: 'Informe de monitoreo', periodicidade: 'Diaria', canal: 'Correo, en PDF' },
            { entregavel: 'Clasificación de violaciones para aprobación', so: 'ambos', periodicidade: 'Semanal', canal: 'Correo' },
            { entregavel: 'Informe de ocurrencias clasificadas', so: 'monitoria', periodicidade: 'Semanal', canal: 'Correo' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    BBP: {
        titulo: 'Buy Box Protection',
        objetivo: 'la tienda oficial pierde la posición de compra en los marketplaces frente a sellers no autorizados, lo que desvía ingresos sin que exista ninguna infracción de marca',
        temModalidade: false,
        // A linha "Suporte"/"Support"/"Apoyo" saiu em 18/08/2026: descrevia o
        // COMO da entrega, que é assunto do relatório mensal, não da proposta.
        // O que a proposta precisa dizer sobre isso já está na prosa — a
        // atuação comercial é conduzida pela Contratante.
        prosa: {
            unica: 'Gobernanza de la conversión de los productos de la marca en los marketplaces, actuando sobre la dinámica del Buy Box para reducir el desvío de ventas hacia sellers no autorizados. A diferencia de los enfoques centrados en el precio, el servicio ofrece visibilidad, control e inteligencia sobre quién disputa la posición de compra. <strong>La actuación comercial ante los canales es conducida por la Contratante</strong>, con el apoyo de Branddi.',
        },
        especificacoes: [
            { rotulo: 'Canales', valor: '{{CANAIS}}' },
            { rotulo: 'Catálogo monitoreado', valor: 'Hasta {{QUANTIDADE}} SKUs' },
            { rotulo: 'Frecuencia', valor: 'Diaria' },
            { rotulo: 'Datos capturados', valor: 'Sellers que disputan el Buy Box de los productos de la marca; posición de la tienda oficial; reincidencia y patrones de disputa; perfil, historial y relevancia de cada seller' },
            { rotulo: 'Clasificación', valor: 'Clasificación de las ocurrencias por relevancia y comportamiento comercial, realizada por el equipo especializado de Branddi' },
            { rotulo: 'Implantación', valor: 'Definición del portafolio de SKUs monitoreados; configuración de los robots de monitoreo; alineación de criterios de análisis y priorización; integración con las políticas comerciales de la marca' },
        ],
        sla: [
            { entregavel: 'Informe de situación de las ocurrencias', periodicidade: 'Semanal', canal: 'Correo, personalizable' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    GD: {
        titulo: 'Protección Fraude',
        objetivo: 'sitios, dominios y perfiles falsos se hacen pasar por la marca para aplicar estafas, lo que perjudica al consumidor y transfiere el daño reputacional a la Contratante',
        temModalidade: true,
        prosa: {
            ambos: 'Detección y neutralización de amenazas digitales que simulan o clonan la identidad de la marca para perjudicar a la Contratante y a sus consumidores — sitios falsos, dominios similares, perfiles y anuncios fraudulentos. Con base en las ocurrencias encontradas, <strong>Branddi presenta denuncias</strong> ante las plataformas, registradores y proveedores de alojamiento involucrados, solicitando la remoción del contenido infractor o el bloqueo del dominio.',
            monitoria: `Detección de amenazas digitales que simulan o clonan la identidad de la marca para perjudicar a la Contratante y a sus consumidores — sitios falsos, dominios similares, perfiles y anuncios fraudulentos. <strong>Cada ocurrencia se entrega con el expediente completo</strong> — dominio o perfil, fecha de detección, registrador o plataforma, proveedor de alojamiento, clasificación de la amenaza y captura de pantalla — <strong>para que la Contratante adopte la medida que considere pertinente</strong>. ${SIN_ACTUACION('los responsables de dominios y perfiles')}`,
        },
        especificacoes: [
            { rotulo: 'Canales', valor: '{{CANAIS}}' },
            // Linha nova em 19/08/2026, junto com a escada de preço de GD. A
            // UNIDADE ("marcas") está por confirmar com o comercial: nenhum
            // modelo antigo cita número em Golpes Digitais. Só aparece no
            // documento se o closer preencher a quantidade.
            { rotulo: 'Marcas monitoreadas', valor: 'Hasta {{QUANTIDADE}} marcas' },
            { rotulo: 'Cobertura', valor: 'Más de 2.800 registradores de dominio, 746 TLDs y 1.510 ccTLDs; cerca de 250.000 dominios nuevos analizados por día; plataformas de comercio electrónico, de checkout y pasarelas de pago; proveedores de alojamiento; bibliotecas de anuncios y resultados patrocinados' },
            { rotulo: 'Frecuencia', valor: 'Monitoreo continuo' },
            { rotulo: 'Datos capturados', valor: 'Cuentas falsas en redes sociales; sitios que imitan el sitio oficial; dominios registrados con similitud a la marca; anuncios engañosos en redes sociales y en resultados patrocinados' },
            { rotulo: 'Clasificación', valor: 'Filtrado de falsos positivos y categorización de las ocurrencias, realizada por el equipo de Brand Strategy' },
            { rotulo: 'Actuación', so: 'ambos', valor: 'Denuncia ante las entidades y plataformas involucradas solicitando la remoción del contenido o el bloqueo del dominio; asesoría en disputas de dominio, desde cámaras de arbitraje hasta acciones judiciales, con despachos socios o designados por la Contratante' },
            { rotulo: 'Entrega de evidencias', so: 'monitoria', valor: 'Expediente por ocurrencia, con registrador, alojamiento y canal de denuncia identificados, en formato apto para instruir la medida conducida por la Contratante o su despacho' },
            { rotulo: 'Safelist', valor: 'La Contratante puede proporcionar una lista de URLs, dominios y perfiles oficiales, que pasan a ser desconsiderados por el monitoreo' },
            { rotulo: 'Aprobación', so: 'ambos', valor: 'Ninguna denuncia se inicia sin la aprobación expresa de la Contratante. Takedown automatizado disponible mediante autorización y safelist' },
        ],
        sla: [
            { entregavel: 'Clasificación de amenazas identificadas', periodicidade: 'Diaria', canal: 'Correo' },
            { entregavel: 'Informe de estado de las amenazas', periodicidade: 'Semanal', canal: 'Correo, personalizable' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────
    VM: {
        titulo: 'Violación de Propiedad Intelectual',
        objetivo: 'terceros usan los signos distintivos de la marca sin autorización para vender productos y servicios, lo que diluye la marca y confunde al consumidor',
        temModalidade: true,
        prosa: {
            ambos: 'Identificación del uso indebido de las marcas registradas de la Contratante en las principales plataformas de venta en línea. Con base en las ocurrencias encontradas, <strong>Branddi comunica las violaciones a las plataformas</strong>, buscando la remoción de las publicaciones infractoras o la corrección de los anuncios.',
            monitoria: `Identificación del uso indebido de las marcas registradas de la Contratante en las principales plataformas de venta en línea. <strong>Cada ocurrencia se entrega con el expediente completo</strong> — captura de pantalla, fecha, canal, identificación del infractor y clasificación del tipo de violación — <strong>para que la Contratante adopte la medida que considere pertinente</strong>. ${SIN_ACTUACION('los infractores')}`,
        },
        especificacoes: [
            { rotulo: 'Canales', valor: 'Hasta {{QUANTIDADE}} marketplaces monitoreados simultáneamente' },
            { rotulo: 'Frecuencia', valor: 'Diaria' },
            { rotulo: 'Datos capturados', valor: 'Anuncios que utilicen términos de la marca en el título o en el contenido de la oferta; perfiles con la marca en el nombre de usuario o elementos gráficos de la marca en el perfil; anuncios en Meta Ads que utilicen términos de la marca' },
            { rotulo: 'Clasificación', valor: 'Clasificación y categorización por tipo de violación, realizada por el equipo de Brand Strategy, con indicación del tratamiento aplicable' },
            { rotulo: 'Actuación', so: 'ambos', valor: 'Aviso de violación al infractor, incluso por el chat de la plataforma cuando el canal esté disponible; denuncia formal en los casos de falsificación, uso ilegal de la marca o fracaso de la vía amistosa' },
            { rotulo: 'Entrega de evidencias', so: 'monitoria', valor: 'Expediente por ocurrencia, en formato apto para instruir una notificación extrajudicial o denuncia conducida por la Contratante o su despacho' },
            { rotulo: 'Aprobación', so: 'ambos', valor: 'Ningún aviso o denuncia se inicia sin la aprobación expresa de la Contratante, enlace por enlace' },
        ],
        sla: [
            { entregavel: 'Clasificación de violaciones para aprobación', so: 'ambos', periodicidade: 'Semanal', canal: 'Correo' },
            { entregavel: 'Informe de ocurrencias clasificadas', so: 'monitoria', periodicidade: 'Semanal', canal: 'Correo' },
            { entregavel: 'Informe de situación de las ocurrencias', periodicidade: 'Semanal', canal: 'Correo, personalizable' },
        ],
    },
};

export const SLA_GERAL_ES = [
    { entregavel: 'Inicio del monitoreo tras la aceptación', periodicidade: '3 días hábiles', canal: '—' },
    { entregavel: 'Reunión de seguimiento', periodicidade: 'Mensual', canal: 'Remota' },
    { entregavel: 'Límite de denuncias y mediaciones', so: 'ambos', periodicidade: 'Sin límite', canal: '—' },
];

export const INSUMOS_ES = {
    BBP: 'la relación de SKUs prioritarios y de sellers autorizados',
    BB: 'la lista de palabras clave a monitorear',
    GD: 'una safelist de dominios y perfiles oficiales',
};
