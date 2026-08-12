/**
 * Bateria da frente de APP: serviço vendido que não tem modelo automatizado.
 *
 * A regra é "gera o que tem modelo, avisa o que falta" — só bloqueia quando
 * nenhum produto do card tem modelo. Isto cobre as duas pontas e o meio:
 * APP sozinho, APP com cada produto, e APP em combinação.
 *
 * Roda o generator DIRETO (não pelo webhook), então testa o código local sem
 * depender de deploy.
 *
 * Uso:
 *   node scripts/testa-app.js
 */
import 'dotenv/config';
import { JWT } from 'google-auth-library';
import { generateProposalForDeal } from '../src/services/proposal-generator.js';
import {
    PROPOSAL_DEAL_FIELDS as F, PRODUCT_PRICE_FIELDS as P, CATALOGO_BBP_FIELD,
    PALAVRAS_BB_FIELD, PLATAFORMAS_VM_FIELD, VALOR_PACOTE_FIELD, CANAIS_FIELDS as C,
} from '../src/config/proposal.js';

const T = process.env.PIPEDRIVE_API_TOKEN;
const ID = Number(process.env.PROPOSAL_TEST_DEAL_ID);
const OPT = { BB: 152, BBP: 549, GD: 153, VM: 154, APP: 415, NOVOS: 697 };

const pd = async (p, o) => (await (await fetch(`https://api.pipedrive.com/v1${p}${p.includes('?') ? '&' : '?'}api_token=${T}`, o)).json());
const put = (d) => pd(`/deals/${ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
// Sem o sort, o Pipedrive devolve as notas MAIS ANTIGAS — as recentes,
// que sao as que este teste precisa ver, nunca entrariam na lista.
const notas = async () => ((await pd(`/notes?deal_id=${ID}&limit=60&sort=${encodeURIComponent('add_time DESC')}`)).data || []);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const gkey = JSON.parse(Buffer.from(process.env.GOOGLE_PROPOSAL_SA_KEY_BASE64, 'base64').toString());
const gc = new JWT({ email: gkey.client_email, key: gkey.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
async function nomeDoDoc(url) {
    const id = (String(url).match(/document\/d\/([\w-]+)/) || [])[1];
    if (!id) return null;
    const { token } = await gc.getAccessToken();
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? (await r.json()).name : null;
}

// Todos os campos preenchidos: o foco aqui é o APP, não a validação de campo.
const COMPLETO = {
    [P.BB]: 8000, [P.BBP]: 6000, [P.GD]: 9000, [P.VM]: 4000,
    [PALAVRAS_BB_FIELD]: 3, [CATALOGO_BBP_FIELD]: 150, [PLATAFORMAS_VM_FIELD]: 4,
    [VALOR_PACOTE_FIELD]: null, [C.BB]: '', [C.BBP]: '', [C.GD]: '', [C.VM]: '',
};

const CENARIOS = [
    { nome: 'APP sozinho',            servicos: [OPT.APP],                          gera: false, falta: ['APP'] },
    { nome: 'APP + Novos Termos',     servicos: [OPT.APP, OPT.NOVOS],               gera: false, falta: ['APP', 'Novos Termos'] },
    { nome: 'BB + APP',               servicos: [OPT.BB, OPT.APP],                  gera: '_BB_',            falta: ['APP'] },
    { nome: 'BBP + APP',              servicos: [OPT.BBP, OPT.APP],                 gera: '_BBP_',           falta: ['APP'] },
    { nome: 'GD + APP',               servicos: [OPT.GD, OPT.APP],                  gera: '_GD_',            falta: ['APP'] },
    { nome: 'VM + APP',               servicos: [OPT.VM, OPT.APP],                  gera: '_VM_',            falta: ['APP'] },
    { nome: 'BB + GD + APP',          servicos: [OPT.BB, OPT.GD, OPT.APP],          gera: '_BB+GD_',         falta: ['APP'] },
    { nome: 'BB + BBP + VM + APP',    servicos: [OPT.BB, OPT.BBP, OPT.VM, OPT.APP], gera: '_BB+BBP+VM_',     falta: ['APP'] },
    { nome: 'os 4 produtos + APP',    servicos: [OPT.BB, OPT.BBP, OPT.GD, OPT.VM, OPT.APP], gera: '_BB+BBP+GD+VM_', falta: ['APP'] },
    { nome: 'BB + APP + Novos Termos', servicos: [OPT.BB, OPT.APP, OPT.NOVOS],      gera: '_BB_',            falta: ['APP', 'Novos Termos'] },
    { nome: 'BB puro (controle)',     servicos: [OPT.BB],                           gera: '_BB_',            falta: [] },
];

const inicial = (await pd(`/deals/${ID}`)).data;
const snapshot = {
    [F.SERVICO_OFERECIDO]: inicial[F.SERVICO_OFERECIDO] || '',
    [F.LINK_PROPOSTA]: '',
    ...Object.fromEntries(Object.keys(COMPLETO).map((k) => [k, inicial[k] ?? null])),
};

const falhas = [];
console.log('cenário                        gerou   nota        avisa o que falta');
console.log('─'.repeat(78));

try {
    for (const c of CENARIOS) {
        await put({ ...COMPLETO, [F.SERVICO_OFERECIDO]: c.servicos.join(','), [F.LINK_PROPOSTA]: '' });
        await espera(1200);
        const antes = await notas();
        await generateProposalForDeal(ID, { notifyOnEntry: true });

        // O campo pode estar com a sentinela da trava ("gerando proposta") se a
        // geração ainda não fechou. Sentinela não é documento — esperar aqui
        // evita ler o campo no meio do caminho e concluir errado.
        let link = '';
        for (let i = 0; i < 5; i++) {
            link = (await pd(`/deals/${ID}`)).data[F.LINK_PROPOSTA] || '';
            if (!link.includes('gerando proposta')) break;
            await espera(2000);
        }
        if (link.includes('gerando proposta')) link = '';
        const novas = (await notas()).filter((n) => !antes.some((a) => a.id === n.id))
            .map((n) => n.content.replace(/<[^>]*>/g, ''));
        const texto = novas.join('\n');

        // A nota pode ter sido legitimamente suprimida: o generator não repete
        // a mesma mensagem em 5 min, e rodar a bateria duas vezes seguidas cai
        // nisso. Então o que se exige sempre é o RESULTADO (gerou ou não); o
        // texto só é cobrado quando alguma nota foi de fato postada agora.
        const houveNota = texto.trim().length > 0;
        const problemas = [];
        if (c.gera === false) {
            if (link) problemas.push('gerou quando não devia');
            if (houveNota && !/não gerada automaticamente/i.test(texto)) problemas.push('nota de bloqueio com texto errado');
        } else if (!link) {
            problemas.push('NÃO gerou');
        } else {
            // Confere que veio o MODELO certo, não só que veio alguma coisa: o
            // nome do arquivo carrega a chave da combinação.
            // O Drive leva um instante pra indexar a cópia recém-criada, e o
            // tempo varia — uma tentativa só deixa o teste instável.
            let nome = null;
            for (let i = 0; i < 4 && !nome; i++) {
                if (i) await espera(1500 * i);
                nome = await nomeDoDoc(link);
            }
            if (!nome) problemas.push('não consegui ler o nome do documento');
            else if (!nome.includes(c.gera)) problemas.push(`modelo errado: ${nome}`);
        }
        // O aviso do que ficou de fora tem que estar na nota, gerando ou não.
        if (houveNota) {
            for (const f of c.falta) {
                const esperado = c.gera === false ? new RegExp(f, 'i') : new RegExp(`NÃO cobre[^.]*${f}`, 'i');
                if (!esperado.test(texto)) problemas.push(`não avisou "${f}"`);
            }
        }
        if (houveNota && !c.falta.length && /NÃO cobre/i.test(texto)) problemas.push('avisou falta sem ter falta');

        if (problemas.length) falhas.push(`${c.nome}: ${problemas.join('; ')}`);
        const marca = problemas.length ? '❌' : '✅';
        console.log(`${marca} ${c.nome.padEnd(29)} ${(link ? 'sim' : 'não').padEnd(7)} ${(houveNota ? 'nota nova' : 'dedupe').padEnd(11)} ${c.falta.join(', ') || '—'}`);
    }
} finally {
    await put(snapshot);
    console.log('\ncard restaurado');
}

console.log(falhas.length ? `\n❌ ${falhas.length} problema(s):\n   ${falhas.join('\n   ')}` : '\n✅ toda a frente de APP passou');
