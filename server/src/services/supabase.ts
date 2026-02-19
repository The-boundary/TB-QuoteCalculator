import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Use a wide type alias so callers don't fight the schema generic
type AnySupabaseClient = SupabaseClient<any, any, any>;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createSchemaClient(schema: string): AnySupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { db: { schema } });
}

const supabase = createSchemaClient('public');
const authSupabase = createSchemaClient('public');

if (!supabaseUrl || !supabaseKey) {
  logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - Supabase disabled');
}

export function getSupabaseClient(): AnySupabaseClient | null {
  return supabase;
}

export function getAuthSupabaseClient(): AnySupabaseClient | null {
  return authSupabase;
}

export { supabase };
