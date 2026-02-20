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
};

type MappedShot = {
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
};

function mapShots(shots: ShotInput[]): MappedShot[] {
  return shots.map((shot, idx) => {
    const efficiency = shot.efficiency_multiplier || 1;
    const quantity = shot.quantity || 1;
    const baseHours = shot.base_hours_each || 0;
    return {
      shot_type: shot.shot_type,
      percentage: shot.percentage ?? 0,
      quantity,
      base_hours_each: baseHours,
      efficiency_multiplier: efficiency,
      adjusted_hours: baseHours * quantity * efficiency,
      sort_order: shot.sort_order ?? idx,
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
      o.pool_budget_amount !== undefined
        ? o.pool_budget_amount
        : (poolHours ?? 0) * hourlyRate;
    return { poolHours, poolAmount };
  }

  if (o.pool_budget_amount !== undefined) {
    const poolAmount = o.pool_budget_amount;
    const poolHours = budgetToPoolHours(poolAmount ?? 0, hourlyRate);
    return { poolHours, poolAmount };
  }

  // Fallback: use existing values or calculate from rate card
  const poolHours =
    o.existing_pool_hours ?? poolBudgetHours(durationSeconds, hoursPerSecond);
  const poolAmount =
    o.existing_pool_amount ?? (poolHours !== null ? poolHours * hourlyRate : null);
  return { poolHours, poolAmount };
}

/** Insert shot rows for a version and return the created rows. */
async function insertShots(
  client: PoolClient,
  versionId: string,
  shots: MappedShot[],
): Promise<unknown[]> {
  const created: unknown[] = [];
  for (const shot of shots) {
    const { rows } = await client.query(
      `INSERT INTO version_shots (
         version_id, shot_type, percentage, quantity,
         base_hours_each, efficiency_multiplier, adjusted_hours, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ],
    );
    created.push(rows[0]);
  }
  return created;
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

    const shotsByVersion = groupByKey(allShots, 'version_id');

    const versionsWithShots = versions.map((version: { id: string }) => ({
      ...version,
      shots: shotsByVersion.get(version.id) ?? [],
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
        [
          req.params.id,
          current.status,
          parsed.data.status,
          req.user!.id,
          req.user?.email ?? null,
        ],
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

      const shotRows = mapShots(parsed.data.shots ?? []);
      const total_hours =
        totalShotHours(shotRows) +
        editingHours(durationSeconds, Number(rateCard.editing_hours_per_30s));

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
          shotCount(durationSeconds),
          poolHours,
          poolAmount,
          total_hours,
          hourlyRate,
          parsed.data.notes ?? null,
          createdBy,
        ],
      );

      const version = versionRows[0];
      const createdShots = await insertShots(client, version.id, shotRows);

      await touchQuote(client, req.params.id, modeForVersion, quote.mode as string);

      return { ...version, shots: createdShots };
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

      // Resolve shots: use provided shots or re-map existing ones
      let shotRows: MappedShot[];
      if (parsed.data.shots) {
        shotRows = mapShots(parsed.data.shots);
      } else {
        const { rows: existingShots } = await client.query(
          `SELECT shot_type, percentage, quantity, base_hours_each, efficiency_multiplier, sort_order
           FROM version_shots WHERE version_id = $1 ORDER BY sort_order ASC`,
          [req.params.versionId],
        );
        shotRows = mapShots(existingShots);
      }

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

      const total_hours =
        totalShotHours(shotRows) +
        editingHours(durationSeconds, Number(rateCard.editing_hours_per_30s));

      // Replace shots if new ones provided, otherwise keep existing
      let persistedShots: unknown[];
      if (parsed.data.shots) {
        await client.query('DELETE FROM version_shots WHERE version_id = $1', [
          req.params.versionId,
        ]);
        persistedShots = await insertShots(client, req.params.versionId, shotRows);
      } else {
        const { rows: existing } = await client.query(
          'SELECT * FROM version_shots WHERE version_id = $1 ORDER BY sort_order ASC',
          [req.params.versionId],
        );
        persistedShots = existing;
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
          shotCount(durationSeconds),
          poolHours,
          poolAmount,
          total_hours,
          hourlyRate,
          notes ?? null,
          req.params.versionId,
        ],
      );

      await touchQuote(client, req.params.id, modeForVersion, quote.mode as string);

      return { ...updatedRows[0], shots: persistedShots };
    });

    res.json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to update version');
  }
});

export default router;
