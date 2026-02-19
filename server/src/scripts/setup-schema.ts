/**
 * Setup the quote_calculator schema in Supabase PostgreSQL.
 * Creates all tables + seeds the DHRE 2025 rate card.
 *
 * Usage:
 *   SUPABASE_DATABASE_URL="postgresql://postgres:PASSWORD@192.168.0.74:5433/postgres" npx tsx src/scripts/setup-schema.ts
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

    // ── Schema ──────────────────────────────────────────────
    await client.query(`CREATE SCHEMA IF NOT EXISTS quote_calculator`);

    // ── rate_cards ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_calculator.rate_cards (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text NOT NULL,
        is_default    boolean NOT NULL DEFAULT false,
        hours_per_second     numeric NOT NULL,
        editing_hours_per_30s numeric NOT NULL DEFAULT 100,
        created_by    uuid REFERENCES auth.users(id),
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── rate_card_items ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_calculator.rate_card_items (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rate_card_id  uuid NOT NULL REFERENCES quote_calculator.rate_cards(id) ON DELETE CASCADE,
        shot_type     text NOT NULL,
        category      text NOT NULL CHECK (category IN ('scene','animation','post','material')),
        hours         numeric NOT NULL,
        sort_order    int NOT NULL DEFAULT 0
      )
    `);

    // ── quotes ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_calculator.quotes (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_name   text NOT NULL,
        project_name  text NOT NULL,
        status        text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','pending_approval','approved','sent','archived')),
        rate_card_id  uuid NOT NULL REFERENCES quote_calculator.rate_cards(id),
        created_by    uuid REFERENCES auth.users(id),
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ── quote_versions ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_calculator.quote_versions (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id         uuid NOT NULL REFERENCES quote_calculator.quotes(id) ON DELETE CASCADE,
        version_number   int NOT NULL,
        duration_seconds int NOT NULL,
        pool_budget_hours numeric NOT NULL,
        total_hours      numeric NOT NULL DEFAULT 0,
        notes            text,
        created_by       uuid REFERENCES auth.users(id),
        created_at       timestamptz NOT NULL DEFAULT now(),
        UNIQUE (quote_id, version_number)
      )
    `);

    // ── version_shots ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS quote_calculator.version_shots (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id            uuid NOT NULL REFERENCES quote_calculator.quote_versions(id) ON DELETE CASCADE,
        shot_type             text NOT NULL,
        quantity              int NOT NULL DEFAULT 1,
        base_hours_each       numeric NOT NULL,
        efficiency_multiplier numeric NOT NULL DEFAULT 1.0,
        adjusted_hours        numeric NOT NULL DEFAULT 0,
        sort_order            int NOT NULL DEFAULT 0
      )
    `);

    // ── Indexes ─────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_card_items_card ON quote_calculator.rate_card_items(rate_card_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quote_calculator.quotes(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quotes_status ON quote_calculator.quotes(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quote_versions_quote ON quote_calculator.quote_versions(quote_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_version_shots_version ON quote_calculator.version_shots(version_id)`);

    // ── Seed: DHRE 2025 rate card ───────────────────────────
    const existing = await client.query(
      `SELECT id FROM quote_calculator.rate_cards WHERE name = 'DHRE 2025' LIMIT 1`
    );

    if (existing.rows.length === 0) {
      const rcResult = await client.query(`
        INSERT INTO quote_calculator.rate_cards (name, is_default, hours_per_second, editing_hours_per_30s)
        VALUES ('DHRE 2025', true, 17.33, 100)
        RETURNING id
      `);
      const rateCardId = rcResult.rows[0].id;

      const items = [
        { shot_type: 'Site/Masterplan Overview (wide)', category: 'scene', hours: 80, sort_order: 1 },
        { shot_type: 'Aerial Exterior View', category: 'scene', hours: 60, sort_order: 2 },
        { shot_type: 'Semi-Aerial Exterior View', category: 'scene', hours: 60, sort_order: 3 },
        { shot_type: 'Street-Level Exterior', category: 'scene', hours: 40, sort_order: 4 },
        { shot_type: 'Interior View', category: 'scene', hours: 40, sort_order: 5 },
        { shot_type: 'Animation from Image (simple)', category: 'animation', hours: 16, sort_order: 6 },
        { shot_type: 'Animation from Image (complex)', category: 'animation', hours: 32, sort_order: 7 },
        { shot_type: 'Cinemagraph', category: 'animation', hours: 12, sort_order: 8 },
        { shot_type: 'VFX Shot (pre-built)', category: 'animation', hours: 32, sort_order: 9 },
        { shot_type: 'Material Board (regular)', category: 'material', hours: 20, sort_order: 10 },
        { shot_type: 'Material Board (complex)', category: 'material', hours: 32, sort_order: 11 },
        { shot_type: 'Vignette Detail', category: 'material', hours: 16, sort_order: 12 },
      ];

      for (const item of items) {
        await client.query(
          `INSERT INTO quote_calculator.rate_card_items (rate_card_id, shot_type, category, hours, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [rateCardId, item.shot_type, item.category, item.hours, item.sort_order]
        );
      }

      console.log(`Seeded DHRE 2025 rate card with ${items.length} items (id: ${rateCardId})`);
    } else {
      console.log('DHRE 2025 rate card already exists, skipping seed');
    }

    await client.query('COMMIT');
    console.log('Schema setup complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Schema setup failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
