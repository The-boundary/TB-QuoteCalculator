import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

import { logger } from '../utils/logger.js';

// Supabase REST client (tower_watch schema — for TowerWatch auth)

type AnySupabaseClient = SupabaseClient<any, any, any>;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const authSupabase: AnySupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { db: { schema: 'tower_watch' } })
    : null;

if (!supabaseUrl || !supabaseKey) {
  logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - Supabase API client disabled');
}

export function getAuthSupabaseClient(): AnySupabaseClient | null {
  return authSupabase;
}

// Direct Postgres pool (quote_calculator schema)

const SCHEMA = 'quote_calculator';

const pool = process.env.SUPABASE_DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.SUPABASE_DATABASE_URL, max: 10 })
  : null;

if (!pool) {
  logger.warn('SUPABASE_DATABASE_URL not set - quote_calculator direct DB access disabled');
}

/** Run a query against the quote_calculator schema. Automatically sets search_path. */
export async function dbQuery<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error('Database not configured (SUPABASE_DATABASE_URL missing)');
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${SCHEMA}`);
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/** Run multiple queries in a transaction against quote_calculator schema. */
export async function dbTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  if (!pool) throw new Error('Database not configured (SUPABASE_DATABASE_URL missing)');
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${SCHEMA}`);
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
