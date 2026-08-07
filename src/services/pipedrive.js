/** Cliente Pipedrive mínimo — REST direto via fetch, sem SDK. */
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:pipedrive');

const BASE = 'https://api.pipedrive.com/v1';
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const TIMEOUT_MS = 15000;

export class PipedriveApiError extends Error {
    constructor({ method, endpoint, status, body }) {
        super(`Pipedrive ${method} ${endpoint} falhou (HTTP ${status}): ${body?.error || 'sem error no envelope'}`);
        this.name = 'PipedriveApiError';
        this.status = status;
        this.endpoint = endpoint;
    }
}

/**
 * Falha de chamada LANÇA — antes só logava um warning e devolvia o body, o que
 * fazia o chamador seguir como se tivesse dado certo. O caso ruim era a
 * gravação do "Link Proposta": falhava calada, a automação postava a nota de
 * sucesso, e o card ficava com a sentinela da trava — que vencia em 5 min e
 * gerava uma segunda proposta, órfã da primeira.
 */
function checkResponse(method, endpoint, res, body) {
    if (res.ok && body?.success !== false) return body;
    const detail = [body?.error, body?.error_info].filter(Boolean).join(' — ') || 'sem error no envelope';
    log.warn(`⚠️ Pipedrive ${method} ${endpoint} → HTTP ${res.status}: ${detail.slice(0, 300)}`);
    throw new PipedriveApiError({ method, endpoint, status: res.status, body });
}

export async function pdGet(endpoint) {
    if (!TOKEN) throw new Error('PIPEDRIVE_API_TOKEN não configurada');
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`${BASE}${endpoint}${sep}api_token=${TOKEN}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return checkResponse('GET', endpoint, res, await res.json());
}

export async function pdPut(endpoint, data) {
    if (!TOKEN) throw new Error('PIPEDRIVE_API_TOKEN não configurada');
    const res = await fetch(`${BASE}${endpoint}?api_token=${TOKEN}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return checkResponse('PUT', endpoint, res, await res.json());
}

export async function pdPost(endpoint, data) {
    if (!TOKEN) throw new Error('PIPEDRIVE_API_TOKEN não configurada');
    const res = await fetch(`${BASE}${endpoint}?api_token=${TOKEN}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return checkResponse('POST', endpoint, res, await res.json());
}
