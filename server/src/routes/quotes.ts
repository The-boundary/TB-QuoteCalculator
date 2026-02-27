import { Router, type Request, type Response } from 'express';
import type { PoolClient } from 'pg';
import { dbQuery, dbTransaction } from '../services/supabase.js';
import {
  budgetToPoolHours,
  editingHours,
  poolBudgetHours,
  shotCount,
  totalShotHours,
} from '../lib/quoteCalc.js';
import {
  createQuoteSchema,
  createVersionSchema,
  updateStatusSchema,
  updateVersionSchema,
  validate,
} from '../lib/validation.js';
import {
  httpError,
  sendNotFound,
  sendServerError,
  handleRouteError,
  resolveCreatedBy,
  groupByKey,
} from '../utils/route-helpers.js';

const router = Router();

function canTransitionStatus(current: string, next: string): boolean {
  if (current === next) return true;
  if (current === 'archived') return false;
  if (next === 'archived') return true;
  if (next === 'draft') return true;

  if (current === 'draft') return next === 'negotiating';
  if (current === 'negotiating') return next === 'awaiting_approval';
  if (current === 'awaiting_approval') return next === 'confirmed';
  return false;
}

type ShotInput = {
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  sort_order?: number;
  is_companion?: boolean;
  module_id?: string;
  animation_override?: 'regular' | 'complex' | null;
};

type MappedShot = {
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
  is_companion: boolean;
  module_id?: string;
  animation_override: 'regular' | 'complex' | null;
};

export function mapShots(shots: ShotInput[]): MappedShot[] {
  return shots.map((shot, idx) => {
    const efficiency = shot.efficiency_multiplier ?? 1;
    const quantity = shot.quantity ?? 0;
    const baseHours = shot.base_hours_each ?? 0;
    return {
      shot_type: shot.shot_type,
      percentage: shot.percentage ?? 0,
      quantity,
      base_hours_each: baseHours,
      efficiency_multiplier: efficiency,
      adjusted_hours: baseHours * quantity * efficiency,
      sort_order: shot.sort_order ?? idx,
      is_companion: shot.is_companion ?? false,
      module_id: shot.module_id,
      animation_override: shot.animation_override ?? null,
    };
  });
}

/** Calculate pool budget hours and amount for a version. */
function calculatePoolBudget(
  mode: string,
  hourlyRate: number,
  durationSeconds: number,
  hoursPerSecond: number,
  overrides?: {
    pool_budget_hours?: number | null;
    pool_budget_amount?: number | null;
    existing_pool_hours?: number | null;
    existing_pool_amount?: number | null;
  },
): { poolHours: number | null; poolAmount: number | null } {
  if (mode !== 'budget') return { poolHours: null, poolAmount: null };

  const o = overrides ?? {};

  if (o.pool_budget_hours !== undefined) {
    const poolHours = o.pool_budget_hours;
    const poolAmount =
      o.pool_budget_amount !== undefined ? o.pool_budget_amount : (poolHours ?? 0) * hourlyRate;
    return { poolHours, poolAmount };
  }

  if (o.pool_budget_amount !== undefined) {
    const poolAmount = o.pool_budget_amount;
    const poolHours = budgetToPoolHours(poolAmount ?? 0, hourlyRate);
    return { poolHours, poolAmount };
  }

  // Fallback: use existing values or calculate from rate card
  const poolHours = o.existing_pool_hours ?? poolBudgetHours(durationSeconds, hoursPerSecond);
  const poolAmount = o.existing_pool_amount ?? (poolHours !== null ? poolHours * hourlyRate : null);
  return { poolHours, poolAmount };
}

/** Insert shot rows for a version and return the created rows. */
async function insertShots(
  client: PoolClient,
  versionId: string,
  shots: MappedShot[],
  moduleId?: string,
): Promise<unknown[]> {
  const created: unknown[] = [];
  for (const shot of shots) {
    const { rows } = await client.query(
      `INSERT INTO version_shots (
         version_id, shot_type, percentage, quantity,
         base_hours_each, efficiency_multiplier, adjusted_hours, sort_order,
         is_companion, module_id, animation_override
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        versionId,
        shot.shot_type,
        shot.percentage,
        shot.quantity,
        shot.base_hours_each,
        shot.efficiency_multiplier,
        shot.adjusted_hours,
        shot.sort_order,
        shot.is_companion,
        shot.module_id ?? moduleId ?? null,
        shot.animation_override,
      ],
    );
    created.push(rows[0]);
  }
  return created;
}

type LineItemInput = {
  name: string;
  category: 'service' | 'deliverable' | 'pre_production';
  hours_each: number;
  quantity: number;
  notes?: string | null;
  sort_order?: number;
};

async function insertLineItems(
  client: PoolClient,
  versionId: string,
  items: LineItemInput[],
): Promise<unknown[]> {
  const created: unknown[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const totalHrs = item.hours_each * item.quantity;
    const { rows } = await client.query(
      `INSERT INTO version_line_items (
         version_id, name, category, hours_each, quantity, total_hours, notes, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        versionId,
        item.name,
        item.category,
        item.hours_each,
        item.quantity,
        totalHrs,
        item.notes ?? null,
        item.sort_order ?? i,
      ],
    );
    created.push(rows[0]);
  }
  return created;
}

function totalLineItemHours(items: LineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.hours_each * item.quantity, 0);
}

/** Fetch quote with rate card inside a transaction, throwing on not-found. */
async function fetchQuoteWithRateCard(
  client: PoolClient,
  quoteId: string,
): Promise<{ quote: Record<string, unknown>; rateCard: Record<string, unknown> }> {
  const { rows: quoteRows } = await client.query(
    'SELECT id, mode, rate_card_id FROM quotes WHERE id = $1',
    [quoteId],
  );
  const quote = quoteRows[0];
  if (!quote) throw httpError('Quote not found', 404);

  const { rows: rcRows } = await client.query(
    'SELECT hours_per_second, editing_hours_per_30s, hourly_rate FROM rate_cards WHERE id = $1',
    [quote.rate_card_id],
  );
  const rateCard = rcRows[0];
  if (!rateCard) throw httpError('Rate card not found', 400);

  return { quote, rateCard };
}

/** Touch quote updated_at and optionally update mode. */
async function touchQuote(
  client: PoolClient,
  quoteId: string,
  newMode?: string,
  currentMode?: string,
): Promise<void> {
  await client.query('UPDATE quotes SET updated_at = NOW() WHERE id = $1', [quoteId]);
  if (newMode && newMode !== currentMode) {
    await client.query('UPDATE quotes SET mode = $1 WHERE id = $2', [newMode, quoteId]);
  }
}

// GET /api/quotes
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery(
      `SELECT q.*,
              p.name AS project_name,
              p.kantata_id,
              p.is_forecasted,
              d.id AS development_id,
              d.name AS development_name,
              d.client_name AS development_client_name,
              (
                SELECT json_build_object(
                  'id', v.id,
                  'version_number', v.version_number,
                  'duration_seconds', v.duration_seconds,
                  'shot_count', v.shot_count,
                  'pool_budget_hours', v.pool_budget_hours,
                  'pool_budget_amount', v.pool_budget_amount,
                  'total_hours', v.total_hours,
                  'hourly_rate', v.hourly_rate
                )
                FROM quote_versions v
                WHERE v.quote_id = q.id
                ORDER BY v.version_number DESC
                LIMIT 1
              ) AS latest_version,
              (
                SELECT COUNT(*)::int
                FROM quote_versions v
                WHERE v.quote_id = q.id
              ) AS version_count
       FROM quotes q
       JOIN projects p ON p.id = q.project_id
       JOIN developments d ON d.id = p.development_id
       WHERE q.status != 'archived'
       ORDER BY q.updated_at DESC`,
    );

    res.json(rows);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list quotes');
  }
});

// GET /api/quotes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: quoteRows } = await dbQuery(
      `SELECT q.*,
              p.name AS project_name,
              p.kantata_id,
              p.is_forecasted,
              p.development_id,
              d.name AS development_name,
              d.client_name AS development_client_name
       FROM quotes q
       JOIN projects p ON p.id = q.project_id
       JOIN developments d ON d.id = p.development_id
       WHERE q.id = $1`,
      [req.params.id],
    );

    const quote = quoteRows[0];
    if (!quote) return sendNotFound(res, 'Quote');

    const { rows: rateCardRows } = await dbQuery('SELECT * FROM rate_cards WHERE id = $1', [
      quote.rate_card_id,
    ]);

    const { rows: versions } = await dbQuery(
      'SELECT * FROM quote_versions WHERE quote_id = $1 ORDER BY version_number ASC',
      [req.params.id],
    );

    const versionIds = versions.map((version: { id: string }) => version.id);
    const allShots =
      versionIds.length > 0
        ? (
            await dbQuery(
              'SELECT * FROM version_shots WHERE version_id = ANY($1) ORDER BY sort_order ASC',
              [versionIds],
            )
          ).rows
        : [];

    const allModules =
      versionIds.length > 0
        ? (
            await dbQuery(
              'SELECT * FROM version_modules WHERE version_id = ANY($1) ORDER BY sort_order ASC',
              [versionIds],
            )
          ).rows
        : [];

    const allLineItems =
      versionIds.length > 0
        ? (
            await dbQuery(
              'SELECT * FROM version_line_items WHERE version_id = ANY($1) ORDER BY sort_order ASC',
              [versionIds],
            )
          ).rows
        : [];

    const shotsByVersion = groupByKey(allShots, 'version_id');
    const modulesByVersion = groupByKey(allModules, 'version_id');
    const lineItemsByVersion = groupByKey(allLineItems, 'version_id');

    const versionsWithShots = versions.map((version: { id: string }) => ({
      ...version,
      modules: modulesByVersion.get(version.id) ?? [],
      shots: shotsByVersion.get(version.id) ?? [],
      line_items: lineItemsByVersion.get(version.id) ?? [],
    }));

    const { rows: statusLog } = await dbQuery(
      'SELECT * FROM quote_status_log WHERE quote_id = $1 ORDER BY changed_at ASC',
      [req.params.id],
    );

    res.json({
      ...quote,
      rate_card: rateCardRows[0] ?? null,
      project: {
        id: quote.project_id,
        development_id: quote.development_id,
        name: quote.project_name,
        kantata_id: quote.kantata_id,
        is_forecasted: quote.is_forecasted,
        development_name: quote.development_name,
        development_client_name: quote.development_client_name,
      },
      versions: versionsWithShots,
      status_log: statusLog,
    });
  } catch (err) {
    return sendServerError(res, err, 'Failed to get quote');
  }
});

// POST /api/quotes
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createQuoteSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const result = await dbTransaction(async (client) => {
      const { project_id, mode, rate_card_id } = parsed.data;
      const createdBy = resolveCreatedBy(req.user!.id);

      const { rows: projectRows } = await client.query('SELECT id FROM projects WHERE id = $1', [
        project_id,
      ]);
      if (!projectRows[0]) throw httpError('Project not found', 404);

      const { rows: rateCardRows } = await client.query(
        `SELECT hours_per_second, editing_hours_per_30s, hourly_rate
         FROM rate_cards WHERE id = $1`,
        [rate_card_id],
      );
      const rateCard = rateCardRows[0];
      if (!rateCard) throw httpError('Invalid rate card', 400);

      const { rows: quoteRows } = await client.query(
        `INSERT INTO quotes (project_id, mode, rate_card_id, status, created_by)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING *`,
        [project_id, mode, rate_card_id, createdBy],
      );
      const quote = quoteRows[0];

      const { rows: statusRows } = await client.query(
        `INSERT INTO quote_status_log (quote_id, old_status, new_status, changed_by, changed_by_email)
         VALUES ($1, NULL, 'draft', $2, $3)
         RETURNING *`,
        [quote.id, req.user!.id, req.user?.email ?? null],
      );

      const durationSeconds = 60;
      const hourlyRate = Number(rateCard.hourly_rate ?? 125);
      const { poolHours, poolAmount } = calculatePoolBudget(
        mode,
        hourlyRate,
        durationSeconds,
        Number(rateCard.hours_per_second),
      );

      const { rows: versionRows } = await client.query(
        `INSERT INTO quote_versions (
            quote_id, version_number, duration_seconds, shot_count,
            pool_budget_hours, pool_budget_amount, total_hours,
            hourly_rate, notes, created_by
          )
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, NULL, $8)
         RETURNING *`,
        [
          quote.id,
          durationSeconds,
          shotCount(durationSeconds),
          poolHours,
          poolAmount,
          editingHours(durationSeconds, Number(rateCard.editing_hours_per_30s)),
          hourlyRate,
          createdBy,
        ],
      );

      return {
        ...quote,
        versions: [{ ...versionRows[0], shots: [] }],
        status_log: statusRows,
      };
    });

    res.status(201).json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to create quote');
  }
});

// PUT /api/quotes/:id/status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateStatusSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const result = await dbTransaction(async (client) => {
      const { rows: currentRows } = await client.query('SELECT * FROM quotes WHERE id = $1', [
        req.params.id,
      ]);
      const current = currentRows[0];
      if (!current) throw httpError('Quote not found', 404);

      if (!canTransitionStatus(current.status, parsed.data.status)) {
        throw httpError(
          `Invalid status transition: ${current.status} -> ${parsed.data.status}`,
          400,
        );
      }

      const { rows: updatedRows } = await client.query(
        'UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [parsed.data.status, req.params.id],
      );

      await client.query(
        `INSERT INTO quote_status_log (quote_id, old_status, new_status, changed_by, changed_by_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, current.status, parsed.data.status, req.user!.id, req.user?.email ?? null],
      );

      return updatedRows[0];
    });

    res.json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to update quote status');
  }
});

// DELETE /api/quotes/:id (soft archive)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await dbTransaction(async (client) => {
      const { rows: currentRows } = await client.query('SELECT * FROM quotes WHERE id = $1', [
        req.params.id,
      ]);
      const current = currentRows[0];
      if (!current) throw httpError('Quote not found', 404);

      const { rows: updatedRows } = await client.query(
        `UPDATE quotes SET status = 'archived', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [req.params.id],
      );

      await client.query(
        `INSERT INTO quote_status_log (quote_id, old_status, new_status, changed_by, changed_by_email)
         VALUES ($1, $2, 'archived', $3, $4)`,
        [req.params.id, current.status, req.user!.id, req.user?.email ?? null],
      );

      return updatedRows[0];
    });

    res.json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to archive quote');
  }
});

// POST /api/quotes/:id/versions
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createVersionSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const result = await dbTransaction(async (client) => {
      const { quote, rateCard } = await fetchQuoteWithRateCard(client, req.params.id);
      const createdBy = resolveCreatedBy(req.user!.id);

      const { rows: nextRows } = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM quote_versions WHERE quote_id = $1`,
        [req.params.id],
      );

      const durationSeconds = parsed.data.duration_seconds;
      const hourlyRate = Number(parsed.data.hourly_rate ?? rateCard.hourly_rate ?? 125);
      const modeForVersion = parsed.data.mode ?? (quote.mode as string);

      const { poolHours, poolAmount } = calculatePoolBudget(
        modeForVersion,
        hourlyRate,
        durationSeconds,
        Number(rateCard.hours_per_second),
        {
          pool_budget_hours: parsed.data.pool_budget_hours,
          pool_budget_amount: parsed.data.pool_budget_amount,
        },
      );

      const lineItems: LineItemInput[] = parsed.data.line_items ?? [];
      const inputModules = parsed.data.modules;

      // Compute total shot hours and shot count across all modules
      let allShotRows: MappedShot[] = [];
      let totalShotCountVal = 0;

      if (inputModules && inputModules.length > 0) {
        for (const mod of inputModules) {
          allShotRows = allShotRows.concat(mapShots(mod.shots ?? []));
          totalShotCountVal += shotCount(mod.duration_seconds);
        }
      } else {
        allShotRows = mapShots(parsed.data.shots ?? []);
        totalShotCountVal = shotCount(durationSeconds);
      }

      const total_hours =
        totalShotHours(allShotRows) +
        editingHours(durationSeconds, Number(rateCard.editing_hours_per_30s)) +
        totalLineItemHours(lineItems);

      const { rows: versionRows } = await client.query(
        `INSERT INTO quote_versions (
            quote_id, version_number, duration_seconds, shot_count,
            pool_budget_hours, pool_budget_amount, total_hours,
            hourly_rate, notes, created_by
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          req.params.id,
          nextRows[0].next_version,
          durationSeconds,
          totalShotCountVal,
          poolHours,
          poolAmount,
          total_hours,
          hourlyRate,
          parsed.data.notes ?? null,
          createdBy,
        ],
      );

      const version = versionRows[0];

      // Insert modules and their shots
      const createdModules: unknown[] = [];
      const createdShots: unknown[] = [];

      if (inputModules && inputModules.length > 0) {
        for (let i = 0; i < inputModules.length; i++) {
          const mod = inputModules[i];
          const modShotCount = shotCount(mod.duration_seconds);
          const { rows: moduleRows } = await client.query(
            `INSERT INTO version_modules (version_id, name, module_type, duration_seconds, shot_count, animation_complexity, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [version.id, mod.name, mod.module_type, mod.duration_seconds, modShotCount, mod.animation_complexity, mod.sort_order ?? i],
          );
          createdModules.push(moduleRows[0]);
          const moduleShots = await insertShots(client, version.id, mapShots(mod.shots ?? []), moduleRows[0].id);
          createdShots.push(...moduleShots);
        }
      } else {
        // Backward compat: create a default module
        const { rows: moduleRows } = await client.query(
          `INSERT INTO version_modules (version_id, name, module_type, duration_seconds, shot_count, animation_complexity, sort_order)
           VALUES ($1, 'Film 1', 'film', $2, $3, 'regular', 0)
           RETURNING *`,
          [version.id, durationSeconds, shotCount(durationSeconds)],
        );
        createdModules.push(moduleRows[0]);
        const moduleShots = await insertShots(client, version.id, allShotRows, moduleRows[0].id);
        createdShots.push(...moduleShots);
      }

      const createdLineItems = await insertLineItems(client, version.id, lineItems);

      await touchQuote(client, req.params.id, modeForVersion, quote.mode as string);

      return { ...version, modules: createdModules, shots: createdShots, line_items: createdLineItems };
    });

    res.status(201).json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to create version');
  }
});

// PUT /api/quotes/:id/versions/:versionId
router.put('/:id/versions/:versionId', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateVersionSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const result = await dbTransaction(async (client) => {
      const { quote, rateCard } = await fetchQuoteWithRateCard(client, req.params.id);

      const { rows: versionRows } = await client.query(
        'SELECT * FROM quote_versions WHERE id = $1 AND quote_id = $2',
        [req.params.versionId, req.params.id],
      );
      const existingVersion = versionRows[0];
      if (!existingVersion) throw httpError('Version not found', 404);

      const durationSeconds = parsed.data.duration_seconds ?? existingVersion.duration_seconds;
      const hourlyRate = Number(
        parsed.data.hourly_rate ?? existingVersion.hourly_rate ?? rateCard.hourly_rate ?? 125,
      );
      const modeForVersion = parsed.data.mode ?? (quote.mode as string);

      const { poolHours, poolAmount } = calculatePoolBudget(
        modeForVersion,
        hourlyRate,
        durationSeconds,
        Number(rateCard.hours_per_second),
        {
          pool_budget_hours: parsed.data.pool_budget_hours,
          pool_budget_amount: parsed.data.pool_budget_amount,
          existing_pool_hours: existingVersion.pool_budget_hours,
          existing_pool_amount: existingVersion.pool_budget_amount,
        },
      );

      // Resolve line items: use provided or keep existing
      let lineItems: LineItemInput[];
      let persistedLineItems: unknown[];
      if (parsed.data.line_items) {
        lineItems = parsed.data.line_items;
      } else {
        const { rows: existingLineItems } = await client.query(
          `SELECT name, category, hours_each, quantity, notes, sort_order
           FROM version_line_items WHERE version_id = $1 ORDER BY sort_order ASC`,
          [req.params.versionId],
        );
        lineItems = existingLineItems;
      }

      const inputModules = parsed.data.modules;
      const persistedModules: unknown[] = [];
      let persistedShots: unknown[] = [];
      let allShotRows: MappedShot[] = [];
      let totalShotCountVal = 0;

      if (inputModules && inputModules.length > 0) {
        // Full module replacement: delete existing modules and shots
        await client.query('DELETE FROM version_shots WHERE version_id = $1', [req.params.versionId]);
        await client.query('DELETE FROM version_modules WHERE version_id = $1', [req.params.versionId]);

        for (let i = 0; i < inputModules.length; i++) {
          const mod = inputModules[i];
          const modShotCount = shotCount(mod.duration_seconds);
          totalShotCountVal += modShotCount;
          const modShots = mapShots(mod.shots ?? []);
          allShotRows = allShotRows.concat(modShots);

          const { rows: moduleRows } = await client.query(
            `INSERT INTO version_modules (version_id, name, module_type, duration_seconds, shot_count, animation_complexity, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.params.versionId, mod.name, mod.module_type, mod.duration_seconds, modShotCount, mod.animation_complexity, mod.sort_order ?? i],
          );
          persistedModules.push(moduleRows[0]);
          const moduleShots = await insertShots(client, req.params.versionId, modShots, moduleRows[0].id);
          persistedShots.push(...moduleShots);
        }
      } else if (parsed.data.shots) {
        // Legacy flat shots path
        allShotRows = mapShots(parsed.data.shots);
        totalShotCountVal = shotCount(durationSeconds);

        await client.query('DELETE FROM version_shots WHERE version_id = $1', [req.params.versionId]);

        const { rows: existingModules } = await client.query(
          'SELECT id FROM version_modules WHERE version_id = $1 ORDER BY sort_order ASC LIMIT 1',
          [req.params.versionId],
        );
        let defaultModuleId: string;
        if (existingModules.length > 0) {
          defaultModuleId = existingModules[0].id;
        } else {
          const { rows: newModuleRows } = await client.query(
            `INSERT INTO version_modules (version_id, name, module_type, duration_seconds, shot_count, animation_complexity, sort_order)
             VALUES ($1, 'Film 1', 'film', $2, $3, 'regular', 0)
             RETURNING id`,
            [req.params.versionId, durationSeconds, shotCount(durationSeconds)],
          );
          defaultModuleId = newModuleRows[0].id;
        }

        persistedShots = await insertShots(client, req.params.versionId, allShotRows, defaultModuleId);
      } else {
        // Keep existing shots and modules
        const { rows: existingShots } = await client.query(
          'SELECT * FROM version_shots WHERE version_id = $1 ORDER BY sort_order ASC',
          [req.params.versionId],
        );
        persistedShots = existingShots;
        allShotRows = mapShots(existingShots);
        totalShotCountVal = shotCount(durationSeconds);
      }

      const total_hours =
        totalShotHours(allShotRows) +
        editingHours(durationSeconds, Number(rateCard.editing_hours_per_30s)) +
        totalLineItemHours(lineItems);

      // Replace line items if new ones provided, otherwise keep existing
      if (parsed.data.line_items) {
        await client.query('DELETE FROM version_line_items WHERE version_id = $1', [
          req.params.versionId,
        ]);
        persistedLineItems = await insertLineItems(client, req.params.versionId, lineItems);
      } else {
        const { rows: existing } = await client.query(
          'SELECT * FROM version_line_items WHERE version_id = $1 ORDER BY sort_order ASC',
          [req.params.versionId],
        );
        persistedLineItems = existing;
      }

      const notes = parsed.data.notes !== undefined ? parsed.data.notes : existingVersion.notes;

      const { rows: updatedRows } = await client.query(
        `UPDATE quote_versions
         SET duration_seconds = $1, shot_count = $2,
             pool_budget_hours = $3, pool_budget_amount = $4,
             total_hours = $5, hourly_rate = $6, notes = $7
         WHERE id = $8
         RETURNING *`,
        [
          durationSeconds,
          totalShotCountVal,
          poolHours,
          poolAmount,
          total_hours,
          hourlyRate,
          notes ?? null,
          req.params.versionId,
        ],
      );

      await touchQuote(client, req.params.id, modeForVersion, quote.mode as string);

      return { ...updatedRows[0], modules: persistedModules, shots: persistedShots, line_items: persistedLineItems };
    });

    res.json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to update version');
  }
});

export default router;
