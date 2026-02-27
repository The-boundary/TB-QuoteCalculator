/**
 * Initializes quote_calculator schema with v2 tables.
 * Usage:
 *   SUPABASE_DATABASE_URL="postgresql://..." npx tsx src/scripts/setup-schema.ts
 */

import pg from 'pg';

const DATABASE_URL = process.env.SUPABASE_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('SUPABASE_DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA IF NOT EXISTS quote_calculator');
    await client.query('SET search_path TO quote_calculator');

    await client.query(`
      CREATE TABLE IF NOT EXISTS developments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        client_name text,
        description text,
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
        name text NOT NULL,
        kantata_id text UNIQUE,
        status text,
        is_forecasted boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        is_default boolean NOT NULL DEFAULT false,
        hours_per_second numeric NOT NULL,
        editing_hours_per_30s numeric NOT NULL DEFAULT 100,
        hourly_rate numeric NOT NULL DEFAULT 125,
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_card_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rate_card_id uuid NOT NULL REFERENCES rate_cards(id) ON DELETE CASCADE,
        shot_type text NOT NULL,
        category text NOT NULL CHECK (category IN ('scene','animation','post','material')),
        hours numeric NOT NULL,
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        mode text NOT NULL CHECK (mode IN ('retainer','budget')),
        status text NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','negotiating','awaiting_approval','confirmed','archived')),
        rate_card_id uuid NOT NULL REFERENCES rate_cards(id),
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_status_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        old_status text,
        new_status text NOT NULL,
        changed_by uuid NOT NULL,
        changed_by_email text,
        changed_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        version_number int NOT NULL,
        duration_seconds int NOT NULL,
        shot_count int NOT NULL,
        pool_budget_hours numeric,
        pool_budget_amount numeric,
        total_hours numeric NOT NULL DEFAULT 0,
        hourly_rate numeric NOT NULL DEFAULT 125,
        notes text,
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (quote_id, version_number)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS version_shots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id uuid NOT NULL REFERENCES quote_versions(id) ON DELETE CASCADE,
        shot_type text NOT NULL,
        percentage numeric NOT NULL,
        quantity int NOT NULL DEFAULT 1,
        base_hours_each numeric NOT NULL,
        efficiency_multiplier numeric NOT NULL DEFAULT 1.0,
        adjusted_hours numeric NOT NULL DEFAULT 0,
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS film_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        duration_seconds int NOT NULL,
        description text,
        rate_card_id uuid REFERENCES rate_cards(id) ON DELETE SET NULL,
        created_by uuid REFERENCES auth.users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS film_template_shots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id uuid NOT NULL REFERENCES film_templates(id) ON DELETE CASCADE,
        shot_type text NOT NULL,
        percentage numeric NOT NULL,
        efficiency_multiplier numeric NOT NULL DEFAULT 1.0,
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_projects_development_id ON projects(development_id)',
    );
    await client.query('CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON quotes(project_id)');
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_quote_status_log_quote_id ON quote_status_log(quote_id)',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_quote_versions_quote_id ON quote_versions(quote_id)',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_version_shots_version_id ON version_shots(version_id)',
    );

    const { rows: existingRateCard } = await client.query(
      "SELECT id FROM rate_cards WHERE name = 'DHRE 2025' LIMIT 1",
    );

    if (existingRateCard.length === 0) {
      const { rows: inserted } = await client.query(`
        INSERT INTO rate_cards (name, is_default, hours_per_second, editing_hours_per_30s, hourly_rate)
        VALUES ('DHRE 2025', true, 17.33, 100, 94.60)
        RETURNING id
      `);

      const rateCardId = inserted[0].id as string;
      const items = [
        ['Site/Masterplan Overview (wide)', 'scene', 80, 0],
        ['Aerial Exterior View', 'scene', 60, 1],
        ['Semi-Aerial Exterior View', 'scene', 60, 2],
        ['Street-Level Exterior', 'scene', 40, 3],
        ['Interior View', 'scene', 40, 4],
        ['Animation from Image (simple)', 'animation', 16, 5],
        ['Animation from Image (complex)', 'animation', 32, 6],
        ['Cinemagraph', 'animation', 12, 7],
        ['VFX Shot (pre-built)', 'animation', 32, 8],
        ['Material Board (regular)', 'material', 20, 9],
        ['Material Board (complex)', 'material', 32, 10],
        ['Vignette Detail', 'material', 16, 11],
      ] as const;

      for (const [shot_type, category, hours, sort_order] of items) {
        await client.query(
          `INSERT INTO rate_card_items (rate_card_id, shot_type, category, hours, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [rateCardId, shot_type, category, hours, sort_order],
        );
      }
    }

    await client.query('COMMIT');
    console.log('Schema v2 setup complete');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Schema setup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void run();
