import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DATABASE_URL, max: 2 });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO quote_calculator');

    await client.query(`
      CREATE TABLE IF NOT EXISTS version_line_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id uuid NOT NULL REFERENCES quote_versions(id) ON DELETE CASCADE,
        name text NOT NULL,
        category text NOT NULL CHECK (category IN ('service','deliverable','pre_production')),
        hours_each numeric NOT NULL DEFAULT 0,
        quantity int NOT NULL DEFAULT 1,
        total_hours numeric NOT NULL DEFAULT 0,
        notes text,
        sort_order int NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_version_line_items_version_id
      ON version_line_items(version_id)
    `);

    await client.query('COMMIT');
    console.log('Migration complete: version_line_items table created');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void run();
