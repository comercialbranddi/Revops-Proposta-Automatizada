/**
 * Bateria ponta a ponta pelo card de teste: monta cada cenário com o card
 * estacionado fora da fase, traz de volta pra "Envio de proposta" (o que gera
 * uma ENTRADA real no webhook) e confere o resultado — nota, link e conteúdo
 * do documento gerado.
 *
 * Restaura o estado original do card no fim, mesmo se algo falhar.
 *
 * Uso:
 *   node scripts/testa-fluxo.js
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import {
    PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P, CATALOGO_BBP_FIELD,
    PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, CANAIS_FIELDS as C,
} from '../src/config/proposal.js';

// IDs das opções dos campos de canal (ver CANAIS_OPTION_TO_LABEL na config).
const CANAL = {
    BB: { google: 1592, shopping: 1593, bing: 1594, amazonAds: 1595 },
    BBP: { ml: 1596, amazon: 1597, marketplaces: 1598 },
    GD: { google: 1599, meta: 1600, tld: 1601, marketplaces: 1602, apps: 1603 },
    VM: { marketplaces: 1604, shopping: 1605 },
};

const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = Number(process.env.PROPOSAL_TEST_DEAL_ID);
const PARADA = 13, FASE = 257;
const OPT = { BB: 152, BBP: 549, GD: 153, VM: 154 };

const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
const put = (d) => pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const notas = async () => ((await pd(`/notes?deal_id=${ID}&limit=100`)).data || []);

const key = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
async function docInfo(url) {
    const id = (String(url).match(/document\/d\/([\w-]+)/) || [])[1];
    if (!id) return null;
    const { token } = await gc.getAccessToken();
    const H = { Authorization: `Bearer ${token}` };
    const meta = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`, { headers: H })).json();
    const txt = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain&supportsAllDrives=true`, { headers: H })).text();
    return { nome: meta.name, txt };
}

// Estado neutro entre cenários: tudo limpo, pra um teste não herdar do outro.
const LIMPO = {
    [F.SERVICO_OFERECIDO]: '', [F.LINK_PROPOSTA]: '',
    [P.BB]: null, [P.BBP]: null, [P.GD]: null, [P.VM]: null,
    [CATALOGO_BBP_FIELD]: null, [PALAVRAS_BB_FIELD]: null,
    [PLATAFORMAS_VM_FIELD]: null, [VALOR_PACOTE_FIELD]: null,
    [C.BB]: '', [C.BBP]: '', [C.GD]: '', [C.VM]: '',
};

const CENARIOS = [
    {
        nome: 'BB só, completo',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 4 },
        espera: { gera: true, nome: /_BB_/, contem: ['R$ 8.000/mês', 'Até 4 palavras'], naoContem: ['De R$'] },
    },
    {
        nome: 'VM só, sem Plataformas VM',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.VM}`, [P.VM]: 4000 },
        espera: { gera: false, nota: /falta preencher.*Plataformas VM/i },
    },
    {
        nome: 'BB+GD, sem Preço GD',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.GD}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3 },
        espera: { gera: false, nota: /falta preencher Preço GD/i },
    },
    {
        nome: 'BB+BBP+VM sem valor de pacote',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.BBP},${OPT.VM}`,
            [P.BB]: 8000, [P.BBP]: 6000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 3, [CATALOGO_BBP_FIELD]: 150, [PLATAFORMAS_VM_FIELD]: 5,
        },
        espera: { gera: true, nome: /_BB\+BBP\+VM_/, contem: ['R$ 18.000/mês', 'Até 150 SKUs', 'Até 5 marketplaces'], naoContem: ['De R$'] },
    },
    {
        nome: 'BB+BBP+VM com valor de pacote',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.BBP},${OPT.VM}`,
            [P.BB]: 8000, [P.BBP]: 6000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 3, [CATALOGO_BBP_FIELD]: 150, [PLATAFORMAS_VM_FIELD]: 5,
            [VALOR_PACOTE_FIELD]: 15000,
        },
        espera: { gera: true, nome: /_BB\+BBP\+VM_/, contem: ['De R$ 18.000/mês', 'Por: R$ 15.000/mês'] },
    },
    {
        nome: 'os quatro produtos',
        campos: {
            [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.BBP},${OPT.GD},${OPT.VM}`,
            [P.BB]: 8000, [P.BBP]: 6000, [P.GD]: 9000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 2, [CATALOGO_BBP_FIELD]: 300, [PLATAFORMAS_VM_FIELD]: 3,
            [VALOR_PACOTE_FIELD]: 22000,
        },
        espera: { gera: true, nome: /_BB\+BBP\+GD\+VM_/, contem: ['De R$ 27.000/mês', 'Por: R$ 22.000/mês', 'Até 2 palavras', 'Até 300 SKUs', 'Até 3 marketplaces'] },
    },
    {
        nome: 'BB com Bing marcado no canal',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB}`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3,
            [C.BB]: `${CANAL.BB.google},${CANAL.BB.bing}` },
        espera: { gera: true, nome: /_BB_/, contem: ['Google Search Ads + Bing'] },
    },
    {
        nome: 'Bing ainda em "Serviço oferecido"',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB},416`, [P.BB]: 8000, [PALAVRAS_BB_FIELD]: 3 },
        espera: { gera: false, nota: /"Bing" agora é canal: marque em "Canais BB"/i },
    },
    {
        nome: 'GD com loja de aplicativos',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.GD}`, [P.GD]: 9000,
            [C.GD]: `${CANAL.GD.google},${CANAL.GD.meta},${CANAL.GD.apps}` },
        espera: { gera: true, nome: /_GD_/, contem: ['Lojas de aplicativos (Apple Store e Play Store)'] },
    },
    {
        nome: 'BBP com Amazon somado',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BBP}`, [P.BBP]: 6000, [CATALOGO_BBP_FIELD]: 150,
            [C.BBP]: `${CANAL.BBP.ml},${CANAL.BBP.amazon}` },
        espera: { gera: true, nome: /_BBP_/, contem: ['Mercado Livre + Amazon'] },
    },
    {
        nome: 'combo BB+VM com união de canais',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BB},${OPT.VM}`, [P.BB]: 8000, [P.VM]: 4000,
            [PALAVRAS_BB_FIELD]: 3, [PLATAFORMAS_VM_FIELD]: 4,
            [C.BB]: `${CANAL.BB.google},${CANAL.BB.bing}`,
            [C.VM]: `${CANAL.VM.marketplaces},${CANAL.VM.shopping}` },
        espera: { gera: true, nome: /_BB\+VM_/,
            contem: ['Google Search Ads + Bing + Até 4 marketplaces monitorados simultaneamente + Google Shopping'] },
    },
    {
        nome: 'canal vazio cai no padrão do produto',
        campos: { [F.SERVICO_OFERECIDO]: `${OPT.BBP}`, [P.BBP]: 6000, [CATALOGO_BBP_FIELD]: 200 },
        espera: { gera: true, contem: ['Mercado Livre'], naoContem: ['Amazon'] },
    },
];

const inicial = (await pd(`/deals/${ID}`)).data;
const snapshot = {
    stage_id: inicial.stage_id,
    ...Object.fromEntries(Object.keys(LIMPO).map((k) => [k, inicial[k] ?? null])),
};

const falhas = [];
try {
    for (const c of CENARIOS) {
        await put({ stage_id: PARADA }); await espera(2500);
        await put({ ...LIMPO, ...c.campos }); await espera(2500);
        const antes = await notas();
        await put({ stage_id: FASE });
        await espera(30000);

        const novas = (await notas()).filter((n) => !antes.some((a) => a.id === n.id))
            .map((n) => n.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' '));
        const link = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || '';
        const problemas = [];

        if (c.espera.gera) {
            if (!link) problemas.push('não gerou');
            else {
                const info = await docInfo(link);
                if (c.espera.nome && !c.espera.nome.test(info.nome)) problemas.push(`modelo errado: ${info.nome}`);
                for (const s of c.espera.contem || []) if (!info.txt.includes(s)) problemas.push(`faltou "${s}"`);
                for (const s of c.espera.naoContem || []) if (info.txt.includes(s)) problemas.push(`não devia ter "${s}"`);
                if (/\{\{[A-Z_]+\}\}/.test(info.txt)) problemas.push('placeholder solto');
            }
        } else {
            if (link) problemas.push(`gerou quando não devia: ${link.slice(-12)}`);
            if (c.espera.nota && !novas.some((n) => c.espera.nota.test(n))) problemas.push(`nota esperada não veio (veio: ${novas.join(' | ').slice(0, 80) || 'nenhuma'})`);
        }

        if (problemas.length) falhas.push(`${c.nome}: ${problemas.join('; ')}`);
        console.log(`${problemas.length ? '❌' : '✅'} ${c.nome.padEnd(34)} ${problemas.join('; ') || 'ok'}`);
    }
} finally {
    await put({ stage_id: PARADA }); await espera(2000);
    await put(snapshot);
    console.log('\ncard restaurado ao estado inicial');
}

console.log(falhas.length ? `\n❌ ${falhas.length} cenário(s) com problema` : '\n✅ todos os cenários passaram');
