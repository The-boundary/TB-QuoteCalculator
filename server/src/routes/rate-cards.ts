import { Router, type Request, type Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import {
  sendServerError,
  sendNotFound,
  resolveCreatedBy,
  requireAdmin,
} from '../utils/route-helpers.js';
import {
  validate,
  createRateCardSchema,
  updateRateCardSchema,
  rateCardItemSchema,
} from '../lib/validation.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery(`SELECT * FROM rate_cards ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list rate cards');
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: rcRows } = await dbQuery(`SELECT * FROM rate_cards WHERE id = $1`, [
      req.params.id,
    ]);
    const rateCard = rcRows[0];
    if (!rateCard) return sendNotFound(res, 'Rate card');

    const { rows: items } = await dbQuery(
      `SELECT * FROM rate_card_items WHERE rate_card_id = $1 ORDER BY sort_order`,
      [req.params.id],
    );

    res.json({ ...rateCard, items });
  } catch (err) {
    return sendServerError(res, err, 'Failed to get rate card');
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    const parsed = validate(createRateCardSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, hours_per_second, editing_hours_per_30s, hourly_rate, is_default } = parsed.data;
    const createdBy = resolveCreatedBy(req.user!.id);

    // If setting as default, unset other defaults
    if (is_default) {
      await dbQuery(`UPDATE rate_cards SET is_default = false WHERE is_default = true`);
    }

    const { rows } = await dbQuery(
      `INSERT INTO rate_cards (name, hours_per_second, editing_hours_per_30s, hourly_rate, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        hours_per_second,
        editing_hours_per_30s ?? 100,
        hourly_rate ?? 125,
        is_default ?? false,
        createdBy,
      ],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to create rate card');
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    const parsed = validate(updateRateCardSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, hours_per_second, editing_hours_per_30s, hourly_rate, is_default } = parsed.data;

    if (is_default) {
      await dbQuery(`UPDATE rate_cards SET is_default = false WHERE is_default = true`);
    }

    const { rows } = await dbQuery(
      `UPDATE rate_cards
       SET name = COALESCE($1, name),
           hours_per_second = COALESCE($2, hours_per_second),
           editing_hours_per_30s = COALESCE($3, editing_hours_per_30s),
           hourly_rate = COALESCE($4, hourly_rate),
           is_default = COALESCE($5, is_default),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, hours_per_second, editing_hours_per_30s, hourly_rate, is_default, req.params.id],
    );

    if (rows.length === 0) return sendNotFound(res, 'Rate card');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to update rate card');
  }
});

router.post('/:id/items', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    const parsed = validate(rateCardItemSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { shot_type, category, hours, sort_order } = parsed.data;

    const { rows } = await dbQuery(
      `INSERT INTO rate_card_items (rate_card_id, shot_type, category, hours, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, shot_type, category, hours, sort_order || 0],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to add rate card item');
  }
});

router.put('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    const parsed = validate(rateCardItemSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { shot_type, category, hours, sort_order } = parsed.data;

    const { rows } = await dbQuery(
      `UPDATE rate_card_items
       SET shot_type = $1, category = $2, hours = $3, sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND rate_card_id = $6
       RETURNING *`,
      [shot_type, category, hours, sort_order, req.params.itemId, req.params.id],
    );

    if (rows.length === 0) return sendNotFound(res, 'Rate card item');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to update rate card item');
  }
});

router.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    await dbQuery(`DELETE FROM rate_card_items WHERE id = $1 AND rate_card_id = $2`, [
      req.params.itemId,
      req.params.id,
    ]);

    res.status(204).end();
  } catch (err) {
    return sendServerError(res, err, 'Failed to delete rate card item');
  }
});

export default router;
