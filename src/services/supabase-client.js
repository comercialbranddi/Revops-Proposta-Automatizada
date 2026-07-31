/** Supabase client — singleton. Roda sem banco se as env vars não existirem. */
import { createClient } from '@supabase/supabase-js';
import { getContextLogger } from '../lib/logger.js';

const log = getContextLogger('services:supabase-client');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    log.info('✅ Supabase client inicializado');
} else {
    log.info('⚠️ SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes — rodando sem banco');
}

export default supabase;
