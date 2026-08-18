/**
 * Garante os campos novos de escopo da proposta: marcas monitoradas e
 * modalidade por produto.
 *
 * Modalidade é POR PRODUTO — decisão da Jessica em 18/08/2026. Dá pra vender
 * Brand Bidding com atuação e Violação de Marca só com monitoria no mesmo
 * contrato, então cada produto tem seu campo, mesmo padrão que preço
 * (PRODUCT_PRICE_FIELDS) e canais (CANAIS_FIELDS) já seguem.
 *
 * Isso NÃO é cosmético: o bloco de BB promete "redação, envio e acompanhamento
 * de notificações extrajudiciais". Numa venda só de monitoria a frase é falsa.
 * Enquanto a renderização por blocos não existir, o gerador precisa BLOQUEAR o
 * que não for "Monitoria + Atuação" — é o que os 45 modelos atuais descrevem.
 *
 * Marcas é global: vale pra todos os produtos do card. Hoje {{MARCA}} é o
 * org_name — uma string só, que não comporta cliente com mais de uma marca.
 *
 * Território NÃO virou campo (decisão da Jessica em 18/08/2026): a cobertura da
 * proposta é a dos idiomas que já têm modelo — pt, en e es. O campo "Idioma da
 * proposta", que já existe, carrega essa dimensão sozinho.
 *
 * Uso:
 *   node scripts/campos-escopo-proposta.js            # simulação
 *   node scripts/campos-escopo-proposta.js --apply
 */
import 'dotenv/config';
import { CATALOGO_BBP_FIELD } from '../src/config/proposal.js';

const APPLY = process.argv.includes('--apply');
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;

const api = async (path, opts = {}) => {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.pipedrive.com/v1${path}${sep}api_token=${TOKEN}`, {
        ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    return body.data;
};

// As três modalidades que a Jessica descreveu: monitorar sem atuar, atuar sem
// monitorar, ou os dois. "Monitoria + Atuação" é o que TODOS os modelos atuais
// descrevem — por isso é a primeira opção, que vira o default visual.
const MODALIDADES = [
    { label: 'Monitoria + Atuação' },
    { label: 'Monitoria' },
    { label: 'Atuação' },
];

const DESEJADO = [
    { name: 'Marcas monitoradas', field_type: 'text' },
    { name: 'Modalidade BB', field_type: 'enum', options: MODALIDADES },
    { name: 'Modalidade BBP', field_type: 'enum', options: MODALIDADES },
    { name: 'Modalidade GD', field_type: 'enum', options: MODALIDADES },
    { name: 'Modalidade VM', field_type: 'enum', options: MODALIDADES },
];

const campos = await api('/dealFields?limit=500');

// Grupo: o mesmo dos campos da proposta que já existem, pra não espalhar mais
// dado num deal que já tem 49 customizados.
const molde = campos.find((c) => c.key === CATALOGO_BBP_FIELD);
if (!molde) { console.error('não achei "Catálogo BBP (SKUs)" pra copiar o grupo'); process.exit(1); }
console.log(`grupo dos campos da proposta: ${molde.group_id}\n`);

let mudancas = 0;
const criados = [];
for (const alvo of DESEJADO) {
    const atual = campos.find((c) => c.name === alvo.name);
    if (atual) { console.log(`✅ "${alvo.name}" já existe — ${atual.key}`); continue; }
    mudancas++;
    if (!APPLY) {
        const ops = alvo.options ? ` (${alvo.options.length} opções)` : '';
        console.log(`   [simulação] criaria "${alvo.name}" tipo=${alvo.field_type}${ops}`);
        continue;
    }
    const d = await api('/dealFields', {
        method: 'POST',
        body: JSON.stringify({ ...alvo, group_id: molde.group_id }),
    });
    console.log(`✏️  criado "${alvo.name}" — ${d.key}`);
    criados.push({ name: alvo.name, key: d.key, options: d.options });
}

if (criados.length) {
    console.log('\n⚠️  chaves NOVAS — acrescentar em src/config/proposal.js:');
    for (const c of criados) {
        console.log(`   ${c.name}: '${c.key}'`);
        if (c.options) console.log(`      opções: ${c.options.map((o) => `${o.id}=${o.label}`).join(', ')}`);
    }
}

console.log(mudancas === 0
    ? '\n✅ todos os campos já existem'
    : (APPLY ? `\n✅ ${mudancas} campo(s) criado(s)` : `\n[simulação] ${mudancas} campo(s) a criar — rode com --apply`));
