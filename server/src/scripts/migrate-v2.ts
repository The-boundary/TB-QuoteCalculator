import pg from 'pg';

const DATABASE_URL = process.env.SUPABASE_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('SUPABASE_DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function migrate() {
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

    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_dev ON projects(development_id)');
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_projects_kantata ON projects(kantata_id) WHERE kantata_id IS NOT NULL',
    );

    await client.query(
      'ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 125',
    );

    await client.query(
      'ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)',
    );
    await client.query(
      "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'retainer'",
    );
    await client.query('ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check');
    await client.query("UPDATE quotes SET status = 'confirmed' WHERE status = 'approved'");
    await client.query(
      "UPDATE quotes SET status = 'negotiating' WHERE status = 'pending_approval'",
    );
    await client.query("UPDATE quotes SET status = 'archived' WHERE status = 'sent'");
    await client.query(`
      ALTER TABLE quotes
      ADD CONSTRAINT quotes_status_check
      CHECK (status IN ('draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived'))
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

    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_status_log_quote ON quote_status_log(quote_id)',
    );

    await client.query('ALTER TABLE quote_versions ADD COLUMN IF NOT EXISTS shot_count int');
    await client.query(
      'ALTER TABLE quote_versions ADD COLUMN IF NOT EXISTS pool_budget_amount numeric',
    );
    await client.query(
      'ALTER TABLE quote_versions ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 125',
    );
    await client.query('ALTER TABLE quote_versions ALTER COLUMN pool_budget_hours DROP NOT NULL');

    await client.query(
      'ALTER TABLE version_shots ADD COLUMN IF NOT EXISTS percentage numeric NOT NULL DEFAULT 0',
    );

    await client.query(
      'ALTER TABLE film_template_shots ADD COLUMN IF NOT EXISTS percentage numeric NOT NULL DEFAULT 0',
    );
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'quote_calculator'
            AND table_name = 'film_template_shots'
            AND column_name = 'quantity'
        ) THEN
          UPDATE film_template_shots fts
          SET percentage = t.pct
          FROM (
            SELECT id,
                   CASE
                     WHEN sum_qty.total_qty > 0 THEN (quantity::numeric / sum_qty.total_qty) * 100
                     ELSE 0
                   END AS pct
            FROM film_template_shots
            JOIN (
              SELECT template_id, SUM(quantity) AS total_qty
              FROM film_template_shots
              GROUP BY template_id
            ) AS sum_qty ON sum_qty.template_id = film_template_shots.template_id
          ) AS t
          WHERE fts.id = t.id;

          ALTER TABLE film_template_shots DROP COLUMN quantity;
        END IF;
      END $$;
    `);

    await client.query('ALTER TABLE quotes DROP COLUMN IF EXISTS client_name');
    await client.query('ALTER TABLE quotes DROP COLUMN IF EXISTS project_name');

    const { rows: templates } = await client.query(
      "SELECT id, name FROM film_templates WHERE name IN ('Masterplan Film', 'Community Film', 'Product Film')",
    );
    const existingByName = new Map(templates.map((row) => [row.name, row.id]));

    const ensureTemplate = async (
      name: string,
      description: string,
      shots: Array<{ shot_type: string; percentage: number; sort_order: number }>,
    ) => {
      let templateId = existingByName.get(name);
      if (!templateId) {
        const { rows } = await client.query(
          'INSERT INTO film_templates (name, duration_seconds, description) VALUES ($1, 60, $2) RETURNING id',
          [name, description],
        );
        templateId = rows[0].id as string;
      }

      const { rows: existingShots } = await client.query(
        'SELECT id FROM film_template_shots WHERE template_id = $1 LIMIT 1',
        [templateId],
      );

      if (existingShots.length === 0) {
        for (const shot of shots) {
          await client.query(
            `INSERT INTO film_template_shots
              (template_id, shot_type, percentage, efficiency_multiplier, sort_order)
             VALUES ($1, $2, $3, 1.0, $4)`,
            [templateId, shot.shot_type, shot.percentage, shot.sort_order],
          );
        }
      }
    };

    await ensureTemplate('Masterplan Film', 'Standard masterplan aerial film', [
      { shot_type: 'Site/Masterplan Overview (wide)', percentage: 20, sort_order: 0 },
      { shot_type: 'Aerial Exterior View', percentage: 40, sort_order: 1 },
      { shot_type: 'Street-Level Exterior', percentage: 40, sort_order: 2 },
    ]);

    await ensureTemplate('Community Film', 'Community-focused film with mixed perspectives', [
      { shot_type: 'Aerial Exterior View', percentage: 25, sort_order: 0 },
      { shot_type: 'Semi-Aerial Exterior View', percentage: 25, sort_order: 1 },
      { shot_type: 'Street-Level Exterior', percentage: 50, sort_order: 2 },
    ]);

    await ensureTemplate('Product Film', 'Interior-focused product showcase', [
      { shot_type: 'Aerial Exterior View', percentage: 20, sort_order: 0 },
      { shot_type: 'Street-Level Exterior', percentage: 20, sort_order: 1 },
      { shot_type: 'Interior View', percentage: 60, sort_order: 2 },
    ]);

    await client.query('COMMIT');
    console.log('Migration v2 complete');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate();
