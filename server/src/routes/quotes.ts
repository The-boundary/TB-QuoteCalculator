import { Router, type Request, type Response } from 'express';
import { dbQuery, dbTransaction } from '../services/supabase.js';
import { sendServerError, sendNotFound, httpError, type HttpError } from '../utils/route-helpers.js';
import {
  validate,
  createQuoteSchema,
  updateQuoteSchema,
  updateStatusSchema,
  createVersionSchema,
  updateVersionSchema,
} from '../lib/validation.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/quotes -- list all quotes with latest version summary
// ---------------------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows: quotes } = await dbQuery(
      `SELECT * FROM quotes WHERE status != 'archived' ORDER BY updated_at DESC`,
    );

    if (quotes.length === 0) return res.json([]);

    // Batch fetch all versions for these quotes (single query instead of N+1)
    const quoteIds = quotes.map((q: { id: string }) => q.id);
    const { rows: allVersions } = await dbQuery(
      `SELECT id, quote_id, version_number, duration_seconds, pool_budget_hours, total_hours, created_at
       FROM quote_versions
       WHERE quote_id = ANY($1)
       ORDER BY version_number DESC`,
      [quoteIds],
    );

    // Group versions by quote_id
    const versionsByQuote = new Map<string, typeof allVersions>();
    for (const v of allVersions) {
      const existing = versionsByQuote.get(v.quote_id);
      if (existing) existing.push(v);
      else versionsByQuote.set(v.quote_id, [v]);
    }

    const enriched = quotes.map((quote: { id: string }) => {
      const versions = versionsByQuote.get(quote.id) || [];
      return {
        ...quote,
        latest_version: versions[0] || null,
        version_count: versions.length,
      };
    });

    res.json(enriched);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list quotes');
  }
});

// ---------------------------------------------------------------------------
// GET /api/quotes/:id -- get quote with all versions and shots
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: quoteRows } = await dbQuery(
      `SELECT * FROM quotes WHERE id = $1`,
      [req.params.id],
    );

    const quote = quoteRows[0];
    if (!quote) return sendNotFound(res, 'Quote');

    // Get rate card
    const { rows: rcRows } = await dbQuery(
      `SELECT * FROM rate_cards WHERE id = $1`,
      [quote.rate_card_id],
    );
    const rateCard = rcRows[0] || null;

    // Get all versions
    const { rows: versions } = await dbQuery(
      `SELECT * FROM quote_versions WHERE quote_id = $1 ORDER BY version_number ASC`,
      [req.params.id],
    );

    // Batch fetch all shots for all versions (single query instead of N+1)
    const versionIds = versions.map((v: { id: string }) => v.id);
    const allShots = versionIds.length > 0
      ? (await dbQuery(
          `SELECT * FROM version_shots WHERE version_id = ANY($1) ORDER BY sort_order`,
          [versionIds],
        )).rows
      : [];

    const shotsByVersion = new Map<string, typeof allShots>();
    for (const shot of allShots) {
      const existing = shotsByVersion.get(shot.version_id);
      if (existing) existing.push(shot);
      else shotsByVersion.set(shot.version_id, [shot]);
    }

    const versionsWithShots = versions.map((version: { id: string }) => ({
      ...version,
      shots: shotsByVersion.get(version.id) || [],
    }));

    res.json({ ...quote, rate_card: rateCard, versions: versionsWithShots });
  } catch (err) {
    return sendServerError(res, err, 'Failed to get quote');
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes -- create quote with empty v1
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createQuoteSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { client_name, project_name, rate_card_id } = parsed.data;

    const result = await dbTransaction(async (client) => {
      // Get rate card for pool calculation
      const { rows: rcRows } = await client.query(
        `SELECT hours_per_second, editing_hours_per_30s FROM rate_cards WHERE id = $1`,
        [rate_card_id],
      );
      const rateCard = rcRows[0];
      if (!rateCard) throw httpError('Invalid rate card', 400);

      // Create quote
      const { rows: quoteRows } = await client.query(
        `INSERT INTO quotes (client_name, project_name, rate_card_id, status, created_by)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING *`,
        [client_name, project_name, rate_card_id, req.user!.id],
      );
      const quote = quoteRows[0];

      // Create empty version 1 with default 60s duration
      const defaultDuration = 60;
      const poolBudget = defaultDuration * rateCard.hours_per_second;
      const editingHours = Math.ceil(defaultDuration / 30) * rateCard.editing_hours_per_30s;

      const { rows: versionRows } = await client.query(
        `INSERT INTO quote_versions (quote_id, version_number, duration_seconds, pool_budget_hours, total_hours, created_by)
         VALUES ($1, 1, $2, $3, $4, $5)
         RETURNING *`,
        [quote.id, defaultDuration, poolBudget, editingHours, req.user!.id],
      );
      const version = versionRows[0];

      return { ...quote, versions: [{ ...version, shots: [] }] };
    });

    res.status(201).json(result);
  } catch (err) {
    const httpErr = err as HttpError;
    if (httpErr.statusCode === 400) {
      return res.status(400).json({ error: { message: httpErr.message } });
    }
    return sendServerError(res, err, 'Failed to create quote');
  }
});

// ---------------------------------------------------------------------------
// PUT /api/quotes/:id -- update quote metadata
// ---------------------------------------------------------------------------
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateQuoteSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { client_name, project_name } = parsed.data;

    const { rows } = await dbQuery(
      `UPDATE quotes SET client_name = $1, project_name = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [client_name, project_name, req.params.id],
    );

    if (rows.length === 0) return sendNotFound(res, 'Quote');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to update quote');
  }
});

// ---------------------------------------------------------------------------
// PUT /api/quotes/:id/status -- update status
// ---------------------------------------------------------------------------
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateStatusSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { status } = parsed.data;

    // Approval requires Admin role
    if (status === 'approved' && !req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Only admins can approve quotes' } });
    }

    const { rows } = await dbQuery(
      `UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );

    if (rows.length === 0) return sendNotFound(res, 'Quote');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to update quote status');
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/quotes/:id -- archive quote (soft delete)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery(
      `UPDATE quotes SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id],
    );

    if (rows.length === 0) return sendNotFound(res, 'Quote');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to archive quote');
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes/:id/versions -- create new version
// ---------------------------------------------------------------------------
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createVersionSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { duration_seconds, notes, shots } = parsed.data;

    const result = await dbTransaction(async (client) => {
      // Get quote and rate card
      const { rows: quoteRows } = await client.query(
        `SELECT rate_card_id FROM quotes WHERE id = $1`,
        [req.params.id],
      );
      const quote = quoteRows[0];
      if (!quote) throw httpError('Quote not found', 404);

      const { rows: rcRows } = await client.query(
        `SELECT hours_per_second, editing_hours_per_30s FROM rate_cards WHERE id = $1`,
        [quote.rate_card_id],
      );
      const rateCard = rcRows[0];
      if (!rateCard) throw httpError('Rate card not found', 400);

      // Get next version number
      const { rows: existingVersions } = await client.query(
        `SELECT version_number FROM quote_versions WHERE quote_id = $1 ORDER BY version_number DESC LIMIT 1`,
        [req.params.id],
      );
      const nextVersion = (existingVersions[0]?.version_number || 0) + 1;

      // Calculate budget
      const poolBudget = duration_seconds * rateCard.hours_per_second;
      const editingHours = Math.ceil(duration_seconds / 30) * rateCard.editing_hours_per_30s;

      // Calculate total shot hours
      const shotRows = (shots || []).map((shot, idx) => ({
        shot_type: shot.shot_type,
        quantity: shot.quantity || 1,
        base_hours_each: shot.base_hours_each,
        efficiency_multiplier: shot.efficiency_multiplier || 1.0,
        adjusted_hours:
          (shot.base_hours_each || 0) * (shot.quantity || 1) * (shot.efficiency_multiplier || 1.0),
        sort_order: shot.sort_order ?? idx,
      }));

      const totalShotHours = shotRows.reduce((sum, s) => sum + s.adjusted_hours, 0);
      const totalHours = totalShotHours + editingHours;

      // Create version
      const { rows: versionRows } = await client.query(
        `INSERT INTO quote_versions (quote_id, version_number, duration_seconds, pool_budget_hours, total_hours, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.params.id, nextVersion, duration_seconds, poolBudget, totalHours, notes || null, req.user!.id],
      );
      const version = versionRows[0];

      // Create shots
      const createdShots = [];
      for (const s of shotRows) {
        const { rows } = await client.query(
          `INSERT INTO version_shots (version_id, shot_type, quantity, base_hours_each, efficiency_multiplier, adjusted_hours, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [version.id, s.shot_type, s.quantity, s.base_hours_each, s.efficiency_multiplier, s.adjusted_hours, s.sort_order],
        );
        createdShots.push(rows[0]);
      }

      // Update quote updated_at
      await client.query(
        `UPDATE quotes SET updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );

      return { ...version, shots: createdShots };
    });

    res.status(201).json(result);
  } catch (err) {
    const httpErr = err as HttpError;
    if (httpErr.statusCode === 404) {
      return res.status(404).json({ error: { message: httpErr.message } });
    }
    if (httpErr.statusCode === 400) {
      return res.status(400).json({ error: { message: httpErr.message } });
    }
    return sendServerError(res, err, 'Failed to create version');
  }
});

// ---------------------------------------------------------------------------
// PUT /api/quotes/:id/versions/:versionId -- update version shots
// ---------------------------------------------------------------------------
router.put('/:id/versions/:versionId', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateVersionSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { duration_seconds, shots, notes } = parsed.data;

    const result = await dbTransaction(async (client) => {
      // Get rate card for calculations
      const { rows: quoteRows } = await client.query(
        `SELECT rate_card_id FROM quotes WHERE id = $1`,
        [req.params.id],
      );
      const quote = quoteRows[0];
      if (!quote) throw httpError('Quote not found', 404);

      const { rows: rcRows } = await client.query(
        `SELECT hours_per_second, editing_hours_per_30s FROM rate_cards WHERE id = $1`,
        [quote.rate_card_id],
      );
      const rateCard = rcRows[0];
      if (!rateCard) throw httpError('Rate card not found', 400);

      const dur = duration_seconds || 60;
      const poolBudget = dur * rateCard.hours_per_second;
      const editingHours = Math.ceil(dur / 30) * rateCard.editing_hours_per_30s;

      // Recalculate shots
      const shotRows = (shots || []).map((shot, idx) => ({
        version_id: req.params.versionId,
        shot_type: shot.shot_type,
        quantity: shot.quantity || 1,
        base_hours_each: shot.base_hours_each,
        efficiency_multiplier: shot.efficiency_multiplier || 1.0,
        adjusted_hours:
          (shot.base_hours_each || 0) * (shot.quantity || 1) * (shot.efficiency_multiplier || 1.0),
        sort_order: shot.sort_order ?? idx,
      }));

      const totalShotHours = shotRows.reduce((sum, s) => sum + s.adjusted_hours, 0);
      const totalHours = totalShotHours + editingHours;

      // Delete existing shots
      await client.query(
        `DELETE FROM version_shots WHERE version_id = $1`,
        [req.params.versionId],
      );

      // Insert new shots
      const createdShots = [];
      for (const s of shotRows) {
        const { rows } = await client.query(
          `INSERT INTO version_shots (version_id, shot_type, quantity, base_hours_each, efficiency_multiplier, adjusted_hours, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [s.version_id, s.shot_type, s.quantity, s.base_hours_each, s.efficiency_multiplier, s.adjusted_hours, s.sort_order],
        );
        createdShots.push(rows[0]);
      }

      // Update version
      const setClauses = [
        'duration_seconds = $1',
        'pool_budget_hours = $2',
        'total_hours = $3',
      ];
      const params: unknown[] = [dur, poolBudget, totalHours];
      let paramIdx = 4;

      if (notes !== undefined) {
        setClauses.push(`notes = $${paramIdx}`);
        params.push(notes);
        paramIdx++;
      }

      params.push(req.params.versionId);
      const { rows: versionRows } = await client.query(
        `UPDATE quote_versions SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params,
      );
      const version = versionRows[0];

      // Update quote updated_at
      await client.query(
        `UPDATE quotes SET updated_at = NOW() WHERE id = $1`,
        [req.params.id],
      );

      return { ...version, shots: createdShots };
    });

    res.json(result);
  } catch (err) {
    const httpErr = err as HttpError;
    if (httpErr.statusCode === 404) {
      return res.status(404).json({ error: { message: httpErr.message } });
    }
    if (httpErr.statusCode === 400) {
      return res.status(400).json({ error: { message: httpErr.message } });
    }
    return sendServerError(res, err, 'Failed to update version');
  }
});

export default router;
