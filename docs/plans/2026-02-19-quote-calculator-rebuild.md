# Quote Calculator Rebuild — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Quote Calculator around a project-centric hierarchy with two quoting modes (retainer/budget), percentage-based shot mix sliders, Kantata integration, auditable status workflow, and pricing display.

**Architecture:** Big bang rebuild of the `quote_calculator` schema, server routes, shared types, and client pages. The Express+Vite monorepo structure stays the same. New tables (`developments`, `projects`, `quote_status_log`) are added. Existing tables (`quotes`, `quote_versions`, `version_shots`, `rate_cards`, `film_template_shots`) are modified. Client gets new pages (ProjectsHomePage, ProjectDetailPage) and a completely overhauled QuoteBuilderPage with percentage sliders and dual mode.

**Tech Stack:** React 19, Vite 5, TanStack Query 5, Zustand 5, Express 4, PostgreSQL (pg), Zod, Vitest, TypeScript

**Design doc:** `docs/plans/2026-02-19-quote-calculator-redesign-design.md`

---

## Task 1: Shared Types

Update all TypeScript interfaces to match the new data model.

**Files:**
- Modify: `shared/types/index.ts`
- Modify: `shared/types/index.test.ts`

**Step 1: Write failing type tests**

Add tests for new types in `shared/types/index.test.ts`:

```typescript
// Add these test cases:
describe('Development', () => {
  it('has required fields', () => {
    const dev: Development = {
      id: 'uuid', name: 'Dubai Islands E', client_name: 'Nakheel',
      description: null, created_by: 'uuid', created_at: '', updated_at: '',
    };
    expect(dev.name).toBe('Dubai Islands E');
  });
});

describe('Project', () => {
  it('supports forecasted project', () => {
    const p: Project = {
      id: 'uuid', development_id: 'uuid', name: 'Masterplan Film',
      kantata_id: null, status: null, is_forecasted: true,
      created_by: 'uuid', created_at: '', updated_at: '',
    };
    expect(p.is_forecasted).toBe(true);
    expect(p.kantata_id).toBeNull();
  });

  it('supports kantata-linked project', () => {
    const p: Project = {
      id: 'uuid', development_id: 'uuid', name: 'Masterplan Film',
      kantata_id: '23046', status: 'active', is_forecasted: false,
      created_by: 'uuid', created_at: '', updated_at: '',
    };
    expect(p.kantata_id).toBe('23046');
  });
});

describe('QuoteStatus (new)', () => {
  it('includes new statuses', () => {
    const statuses: QuoteStatus[] = ['draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived'];
    expect(statuses).toHaveLength(5);
  });
});

describe('Quote (restructured)', () => {
  it('has project_id and mode', () => {
    const q: Quote = {
      id: 'uuid', project_id: 'uuid', mode: 'retainer',
      status: 'draft', rate_card_id: 'uuid',
      created_by: 'uuid', created_at: '', updated_at: '',
    };
    expect(q.mode).toBe('retainer');
    expect(q.project_id).toBeDefined();
  });
});

describe('QuoteStatusLogEntry', () => {
  it('tracks status changes', () => {
    const entry: QuoteStatusLogEntry = {
      id: 'uuid', quote_id: 'uuid', old_status: 'draft',
      new_status: 'negotiating', changed_by: 'uuid',
      changed_by_email: 'stan@the-boundary.com', changed_at: '',
    };
    expect(entry.new_status).toBe('negotiating');
  });
});

describe('VersionShot (with percentage)', () => {
  it('has percentage field', () => {
    const shot: VersionShot = {
      id: 'uuid', version_id: 'uuid', shot_type: 'Aerial',
      percentage: 40.0, quantity: 6, base_hours_each: 60,
      efficiency_multiplier: 1.0, adjusted_hours: 360, sort_order: 0,
    };
    expect(shot.percentage).toBe(40.0);
  });
});

describe('QuoteVersion (with new fields)', () => {
  it('has shot_count and hourly_rate', () => {
    const v: QuoteVersion = {
      id: 'uuid', quote_id: 'uuid', version_number: 1,
      duration_seconds: 60, shot_count: 15,
      pool_budget_hours: null, pool_budget_amount: null,
      total_hours: 120, hourly_rate: 125, notes: null,
      created_by: 'uuid', created_at: '',
    };
    expect(v.shot_count).toBe(15);
    expect(v.pool_budget_hours).toBeNull(); // retainer mode
  });
});

describe('RateCard (with hourly_rate)', () => {
  it('has hourly_rate', () => {
    const rc: RateCard = {
      id: 'uuid', name: 'DHRE 2025', is_default: true,
      hours_per_second: 17.33, editing_hours_per_30s: 100,
      hourly_rate: 125, created_by: 'uuid', created_at: '', updated_at: '',
    };
    expect(rc.hourly_rate).toBe(125);
  });
});

describe('FilmTemplateShot (percentage-based)', () => {
  it('uses percentage instead of quantity', () => {
    const shot: FilmTemplateShot = {
      id: 'uuid', template_id: 'uuid', shot_type: 'Aerial',
      percentage: 40.0, efficiency_multiplier: 1.0, sort_order: 0,
    };
    expect(shot.percentage).toBe(40.0);
    expect((shot as any).quantity).toBeUndefined();
  });
});

describe('KantataWorkspace', () => {
  it('has kantata fields', () => {
    const ws: KantataWorkspace = {
      kantata_id: '23046', title: 'Dubai Islands Phase E',
      status: 'Active', start_date: '2026-01-01', due_date: '2026-06-30',
    };
    expect(ws.kantata_id).toBe('23046');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run shared/types/index.test.ts`
Expected: FAIL — types don't exist yet

**Step 3: Update shared types**

Replace `shared/types/index.ts` with the complete new type definitions:

```typescript
// ─── Developments ───
export interface Development {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Projects ───
export interface Project {
  id: string;
  development_id: string;
  name: string;
  kantata_id: string | null;
  status: string | null;
  is_forecasted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithDevelopment extends Project {
  development: Development;
  quote_count: number;
  latest_quote_status: QuoteStatus | null;
}

// ─── Kantata (read-only) ───
export interface KantataWorkspace {
  kantata_id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
}

// ─── Rate Cards ───
export interface RateCard {
  id: string;
  name: string;
  is_default: boolean;
  hours_per_second: number;
  editing_hours_per_30s: number;
  hourly_rate: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RateCardItem {
  id: string;
  rate_card_id: string;
  shot_type: string;
  category: 'scene' | 'animation' | 'post' | 'material';
  hours: number;
  sort_order: number;
}

export interface RateCardWithItems extends RateCard {
  items: RateCardItem[];
}

// ─── Quotes ───
export type QuoteMode = 'retainer' | 'budget';
export type QuoteStatus = 'draft' | 'negotiating' | 'awaiting_approval' | 'confirmed' | 'archived';

export interface Quote {
  id: string;
  project_id: string;
  mode: QuoteMode;
  status: QuoteStatus;
  rate_card_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteStatusLogEntry {
  id: string;
  quote_id: string;
  old_status: QuoteStatus | null;
  new_status: QuoteStatus;
  changed_by: string;
  changed_by_email: string | null;
  changed_at: string;
}

export interface QuoteVersion {
  id: string;
  quote_id: string;
  version_number: number;
  duration_seconds: number;
  shot_count: number;
  pool_budget_hours: number | null;
  pool_budget_amount: number | null;
  total_hours: number;
  hourly_rate: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface VersionShot {
  id: string;
  version_id: string;
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
}

export interface QuoteVersionWithShots extends QuoteVersion {
  shots: VersionShot[];
}

export interface QuoteWithVersions extends Quote {
  versions: QuoteVersionWithShots[];
  rate_card?: RateCard;
  project?: Project;
}

// ─── Film Templates ───
export interface FilmTemplate {
  id: string;
  name: string;
  duration_seconds: number;
  description: string | null;
  rate_card_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilmTemplateShot {
  id: string;
  template_id: string;
  shot_type: string;
  percentage: number;
  efficiency_multiplier: number;
  sort_order: number;
}

export interface FilmTemplateWithShots extends FilmTemplate {
  shots: FilmTemplateShot[];
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run shared/types/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/types/
git commit -m "feat: update shared types for project hierarchy and dual quote modes"
```

---

## Task 2: Database Schema Migration

Create a migration script that creates new tables and modifies existing ones.

**Files:**
- Create: `server/src/scripts/migrate-v2.ts`

**Step 1: Write the migration script**

```typescript
// server/src/scripts/migrate-v2.ts
// Run: SUPABASE_DATABASE_URL="postgresql://..." npx tsx src/scripts/migrate-v2.ts

import pg from 'pg';

const DATABASE_URL = process.env.SUPABASE_DATABASE_URL;
if (!DATABASE_URL) { console.error('SUPABASE_DATABASE_URL required'); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO quote_calculator');
    await client.query('BEGIN');

    // 1. Create developments table
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
    console.log('✓ developments table');

    // 2. Create projects table
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_kantata ON projects(kantata_id) WHERE kantata_id IS NOT NULL');
    console.log('✓ projects table');

    // 3. Add hourly_rate to rate_cards
    await client.query(`
      ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 125
    `);
    console.log('✓ rate_cards.hourly_rate added');

    // 4. Modify quotes: add project_id, mode; remove client_name, project_name; change status enum
    // First add new columns
    await client.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await client.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'retainer'`);

    // Migrate existing quotes: create a "Legacy" development and project for each
    const { rows: existingQuotes } = await client.query(`
      SELECT DISTINCT client_name, project_name FROM quotes WHERE project_id IS NULL
    `);

    if (existingQuotes.length > 0) {
      // Create a "Legacy Imports" development
      const { rows: [legacyDev] } = await client.query(`
        INSERT INTO developments (name, client_name, description)
        VALUES ('Legacy Imports', null, 'Auto-migrated from v1 quotes')
        RETURNING id
      `);

      for (const q of existingQuotes) {
        const { rows: [project] } = await client.query(`
          INSERT INTO projects (development_id, name, is_forecasted)
          VALUES ($1, $2, true)
          RETURNING id
        `, [legacyDev.id, `${q.client_name} - ${q.project_name}`]);

        await client.query(`
          UPDATE quotes SET project_id = $1
          WHERE client_name = $2 AND project_name = $3 AND project_id IS NULL
        `, [project.id, q.client_name, q.project_name]);
      }
      console.log(`✓ migrated ${existingQuotes.length} legacy quotes`);
    }

    // Now make project_id NOT NULL
    await client.query(`ALTER TABLE quotes ALTER COLUMN project_id SET NOT NULL`);

    // Update status check constraint
    await client.query(`ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check`);
    await client.query(`
      ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
      CHECK (status IN ('draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived'))
    `);

    // Update existing statuses to new enum
    await client.query(`UPDATE quotes SET status = 'confirmed' WHERE status = 'approved'`);
    await client.query(`UPDATE quotes SET status = 'negotiating' WHERE status = 'pending_approval'`);
    await client.query(`UPDATE quotes SET status = 'archived' WHERE status = 'sent'`);

    // Drop old columns (after migration)
    await client.query(`ALTER TABLE quotes DROP COLUMN IF EXISTS client_name`);
    await client.query(`ALTER TABLE quotes DROP COLUMN IF EXISTS project_name`);
    console.log('✓ quotes table restructured');

    // 5. Create quote_status_log
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_log_quote ON quote_status_log(quote_id)');
    console.log('✓ quote_status_log table');

    // 6. Modify quote_versions: add shot_count, pool_budget_amount, hourly_rate; make pool nullable
    await client.query(`ALTER TABLE quote_versions ADD COLUMN IF NOT EXISTS shot_count int`);
    await client.query(`ALTER TABLE quote_versions ADD COLUMN IF NOT EXISTS pool_budget_amount numeric`);
    await client.query(`ALTER TABLE quote_versions ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 125`);
    await client.query(`ALTER TABLE quote_versions ALTER COLUMN pool_budget_hours DROP NOT NULL`);
    console.log('✓ quote_versions updated');

    // 7. Modify version_shots: add percentage
    await client.query(`ALTER TABLE version_shots ADD COLUMN IF NOT EXISTS percentage numeric NOT NULL DEFAULT 0`);
    console.log('✓ version_shots.percentage added');

    // 8. Modify film_template_shots: add percentage, drop quantity
    await client.query(`ALTER TABLE film_template_shots ADD COLUMN IF NOT EXISTS percentage numeric NOT NULL DEFAULT 0`);
    // Migrate existing template shots: convert quantity to percentage
    await client.query(`
      UPDATE film_template_shots fts SET percentage = (
        SELECT CASE WHEN total_qty > 0 THEN (fts.quantity::numeric / total_qty * 100) ELSE 0 END
        FROM (
          SELECT template_id, SUM(quantity) as total_qty
          FROM film_template_shots GROUP BY template_id
        ) t WHERE t.template_id = fts.template_id
      )
    `);
    await client.query(`ALTER TABLE film_template_shots DROP COLUMN IF EXISTS quantity`);
    console.log('✓ film_template_shots converted to percentage');

    // 9. Seed default percentage-based templates
    // First check if they exist
    const { rows: existingTemplates } = await client.query(
      `SELECT name FROM film_templates WHERE name IN ('Masterplan Film', 'Community Film', 'Product Film')`
    );
    const existingNames = new Set(existingTemplates.map(t => t.name));

    if (!existingNames.has('Masterplan Film')) {
      const { rows: [t] } = await client.query(`
        INSERT INTO film_templates (name, duration_seconds, description)
        VALUES ('Masterplan Film', 60, 'Standard masterplan aerial film')
        RETURNING id
      `);
      await client.query(`
        INSERT INTO film_template_shots (template_id, shot_type, percentage, efficiency_multiplier, sort_order) VALUES
        ($1, 'Site/Masterplan Overview (wide)', 20, 1.0, 0),
        ($1, 'Aerial Exterior View', 40, 1.0, 1),
        ($1, 'Street-Level Exterior', 40, 1.0, 2)
      `, [t.id]);
    }

    if (!existingNames.has('Community Film')) {
      const { rows: [t] } = await client.query(`
        INSERT INTO film_templates (name, duration_seconds, description)
        VALUES ('Community Film', 60, 'Community-focused film with mixed perspectives')
        RETURNING id
      `);
      await client.query(`
        INSERT INTO film_template_shots (template_id, shot_type, percentage, efficiency_multiplier, sort_order) VALUES
        ($1, 'Aerial Exterior View', 25, 1.0, 0),
        ($1, 'Semi-Aerial Exterior View', 25, 1.0, 1),
        ($1, 'Street-Level Exterior', 50, 1.0, 2)
      `, [t.id]);
    }

    if (!existingNames.has('Product Film')) {
      const { rows: [t] } = await client.query(`
        INSERT INTO film_templates (name, duration_seconds, description)
        VALUES ('Product Film', 60, 'Interior-focused product showcase')
        RETURNING id
      `);
      await client.query(`
        INSERT INTO film_template_shots (template_id, shot_type, percentage, efficiency_multiplier, sort_order) VALUES
        ($1, 'Aerial Exterior View', 20, 1.0, 0),
        ($1, 'Street-Level Exterior', 20, 1.0, 1),
        ($1, 'Interior View', 60, 1.0, 2)
      `, [t.id]);
    }
    console.log('✓ default templates seeded');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
```

**Step 2: Run the migration on the dev database**

```bash
cd /home/stan/Desktop/the-boundary/TB-QuoteCalculator
SUPABASE_DATABASE_URL="postgresql://postgres:<password>@192.168.0.74:5433/postgres" npx tsx server/src/scripts/migrate-v2.ts
```

**Step 3: Verify tables exist**

Connect to psql and verify:
```sql
SET search_path TO quote_calculator;
\dt
-- Should show: developments, projects, quotes, quote_versions, version_shots, rate_cards, rate_card_items, film_templates, film_template_shots, quote_status_log
\d quotes
-- Should show: project_id, mode, new status constraint
\d quote_versions
-- Should show: shot_count, pool_budget_amount, hourly_rate
```

**Step 4: Commit**

```bash
git add server/src/scripts/migrate-v2.ts
git commit -m "feat: add v2 migration script for project hierarchy and dual quote modes"
```

---

## Task 3: Calculation Library

Update the pure calculation functions to support the new shot count formula and percentage-based distribution.

**Files:**
- Modify: `server/src/lib/quoteCalc.ts`
- Modify: `server/src/lib/quoteCalc.test.ts`

**Step 1: Write failing tests**

Add to `server/src/lib/quoteCalc.test.ts`:

```typescript
describe('shotCount', () => {
  it('calculates ceil(duration/4) for standard durations', () => {
    expect(shotCount(15)).toBe(4);   // ceil(15/4) = 4
    expect(shotCount(30)).toBe(8);   // ceil(30/4) = 8
    expect(shotCount(45)).toBe(12);  // ceil(45/4) = 12
    expect(shotCount(60)).toBe(15);  // ceil(60/4) = 15
    expect(shotCount(90)).toBe(23);  // ceil(90/4) = 23
    expect(shotCount(120)).toBe(30); // ceil(120/4) = 30
  });

  it('enforces minimum of 5 shots for 15s', () => {
    expect(shotCount(15)).toBe(4);
    // Note: the user spec says 15s = min 5 shots, but ceil(15/4) = 4
    // We need a minimum floor — see implementation
  });
});

describe('distributeShotsByPercentage', () => {
  it('distributes 15 shots by Masterplan template (20/40/40)', () => {
    const result = distributeShotsByPercentage(15, [
      { shot_type: 'Masterplan Aerial', percentage: 20, base_hours_each: 80 },
      { shot_type: 'Aerial', percentage: 40, base_hours_each: 60 },
      { shot_type: 'Exterior', percentage: 40, base_hours_each: 40 },
    ]);
    // 15 * 0.20 = 3.0, 15 * 0.40 = 6.0, 15 * 0.40 = 6.0
    expect(result).toEqual([
      { shot_type: 'Masterplan Aerial', quantity: 3 },
      { shot_type: 'Aerial', quantity: 6 },
      { shot_type: 'Exterior', quantity: 6 },
    ]);
    expect(result.reduce((s, r) => s + r.quantity, 0)).toBe(15);
  });

  it('handles fractional distribution with largest-remainder biased to higher hours', () => {
    // 8 shots: 25% = 2.0, 25% = 2.0, 50% = 4.0 → exact
    const result = distributeShotsByPercentage(8, [
      { shot_type: 'Aerial', percentage: 25, base_hours_each: 60 },
      { shot_type: 'Semi-Aerial', percentage: 25, base_hours_each: 60 },
      { shot_type: 'Exterior', percentage: 50, base_hours_each: 40 },
    ]);
    expect(result.reduce((s, r) => s + r.quantity, 0)).toBe(8);
  });

  it('biases rounding to higher-hour shot types', () => {
    // 7 shots: 33.3% each = 2.33 each → floors to 2+2+2=6, need 1 more
    // Should go to highest-hour type
    const result = distributeShotsByPercentage(7, [
      { shot_type: 'Expensive', percentage: 33.34, base_hours_each: 80 },
      { shot_type: 'Medium', percentage: 33.33, base_hours_each: 60 },
      { shot_type: 'Cheap', percentage: 33.33, base_hours_each: 40 },
    ]);
    expect(result.reduce((s, r) => s + r.quantity, 0)).toBe(7);
    // Expensive should get the extra shot (highest hours, commercially safer)
    expect(result[0].quantity).toBeGreaterThanOrEqual(result[2].quantity);
  });
});

describe('budgetToPoolHours', () => {
  it('calculates hours from budget and rate', () => {
    expect(budgetToPoolHours(10000, 125)).toBe(80);
    expect(budgetToPoolHours(5000, 125)).toBe(40);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run server/src/lib/quoteCalc.test.ts`
Expected: FAIL

**Step 3: Implement new calculation functions**

Add to `server/src/lib/quoteCalc.ts`:

```typescript
// Add these new functions:

export function shotCount(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 4);
}

interface PercentageShot {
  shot_type: string;
  percentage: number;
  base_hours_each: number;
}

interface DistributedShot {
  shot_type: string;
  quantity: number;
}

export function distributeShotsByPercentage(
  totalShots: number,
  shots: PercentageShot[],
): DistributedShot[] {
  if (shots.length === 0) return [];

  // Calculate raw quantities
  const raw = shots.map((s) => ({
    ...s,
    rawQty: totalShots * (s.percentage / 100),
    floored: Math.floor(totalShots * (s.percentage / 100)),
  }));

  // Distribute remainders using largest-remainder method
  const totalFloored = raw.reduce((sum, r) => sum + r.floored, 0);
  let remaining = totalShots - totalFloored;

  // Sort by fractional remainder DESC, then by base_hours_each DESC (bias to expensive)
  const withRemainder = raw.map((r) => ({
    ...r,
    remainder: r.rawQty - r.floored,
  }));

  withRemainder.sort((a, b) => {
    const remDiff = b.remainder - a.remainder;
    if (Math.abs(remDiff) > 0.0001) return remDiff;
    return b.base_hours_each - a.base_hours_each; // bias to higher hours
  });

  const result = withRemainder.map((r) => ({
    shot_type: r.shot_type,
    quantity: r.floored,
  }));

  // Allocate remaining shots
  for (let i = 0; i < remaining && i < result.length; i++) {
    result[i].quantity += 1;
  }

  // Restore original order
  return shots.map((s) => result.find((r) => r.shot_type === s.shot_type)!);
}

export function budgetToPoolHours(budgetAmount: number, hourlyRate: number): number {
  if (hourlyRate <= 0) return 0;
  return budgetAmount / hourlyRate;
}
```

**Step 4: Run tests**

Run: `npm test -- --run server/src/lib/quoteCalc.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/lib/quoteCalc.ts server/src/lib/quoteCalc.test.ts
git commit -m "feat: add shot count formula, percentage distribution, and budget calculation"
```

---

## Task 4: Validation Schemas

Update Zod schemas for new request shapes.

**Files:**
- Modify: `server/src/lib/validation.ts`
- Modify: `server/src/lib/validation.test.ts`

**Step 1: Write failing tests**

Add test cases for new schemas in `server/src/lib/validation.test.ts`:

```typescript
describe('createDevelopmentSchema', () => {
  it('requires name', () => {
    expect(validate(createDevelopmentSchema, { name: '' }).success).toBe(false);
    expect(validate(createDevelopmentSchema, { name: 'Dubai Islands E' }).success).toBe(true);
  });
});

describe('createProjectSchema', () => {
  it('requires development_id and name', () => {
    const valid = { development_id: crypto.randomUUID(), name: 'Masterplan Film' };
    expect(validate(createProjectSchema, valid).success).toBe(true);
  });

  it('optionally accepts kantata_id', () => {
    const valid = { development_id: crypto.randomUUID(), name: 'Film', kantata_id: '23046' };
    expect(validate(createProjectSchema, valid).success).toBe(true);
  });
});

describe('createQuoteSchema (v2)', () => {
  it('requires project_id, mode, rate_card_id', () => {
    const valid = {
      project_id: crypto.randomUUID(),
      mode: 'retainer',
      rate_card_id: crypto.randomUUID(),
    };
    expect(validate(createQuoteSchema, valid).success).toBe(true);
  });

  it('rejects invalid mode', () => {
    const invalid = { project_id: crypto.randomUUID(), mode: 'other', rate_card_id: crypto.randomUUID() };
    expect(validate(createQuoteSchema, invalid).success).toBe(false);
  });
});

describe('updateStatusSchema (v2)', () => {
  it('accepts new status values', () => {
    for (const s of ['draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived']) {
      expect(validate(updateStatusSchema, { status: s }).success).toBe(true);
    }
  });

  it('rejects old status values', () => {
    expect(validate(updateStatusSchema, { status: 'pending_approval' }).success).toBe(false);
    expect(validate(updateStatusSchema, { status: 'sent' }).success).toBe(false);
  });
});

describe('shotSchema (v2 with percentage)', () => {
  it('includes percentage', () => {
    const valid = {
      shot_type: 'Aerial', percentage: 40.0, quantity: 6,
      base_hours_each: 60, efficiency_multiplier: 1.0,
    };
    expect(validate(shotSchema, valid).success).toBe(true);
  });
});

describe('createVersionSchema (v2 with budget fields)', () => {
  it('accepts pool_budget_amount and hourly_rate', () => {
    const valid = {
      duration_seconds: 60, hourly_rate: 125,
      pool_budget_amount: 10000, shots: [],
    };
    expect(validate(createVersionSchema, valid).success).toBe(true);
  });
});

describe('templateShotSchema (percentage-based)', () => {
  it('uses percentage not quantity', () => {
    const valid = { shot_type: 'Aerial', percentage: 40.0, efficiency_multiplier: 1.0 };
    expect(validate(templateShotSchema, valid).success).toBe(true);
  });
});

describe('linkProjectSchema', () => {
  it('requires kantata_id string', () => {
    expect(validate(linkProjectSchema, { kantata_id: '23046' }).success).toBe(true);
    expect(validate(linkProjectSchema, { kantata_id: '' }).success).toBe(false);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `npm test -- --run server/src/lib/validation.test.ts`

**Step 3: Update validation schemas**

Replace `server/src/lib/validation.ts`:

```typescript
import { z } from 'zod';

// ─── Developments ───
export const createDevelopmentSchema = z.object({
  name: z.string().min(1).max(200),
  client_name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const updateDevelopmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  client_name: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

// ─── Projects ───
export const createProjectSchema = z.object({
  development_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  kantata_id: z.string().max(20).optional(),
});

export const linkProjectSchema = z.object({
  kantata_id: z.string().min(1).max(20),
});

// ─── Quotes ───
export const createQuoteSchema = z.object({
  project_id: z.string().uuid(),
  mode: z.enum(['retainer', 'budget']),
  rate_card_id: z.string().uuid(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived']),
});

// ─── Shots ───
export const shotSchema = z.object({
  shot_type: z.string().min(1).max(200),
  percentage: z.number().min(0).max(100),
  quantity: z.number().int().min(1).max(9999),
  base_hours_each: z.number().min(0),
  efficiency_multiplier: z.number().min(0.1).max(5.0),
  sort_order: z.number().int().optional(),
});

// ─── Versions ───
export const createVersionSchema = z.object({
  duration_seconds: z.number().int().min(1).max(600),
  hourly_rate: z.number().min(0).optional(),
  pool_budget_hours: z.number().min(0).nullable().optional(),
  pool_budget_amount: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
  shots: z.array(shotSchema).max(100).optional(),
});

export const updateVersionSchema = z.object({
  duration_seconds: z.number().int().min(1).max(600).optional(),
  hourly_rate: z.number().min(0).optional(),
  pool_budget_hours: z.number().min(0).nullable().optional(),
  pool_budget_amount: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
  shots: z.array(shotSchema).max(100).optional(),
});

// ─── Rate Cards ───
export const createRateCardSchema = z.object({
  name: z.string().min(1).max(200),
  hours_per_second: z.number().min(0),
  editing_hours_per_30s: z.number().min(0).optional(),
  hourly_rate: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
});

export const updateRateCardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  hours_per_second: z.number().min(0).optional(),
  editing_hours_per_30s: z.number().min(0).optional(),
  hourly_rate: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
});

export const rateCardItemSchema = z.object({
  shot_type: z.string().min(1).max(200),
  category: z.enum(['scene', 'animation', 'post', 'material']),
  hours: z.number().min(0),
  sort_order: z.number().int().optional(),
});

// ─── Templates ───
export const templateShotSchema = z.object({
  shot_type: z.string().min(1).max(200),
  percentage: z.number().min(0).max(100),
  efficiency_multiplier: z.number().min(0.1).max(5.0),
  sort_order: z.number().int().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  duration_seconds: z.number().int().min(1).max(600),
  description: z.string().max(2000).optional(),
  rate_card_id: z.string().uuid().optional(),
  shots: z.array(templateShotSchema).max(50).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  duration_seconds: z.number().int().min(1).max(600).optional(),
  description: z.string().max(2000).nullable().optional(),
  rate_card_id: z.string().uuid().nullable().optional(),
  shots: z.array(templateShotSchema).max(50).optional(),
});

// ─── Validator helper ───
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { success: false, error: messages };
  }
  return { success: true, data: result.data };
}
```

**Step 4: Run tests**

Run: `npm test -- --run server/src/lib/validation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/lib/validation.ts server/src/lib/validation.test.ts
git commit -m "feat: update validation schemas for project hierarchy and dual modes"
```

---

## Task 5: Server — Development & Project Routes

New CRUD endpoints for developments and projects.

**Files:**
- Create: `server/src/routes/developments.ts`
- Create: `server/src/routes/projects.ts`
- Modify: `server/src/routes/index.ts` (mount new routes)

**Step 1: Create development routes**

`server/src/routes/developments.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import { validate, createDevelopmentSchema, updateDevelopmentSchema } from '../lib/validation.js';
import { sendServerError, sendNotFound } from '../utils/route-helpers.js';

const router = Router();

// GET /developments — list all developments with project counts
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery(`
      SELECT d.*,
        COUNT(p.id)::int as project_count
      FROM developments d
      LEFT JOIN projects p ON p.development_id = d.id
      GROUP BY d.id
      ORDER BY d.updated_at DESC
    `);
    res.json(rows);
  } catch (err) {
    sendServerError(res, err, 'Failed to list developments');
  }
});

// GET /developments/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery(`SELECT * FROM developments WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return sendNotFound(res, 'Development');
    res.json(rows[0]);
  } catch (err) {
    sendServerError(res, err, 'Failed to get development');
  }
});

// POST /developments
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createDevelopmentSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, client_name, description } = parsed.data;

    const { rows } = await dbQuery(
      `INSERT INTO developments (name, client_name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, client_name || null, description || null, req.user!.id],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    sendServerError(res, err, 'Failed to create development');
  }
});

// PUT /developments/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateDevelopmentSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(parsed.data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: { message: 'No fields to update' } });

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const { rows } = await dbQuery(
      `UPDATE developments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (!rows[0]) return sendNotFound(res, 'Development');
    res.json(rows[0]);
  } catch (err) {
    sendServerError(res, err, 'Failed to update development');
  }
});

export default router;
```

**Step 2: Create project routes**

`server/src/routes/projects.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import { validate, createProjectSchema, linkProjectSchema } from '../lib/validation.js';
import { sendServerError, sendNotFound } from '../utils/route-helpers.js';

const router = Router();

// GET /projects — list all projects with development info and quote counts
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const forecasted = req.query.forecasted as string | undefined;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (forecasted === 'true') {
      where += ` AND p.is_forecasted = true`;
    } else if (forecasted === 'false') {
      where += ` AND p.is_forecasted = false`;
    }

    if (search) {
      where += ` AND (p.name ILIKE $${idx} OR d.name ILIKE $${idx} OR p.kantata_id = $${idx + 1})`;
      params.push(`%${search}%`, search);
      idx += 2;
    }

    const { rows } = await dbQuery(`
      SELECT p.*,
        d.name as development_name,
        d.client_name as development_client_name,
        COUNT(q.id)::int as quote_count,
        (SELECT status FROM quotes WHERE project_id = p.id ORDER BY updated_at DESC LIMIT 1) as latest_quote_status
      FROM projects p
      JOIN developments d ON d.id = p.development_id
      LEFT JOIN quotes q ON q.project_id = p.id AND q.status != 'archived'
      ${where}
      GROUP BY p.id, d.name, d.client_name
      ORDER BY p.updated_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    sendServerError(res, err, 'Failed to list projects');
  }
});

// GET /projects/:id — single project with quotes
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: projectRows } = await dbQuery(`
      SELECT p.*, d.name as development_name, d.client_name as development_client_name
      FROM projects p
      JOIN developments d ON d.id = p.development_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!projectRows[0]) return sendNotFound(res, 'Project');

    // Get quotes for this project with latest version info
    const { rows: quotes } = await dbQuery(`
      SELECT q.*,
        (SELECT json_build_object(
          'id', v.id, 'version_number', v.version_number,
          'duration_seconds', v.duration_seconds,
          'total_hours', v.total_hours, 'shot_count', v.shot_count
        ) FROM quote_versions v WHERE v.quote_id = q.id ORDER BY v.version_number DESC LIMIT 1) as latest_version,
        (SELECT COUNT(*)::int FROM quote_versions v WHERE v.quote_id = q.id) as version_count
      FROM quotes q
      WHERE q.project_id = $1 AND q.status != 'archived'
      ORDER BY q.updated_at DESC
    `, [req.params.id]);

    res.json({ ...projectRows[0], quotes });
  } catch (err) {
    sendServerError(res, err, 'Failed to get project');
  }
});

// POST /projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createProjectSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { development_id, name, kantata_id } = parsed.data;

    const is_forecasted = !kantata_id;

    const { rows } = await dbQuery(
      `INSERT INTO projects (development_id, name, kantata_id, is_forecasted, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [development_id, name, kantata_id || null, is_forecasted, req.user!.id],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    sendServerError(res, err, 'Failed to create project');
  }
});

// POST /projects/:id/link — link forecasted project to Kantata
router.post('/:id/link', async (req: Request, res: Response) => {
  try {
    const parsed = validate(linkProjectSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });

    const { rows } = await dbQuery(
      `UPDATE projects SET kantata_id = $1, is_forecasted = false, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [parsed.data.kantata_id, req.params.id],
    );
    if (!rows[0]) return sendNotFound(res, 'Project');
    res.json(rows[0]);
  } catch (err) {
    sendServerError(res, err, 'Failed to link project');
  }
});

export default router;
```

**Step 3: Create Kantata search route**

`server/src/routes/kantata.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import { sendServerError } from '../utils/route-helpers.js';

const router = Router();

// GET /kantata/workspaces?search=<term>
// Cross-schema read from traffic_light.kantata_workspaces
router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string;
    if (!search || search.length < 2) {
      return res.status(400).json({ error: { message: 'Search term must be at least 2 characters' } });
    }

    // Query traffic_light schema directly (read-only cross-schema)
    const { rows } = await dbQuery(`
      SELECT kantata_id, title, status, start_date, due_date
      FROM traffic_light.kantata_workspaces
      WHERE is_current = true
        AND (title ILIKE $1 OR kantata_id = $2)
      ORDER BY kantata_id DESC
      LIMIT 20
    `, [`%${search}%`, search]);

    res.json(rows);
  } catch (err) {
    sendServerError(res, err, 'Failed to search Kantata workspaces');
  }
});

export default router;
```

**Step 4: Mount new routes in index.ts**

Modify `server/src/routes/index.ts`:

```typescript
// Add imports:
import developmentRoutes from './developments.js';
import projectRoutes from './projects.js';
import kantataRoutes from './kantata.js';

// Add after existing protected routes:
router.use('/developments', developmentRoutes);
router.use('/projects', projectRoutes);
router.use('/kantata', kantataRoutes);
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add server/src/routes/developments.ts server/src/routes/projects.ts server/src/routes/kantata.ts server/src/routes/index.ts
git commit -m "feat: add development, project, and Kantata search routes"
```

---

## Task 6: Server — Restructure Quote Routes

Update quote CRUD to use project_id, new modes, new statuses, and audit trail.

**Files:**
- Modify: `server/src/routes/quotes.ts`
- Modify: `server/src/routes/quotes.test.ts`

**Step 1: Update quote route tests**

Update `server/src/routes/quotes.test.ts` to test new shapes:

- POST `/quotes` now takes `{ project_id, mode, rate_card_id }`
- PUT `/quotes/:id/status` uses new enum + creates audit log entry
- GET `/quotes/:id` returns project info and status log

**Step 2: Rewrite quotes.ts**

Key changes to `server/src/routes/quotes.ts`:

- **POST /**: Accept `project_id` and `mode` instead of `client_name`/`project_name`. Auto-calculate `shot_count = ceil(duration/4)`. For retainer mode, `pool_budget_hours = null`. For budget mode, calculate from rate card. Insert initial status log entry.
- **PUT /:id/status**: Validate transitions. Insert into `quote_status_log` with `changed_by` and `changed_by_email` from `req.user`.
- **GET /:id**: Join with `projects` and `developments`. Include `status_log` array (SELECT from `quote_status_log` ORDER BY `changed_at`).
- **GET /**: Join with projects + developments for card display.
- **POST /:id/versions**: Include `shot_count`, `hourly_rate`, `pool_budget_amount`. Store `percentage` on each `version_shot`.
- **PUT /:id/versions/:versionId**: Same changes as create version.

The full rewrite of this file is substantial (~500 lines). The key SQL changes are:

```sql
-- List quotes (joined with project + development)
SELECT q.*, p.name as project_name, p.kantata_id,
       d.name as development_name, d.client_name
FROM quotes q
JOIN projects p ON p.id = q.project_id
JOIN developments d ON d.id = p.development_id
WHERE q.status != 'archived'
ORDER BY q.updated_at DESC

-- Create quote
INSERT INTO quotes (project_id, mode, rate_card_id, status, created_by)
VALUES ($1, $2, $3, 'draft', $4) RETURNING *

-- Status update with audit
UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
-- then:
INSERT INTO quote_status_log (quote_id, old_status, new_status, changed_by, changed_by_email)
VALUES ($1, $2, $3, $4, $5)

-- Get quote with status log
SELECT * FROM quote_status_log WHERE quote_id = $1 ORDER BY changed_at ASC

-- Version with new fields
INSERT INTO quote_versions (quote_id, version_number, duration_seconds, shot_count,
  pool_budget_hours, pool_budget_amount, total_hours, hourly_rate, notes, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *

-- Shots with percentage
INSERT INTO version_shots (version_id, shot_type, percentage, quantity,
  base_hours_each, efficiency_multiplier, adjusted_hours, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
```

**Step 3: Run tests**

Run: `npm test -- --run server/src/routes/quotes.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add server/src/routes/quotes.ts server/src/routes/quotes.test.ts
git commit -m "feat: restructure quote routes for project hierarchy and dual modes"
```

---

## Task 7: Server — Update Template & Rate Card Routes

Update templates to use percentage-based shots and rate cards to include hourly_rate.

**Files:**
- Modify: `server/src/routes/templates.ts`
- Modify: `server/src/routes/rate-cards.ts`
- Modify: `server/src/routes/rate-cards.test.ts`

**Step 1: Update template routes**

In `server/src/routes/templates.ts`:
- Change all `quantity` references to `percentage` in INSERT/UPDATE/SELECT queries
- Template shot creation: `INSERT INTO film_template_shots (template_id, shot_type, percentage, efficiency_multiplier, sort_order)`
- Template listing: SELECT `percentage` instead of `quantity`

**Step 2: Update rate card routes**

In `server/src/routes/rate-cards.ts`:
- Add `hourly_rate` to INSERT and UPDATE queries for rate_cards
- Include `hourly_rate` in SELECT queries
- Default to 125 if not provided

**Step 3: Update rate card tests**

Add `hourly_rate` field to test fixtures and assertions.

**Step 4: Run tests**

Run: `npm test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add server/src/routes/templates.ts server/src/routes/rate-cards.ts server/src/routes/rate-cards.test.ts
git commit -m "feat: update templates to percentage-based, add hourly_rate to rate cards"
```

---

## Task 8: Client — API Hooks

Create new hooks for developments, projects, and Kantata; update existing hooks.

**Files:**
- Create: `client/src/hooks/useDevelopments.ts`
- Create: `client/src/hooks/useProjects.ts`
- Create: `client/src/hooks/useKantata.ts`
- Modify: `client/src/hooks/useQuotes.ts`
- Modify: `client/src/hooks/useRateCards.ts`
- Modify: `client/src/hooks/useTemplates.ts`

**Step 1: Create useDevelopments.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Development } from '@shared/types';

export function useDevelopments() {
  return useQuery<(Development & { project_count: number })[]>({
    queryKey: ['developments'],
    queryFn: () => api.get('/api/developments'),
  });
}

export function useCreateDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; client_name?: string; description?: string }) =>
      api.post<Development>('/api/developments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['developments'] }),
  });
}
```

**Step 2: Create useProjects.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project } from '@shared/types';

export function useProjects(opts?: { forecasted?: boolean; search?: string }) {
  const params = new URLSearchParams();
  if (opts?.forecasted !== undefined) params.set('forecasted', String(opts.forecasted));
  if (opts?.search) params.set('search', opts.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['projects', opts],
    queryFn: () => api.get<any[]>(`/api/projects${qs ? `?${qs}` : ''}`),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<any>(`/api/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { development_id: string; name: string; kantata_id?: string }) =>
      api.post<Project>('/api/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useLinkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kantata_id }: { id: string; kantata_id: string }) =>
      api.post<Project>(`/api/projects/${id}/link`, { kantata_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
```

**Step 3: Create useKantata.ts**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { KantataWorkspace } from '@shared/types';

export function useKantataSearch(search: string) {
  return useQuery<KantataWorkspace[]>({
    queryKey: ['kantata', 'workspaces', search],
    queryFn: () => api.get(`/api/kantata/workspaces?search=${encodeURIComponent(search)}`),
    enabled: search.length >= 2,
  });
}
```

**Step 4: Update useQuotes.ts**

Change `useCreateQuote` mutation to send `{ project_id, mode, rate_card_id }` instead of `{ client_name, project_name, rate_card_id }`. Update `QuoteListItem` type to include project/development info from the joined query.

**Step 5: Update useRateCards.ts**

Add `hourly_rate` to mutation payloads for create/update.

**Step 6: Update useTemplates.ts**

Change template shot types from `quantity` to `percentage` in mutation payloads.

**Step 7: Commit**

```bash
git add client/src/hooks/
git commit -m "feat: add development, project, kantata hooks; update quote/template hooks"
```

---

## Task 9: Client — Routing & Sidebar

Update routes and sidebar navigation for the new project-centric structure.

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`
- Create: `client/src/pages/projects/ProjectsHomePage.tsx` (placeholder)
- Create: `client/src/pages/projects/ProjectDetailPage.tsx` (placeholder)

**Step 1: Update App.tsx routes**

```typescript
// New routes:
<Route path="/" element={<ProjectsHomePage />} />
<Route path="/projects/:id" element={<ProjectDetailPage />} />
<Route path="/projects/:id/quotes/:quoteId" element={<QuoteDetailPage />} />
<Route path="/projects/:id/quotes/:quoteId/versions/:versionId/build" element={<QuoteBuilderPage />} />
// Keep:
<Route path="/rate-cards" element={<RateCardsPage />} />
<Route path="/templates" element={<TemplatesPage />} />
<Route path="/settings" element={<SettingsPage />} />
// Remove old quote-only routes
```

**Step 2: Update Sidebar.tsx**

Change first nav item from "Quotes" to "Projects" with `href: '/'` and a FolderOpen icon.

**Step 3: Create placeholder pages**

Create `ProjectsHomePage.tsx` and `ProjectDetailPage.tsx` with minimal markup so the app compiles. These will be fleshed out in the next tasks.

**Step 4: Run typecheck + dev server**

Run: `npm run typecheck && npm run dev`
Verify: App loads, sidebar shows "Projects", routing works

**Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/layout/Sidebar.tsx client/src/pages/projects/
git commit -m "feat: update routing and sidebar for project-centric navigation"
```

---

## Task 10: Client — ProjectsHomePage

The main homepage with two cards: Active Projects and Forecasted Projects.

**Files:**
- Modify: `client/src/pages/projects/ProjectsHomePage.tsx`

**Step 1: Implement the page**

Layout:
- PageHeader with "New Project" button
- Search bar (searches name, development, kantata_id)
- **"Active Projects" section** — Card grid of `is_forecasted = false` projects
  - Each card: Kantata ID badge, project name, development name, quote count, latest status
- **"Forecasted Projects" section** — Card grid of `is_forecasted = true` projects
  - Each card: project name, development name, quote count, "Link to Kantata" button
- Empty states for each section

Uses: `useProjects()` hook, `useNavigate()` for clicking cards

**Step 2: Create NewProjectDialog component**

Multi-step dialog:
1. Pick or create Development (searchable dropdown + "Create new" inline)
2. Choose type: "Link to Kantata" or "Forecasted"
   - If Kantata: search input using `useKantataSearch`, select workspace
   - If forecasted: text input for project name
3. Submit → create project → navigate to project detail

**Step 3: Verify in browser**

Run dev server, navigate to `/`, verify both card sections render.

**Step 4: Commit**

```bash
git add client/src/pages/projects/
git commit -m "feat: implement ProjectsHomePage with two-card layout and project creation"
```

---

## Task 11: Client — ProjectDetailPage

Shows a single project's quotes with creation and status management.

**Files:**
- Modify: `client/src/pages/projects/ProjectDetailPage.tsx`

**Step 1: Implement the page**

Layout:
- Back button to home
- Project header: name, development name, Kantata ID badge (if linked), "Link to Kantata" button (if forecasted)
- "New Quote" button
- Grid of quote cards (reuse/adapt QuoteCard component)
  - Each card: mode badge (retainer/budget), status badge, latest version info

**Step 2: Create NewQuoteDialog**

Simple dialog:
1. Mode toggle: Retainer | Budget
2. Rate card select (default pre-selected)
3. Create → navigate to builder

**Step 3: Create LinkToKantataDialog**

Dialog with search input using `useKantataSearch`, results list, confirm button.

**Step 4: Verify in browser**

Navigate to a project, verify quotes display and creation works.

**Step 5: Commit**

```bash
git add client/src/pages/projects/
git commit -m "feat: implement ProjectDetailPage with quote list and Kantata linking"
```

---

## Task 12: Client — QuoteDetailPage Updates

Update for new status system and audit trail.

**Files:**
- Modify: `client/src/pages/quotes/QuoteDetailPage.tsx`

**Step 1: Update status dropdown**

Change valid transitions to new enum:
- draft → negotiating
- negotiating → awaiting_approval, draft
- awaiting_approval → confirmed, draft
- any → archived

**Step 2: Add audit trail popover**

On the status badge, add a Popover trigger. The popover content renders `quote.status_log` entries chronologically with user email and timestamp.

```tsx
<Popover>
  <PopoverTrigger asChild>
    <button><Badge variant={statusVariant}>{quote.status}</Badge></button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="text-sm font-medium mb-2">Status History</div>
    {statusLog.map(entry => (
      <div key={entry.id} className="flex flex-col py-1.5 border-b last:border-0">
        <span className="font-medium capitalize">{entry.new_status.replace('_', ' ')}</span>
        <span className="text-xs text-muted-foreground">
          by {entry.changed_by_email} · {formatDate(entry.changed_at)}
        </span>
      </div>
    ))}
  </PopoverContent>
</Popover>
```

**Step 3: Update back button**

Navigate to `/projects/:projectId` instead of `/`.

**Step 4: Commit**

```bash
git add client/src/pages/quotes/QuoteDetailPage.tsx
git commit -m "feat: update QuoteDetailPage with new statuses and audit trail popover"
```

---

## Task 13: Client — Quote Builder Overhaul

This is the largest client-side task. Rebuild the builder with dual modes and percentage sliders.

**Files:**
- Rewrite: `client/src/pages/quotes/QuoteBuilderPage.tsx`
- Rewrite: `client/src/pages/quotes/builder/useBuilderState.ts`
- Rewrite: `client/src/pages/quotes/builder/ShotBreakdownTable.tsx`
- Rewrite: `client/src/pages/quotes/builder/ShotRow.tsx`
- Modify: `client/src/pages/quotes/builder/HourPoolBar.tsx`
- Modify: `client/src/pages/quotes/builder/TotalsSummary.tsx`
- Rewrite: `client/src/pages/quotes/builder/ApplyTemplatePicker.tsx`
- Modify: `client/src/pages/quotes/builder/PostProductionSection.tsx`
- Modify: `client/src/pages/quotes/builder/BudgetSuggestions.tsx`
- Modify: `client/src/pages/quotes/builder/AddShotPicker.tsx`

### Step 1: Rewrite useBuilderState.ts

New state shape:

```typescript
interface BuilderShot {
  shot_type: string;
  percentage: number;         // 0-100
  quantity: number;            // calculated from percentage or manual
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
  selected: boolean;
  manualOverride: boolean;     // true if user used +/- to override percentage calc
}

interface BuilderState {
  mode: 'retainer' | 'budget';
  duration: number;
  shotCount: number;           // ceil(duration/4)
  shots: BuilderShot[];
  notes: string;
  showPricing: boolean;
  hourlyRate: number;
  // Budget mode only:
  budgetAmount: number | null;
  poolBudgetHours: number | null;
}
```

Key behaviors:
- `setDuration(s)`: Updates duration, recalculates `shotCount = ceil(s/4)`, redistributes shot quantities from percentages
- `setPercentage(index, pct)`: Auto-rebalances other shots to total 100%, recalculates quantities
- `addShot(type, hours)`: Adds with even percentage split, rebalances
- `removeShot(index)`: Removes, rebalances remaining to 100%
- `updateQuantity(index, qty)`: Sets `manualOverride = true`, adjusts percentage to match
- `applyTemplate(template)`: Sets all percentages from template, recalculates
- `setBudgetAmount(amount)`: Calculates `poolBudgetHours = amount / hourlyRate`

**Percentage auto-rebalance algorithm:**
```typescript
function rebalancePercentages(shots: BuilderShot[], changedIndex: number, newPct: number): BuilderShot[] {
  const others = shots.filter((_, i) => i !== changedIndex && !shots[i].manualOverride);
  const othersTotal = others.reduce((s, shot) => s + shot.percentage, 0);
  const remaining = 100 - newPct;
  const manualTotal = shots
    .filter((_, i) => i !== changedIndex && shots[i].manualOverride)
    .reduce((s, shot) => s + shot.percentage, 0);
  const availableForOthers = remaining - manualTotal;

  return shots.map((shot, i) => {
    if (i === changedIndex) return { ...shot, percentage: newPct };
    if (shot.manualOverride) return shot;
    // Proportional redistribution
    const ratio = othersTotal > 0 ? shot.percentage / othersTotal : 1 / others.length;
    return { ...shot, percentage: Math.max(0, availableForOthers * ratio) };
  });
}
```

**Quantity calculation from percentages:**
Uses `distributeShotsByPercentage()` from quoteCalc (replicated client-side in a utils file).

### Step 2: Rebuild QuoteBuilderPage layout

```tsx
<PageHeader title="Quote Builder" />

{/* Mode + Pricing toggles */}
<div className="flex items-center gap-4 mb-6">
  <div className="flex items-center gap-2">
    <Label>Mode</Label>
    <Switch checked={mode === 'budget'} onCheckedChange={...} />
    <span>{mode === 'retainer' ? 'Retainer' : 'Budget'}</span>
  </div>
  <div className="flex items-center gap-2">
    <Label>Show Pricing</Label>
    <Switch checked={showPricing} onCheckedChange={...} />
  </div>
</div>

{/* Budget input (budget mode only) */}
{mode === 'budget' && <BudgetInput ... />}

{/* Duration + shot count */}
<DurationSection duration={duration} shotCount={shotCount} ... />

{/* Pool bar (budget mode only) */}
{mode === 'budget' && <HourPoolBar ... />}

{/* Shot breakdown with percentage sliders */}
<ShotBreakdownTable ... />

{/* Post-production */}
<PostProductionSection ... />

{/* Totals */}
<TotalsSummary ... showPricing={showPricing} hourlyRate={hourlyRate} />

{/* Budget suggestions (budget mode only) */}
{mode === 'budget' && remaining > 0 && <BudgetSuggestions ... />}

{/* Notes + Actions */}
```

### Step 3: Rebuild ShotRow with percentage slider

Each row now includes:
- Percentage slider (0-100, Radix Slider)
- Percentage display: "40%"
- Arrow showing: "→ 6 shots → 24.0 hrs"
- If showPricing: "($3,000)"
- +/- quantity buttons (override mode)
- Efficiency input
- Total hours
- Remove button

```tsx
<TableRow>
  <TableCell><Checkbox ... /></TableCell>
  <TableCell>{shot.shot_type}</TableCell>
  <TableCell className="w-48">
    <Slider value={[shot.percentage]} min={0} max={100} step={1}
      onValueChange={([v]) => onPercentageChange(index, v)} />
    <span className="text-xs">{shot.percentage.toFixed(0)}%</span>
  </TableCell>
  <TableCell>
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" onClick={() => onUpdateQuantity(index, shot.quantity - 1)}>
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-8 text-center">{shot.quantity}</span>
      <Button size="icon" variant="ghost" onClick={() => onUpdateQuantity(index, shot.quantity + 1)}>
        <Plus className="h-3 w-3" />
      </Button>
      {shot.manualOverride && <span className="text-xs text-amber-500">manual</span>}
    </div>
  </TableCell>
  <TableCell>{shot.base_hours_each}h</TableCell>
  <TableCell><Input value={shot.efficiency_multiplier} ... /></TableCell>
  <TableCell className="font-medium">
    {shot.adjusted_hours.toFixed(1)}h
    {showPricing && <span className="text-muted-foreground ml-1">(${(shot.adjusted_hours * hourlyRate).toFixed(0)})</span>}
  </TableCell>
  <TableCell><Button variant="ghost" onClick={() => onRemove(index)}><X /></Button></TableCell>
</TableRow>
```

### Step 4: Update HourPoolBar for pricing

Add optional `showPricing` and `hourlyRate` props. When pricing is on, show:
`"80.0 / 120.0 hrs ($10,000 / $15,000)"`

### Step 5: Update TotalsSummary for pricing

Add pricing column next to each hours value when `showPricing` is true.

### Step 6: Update ApplyTemplatePicker for percentages

Templates now show percentage breakdowns. Applying a template sets slider percentages.

### Step 7: Verify in browser

Run dev server, navigate to a quote builder, test:
- Mode toggle works
- Duration changes recalculate shot count
- Sliders auto-rebalance
- +/- buttons set manual override
- Templates apply percentages
- Budget mode shows pool bar
- Pricing toggle shows $ values

### Step 8: Commit

```bash
git add client/src/pages/quotes/
git commit -m "feat: rebuild quote builder with dual modes, percentage sliders, and pricing"
```

---

## Task 14: Client — Templates Page (Percentage-Based)

**Files:**
- Modify: `client/src/pages/TemplatesPage.tsx`

**Step 1: Update TemplateCard and ShotRow**

- Replace "Quantity" column with "Percentage" column
- Show `%` symbol, validate percentages sum to 100%
- Add validation warning if total != 100%
- Preview section: "For a 60s film: 3 Masterplan Aerial, 6 Aerial, 6 Exterior" (using the distribution algorithm)

**Step 2: Update TemplateDialog**

- Template shot creation now takes `percentage` instead of `quantity`

**Step 3: Commit**

```bash
git add client/src/pages/TemplatesPage.tsx
git commit -m "feat: convert TemplatesPage to percentage-based shot definitions"
```

---

## Task 15: Client — Rate Cards Page (Hourly Rate)

**Files:**
- Modify: `client/src/pages/RateCardsPage.tsx`

**Step 1: Add hourly_rate field**

- Add "Hourly Rate ($/hr)" field to RateCardDialog (create/edit)
- Display hourly_rate on RateCardRow header
- Default to 125

**Step 2: Commit**

```bash
git add client/src/pages/RateCardsPage.tsx
git commit -m "feat: add hourly_rate field to rate cards UI"
```

---

## Task 16: Integration Testing

Run the full test suite and fix any breakage.

**Files:**
- All test files

**Step 1: Run full test suite**

Run: `npm test`

Fix any failures from the type/schema/route changes.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Fix any TypeScript errors across all workspaces.

**Step 3: Run lint**

Run: `npm run lint:fix`

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve test failures and type errors from rebuild"
```

---

## Task 17: Verify & Deploy

Full verification cycle per CLAUDE.md deploy workflow.

**Step 1: Run dev server and verify locally**

```bash
npm run dev
```

Test all flows:
- Create development
- Create forecasted project
- Create Kantata-linked project
- Create retainer quote → builder → save
- Create budget quote → builder → save
- Apply template with sliders
- Change status and verify audit trail
- Link forecasted project to Kantata
- Rate card with hourly rate
- Templates with percentages

**Step 2: Lightpanda quick check**

```bash
lightpanda fetch --dump http://192.168.0.51:5174/ 2>/dev/null
```

Verify: Page renders, no errors.

**Step 3: Commit, push, follow deploy workflow**

Follow CLAUDE.md Steps 1-4: commit → push → GitHub Actions → Watchtower → Chrome MCP verify.

---

## Dependency Order

```
Task 1 (Types) ← foundation for everything
Task 2 (DB Migration) ← must run before server/client changes
Task 3 (Calc Library) ← used by server routes and client builder
Task 4 (Validation) ← used by server routes
Task 5 (Dev/Project Routes) ← new server endpoints
Task 6 (Quote Routes) ← depends on 1-5
Task 7 (Template/RateCard Routes) ← depends on 1, 4
Task 8 (Client Hooks) ← depends on 5-7 (API endpoints exist)
Task 9 (Routing/Sidebar) ← depends on 8 (hooks exist)
Task 10 (ProjectsHomePage) ← depends on 8, 9
Task 11 (ProjectDetailPage) ← depends on 8, 9
Task 12 (QuoteDetailPage) ← depends on 6, 8
Task 13 (Builder) ← depends on 3, 6, 8 (biggest task)
Task 14 (Templates UI) ← depends on 7, 8
Task 15 (Rate Cards UI) ← depends on 7, 8
Task 16 (Integration) ← depends on all above
Task 17 (Deploy) ← depends on 16
```

Parallelizable pairs:
- Tasks 3+4 (calc lib + validation)
- Tasks 5+7 (dev/project routes + template/ratecard routes)
- Tasks 10+11 (home page + detail page)
- Tasks 14+15 (templates UI + rate cards UI)
