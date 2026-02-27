import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DATABASE_URL, max: 2 });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO quote_calculator');

    // version_modules — single source of truth for animation_complexity
    await client.query(`
      CREATE TABLE IF NOT EXISTS version_modules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id uuid NOT NULL REFERENCES quote_versions(id) ON DELETE CASCADE,
        name text NOT NULL,
        module_type text NOT NULL CHECK (module_type IN ('film','supplementary')),
        duration_seconds int,
        shot_count int,
        animation_complexity text NOT NULL DEFAULT 'regular'
          CHECK (animation_complexity IN ('regular','complex')),
        sort_order int NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_version_modules_version_id
      ON version_modules(version_id)
    `);

    // Add module_id, is_companion, animation_override to version_shots
    await client.query(`
      ALTER TABLE version_shots
      ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES version_modules(id) ON DELETE CASCADE
    `);
    await client.query(`
      ALTER TABLE version_shots
      ADD COLUMN IF NOT EXISTS is_companion boolean NOT NULL DEFAULT false
    `);
    await client.query(`
      ALTER TABLE version_shots
      ADD COLUMN IF NOT EXISTS animation_override text DEFAULT NULL
        CHECK (animation_override IS NULL OR animation_override IN ('regular','complex'))
    `);

    // Backfill: create a default module for each existing version
    await client.query(`
      INSERT INTO version_modules (version_id, name, module_type, duration_seconds, shot_count, sort_order)
      SELECT qv.id, 'Film 1', 'film', qv.duration_seconds, qv.shot_count, 0
      FROM quote_versions qv
      WHERE NOT EXISTS (
        SELECT 1 FROM version_modules vm WHERE vm.version_id = qv.id
      )
    `);

    // Link existing shots to their default module
    await client.query(`
      UPDATE version_shots vs
      SET module_id = (
        SELECT vm.id FROM version_modules vm
        WHERE vm.version_id = vs.version_id
        ORDER BY vm.sort_order, vm.id
        LIMIT 1
      )
      WHERE vs.module_id IS NULL
    `);

    // NOTE: module_id is left nullable here. Step B tightens to NOT NULL
    // AFTER the new server code is deployed (which always provides module_id on INSERT).

    await client.query('COMMIT');
    console.log(
      'Migration step A complete: version_modules + animation companion fields + backfill',
    );
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
