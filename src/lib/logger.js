/** Logger mínimo — prefixa cada linha com o nome do módulo. Sem dependência externa. */
export function getContextLogger(name) {
    const prefix = `[${name}]`;
    return {
        info: (...args) => console.log(prefix, ...args),
        warn: (...args) => console.warn(prefix, ...args),
        error: (...args) => console.error(prefix, ...args),
    };
}
