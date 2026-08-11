/**
 * Leitura da flag --idioma dos scripts que operam sobre os modelos.
 *
 * Vive num módulo só porque a validação é o ponto: sete scripts aceitam esta
 * flag e a maioria tem --apply. Um "--idioma=eng" digitado errado caindo
 * calado no português mandaria um --apply em cima dos modelos de produção.
 * Aqui, idioma desconhecido mata o processo antes de qualquer escrita.
 *
 * Aceita as duas formas ("--idioma=en" e "--idioma en"); sem a flag, devolve
 * o padrão, que é como todos esses scripts se comportavam antes de existirem
 * modelos em outro idioma.
 */
import { PROPOSAL_TEMPLATES, IDIOMA_PADRAO, IDIOMA_LABEL } from '../src/config/proposal.js';

export function idiomaDaLinhaDeComando(argv = process.argv) {
    const comIgual = argv.find((a) => a.startsWith('--idioma='));
    const pos = argv.indexOf('--idioma');
    const bruto = comIgual ? comIgual.split('=')[1] : (pos !== -1 ? argv[pos + 1] : null);
    if (!bruto) return IDIOMA_PADRAO;

    const idioma = bruto.trim().toLowerCase();
    const conhecidos = Object.keys(PROPOSAL_TEMPLATES);
    if (!conhecidos.includes(idioma)) {
        console.error(`Idioma inválido: "${bruto}". Use um de: ${conhecidos.join(', ')}`);
        process.exit(1);
    }
    return idioma;
}

/** Cabeçalho pros scripts dizerem em que idioma estão operando. */
export function avisoDeIdioma(idioma, total) {
    const nome = IDIOMA_LABEL[idioma] || idioma;
    if (total === 0) {
        console.error(`Nenhum modelo cadastrado em ${nome} — nada a fazer. Ver HANDOFF-IDIOMAS.md §3.`);
        process.exit(1);
    }
    return `idioma: ${nome} (${idioma}) — ${total} modelo(s)`;
}
