import { Router, type Request, type Response } from 'express';
import { dbQuery, dbTransaction } from '../services/supabase.js';
import {
  sendServerError, sendNotFound, httpError, handleRouteError,
  resolveCreatedBy, requireAdmin, groupByKey,
} from '../utils/route-helpers.js';
import { validate, createTemplateSchema, updateTemplateSchema } from '../lib/validation.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows: templates } = await dbQuery(
      `SELECT * FROM film_templates ORDER BY duration_seconds ASC`,
    );

    if (templates.length === 0) return res.json([]);

    const templateIds = templates.map((t: { id: string }) => t.id);
    const { rows: allShots } = await dbQuery(
      `SELECT * FROM film_template_shots WHERE template_id = ANY($1) ORDER BY sort_order ASC`,
      [templateIds],
    );

    const shotsByTemplate = groupByKey(allShots, 'template_id');
    const enriched = templates.map((t: { id: string }) => ({
      ...t,
      shots: shotsByTemplate.get(t.id) || [],
    }));

    res.json(enriched);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list templates');
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: tRows } = await dbQuery(
      `SELECT * FROM film_templates WHERE id = $1`,
      [req.params.id],
    );
    const template = tRows[0];
    if (!template) return sendNotFound(res, 'Template');

    const { rows: shots } = await dbQuery(
      `SELECT * FROM film_template_shots WHERE template_id = $1 ORDER BY sort_order`,
      [req.params.id],
    );

    res.json({ ...template, shots });
  } catch (err) {
    return sendServerError(res, err, 'Failed to get template');
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    const parsed = validate(createTemplateSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, duration_seconds, description, rate_card_id, shots } = parsed.data;
    const createdBy = resolveCreatedBy(req.user!.id);

    const result = await dbTransaction(async (client) => {
      const { rows: tRows } = await client.query(
        `INSERT INTO film_templates (name, duration_seconds, description, rate_card_id, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, duration_seconds, description || null, rate_card_id || null, createdBy],
      );
      const template = tRows[0];

      const createdShots = [];
      if (shots && shots.length > 0) {
        for (let idx = 0; idx < shots.length; idx++) {
          const s = shots[idx];
          const { rows } = await client.query(
            `INSERT INTO film_template_shots (template_id, shot_type, percentage, efficiency_multiplier, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [template.id, s.shot_type, s.percentage, s.efficiency_multiplier, s.sort_order ?? idx],
          );
          createdShots.push(rows[0]);
        }
      }

      return { ...template, shots: createdShots };
    });

    res.status(201).json(result);
  } catch (err) {
    return sendServerError(res, err, 'Failed to create template');
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    const parsed = validate(updateTemplateSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, duration_seconds, description, rate_card_id, shots } = parsed.data;

    const result = await dbTransaction(async (client) => {
      const { rows: tRows } = await client.query(
        `UPDATE film_templates
         SET name = COALESCE($1, name),
             duration_seconds = COALESCE($2, duration_seconds),
             description = COALESCE($3, description),
             rate_card_id = COALESCE($4, rate_card_id),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [name, duration_seconds, description, rate_card_id, req.params.id],
      );
      const template = tRows[0];
      if (!template) throw httpError('Template not found', 404);

      let updatedShots: unknown[] = [];
      if (shots !== undefined) {
        await client.query(
          `DELETE FROM film_template_shots WHERE template_id = $1`,
          [req.params.id],
        );

        for (let idx = 0; idx < shots.length; idx++) {
          const s = shots[idx];
          const { rows } = await client.query(
            `INSERT INTO film_template_shots (template_id, shot_type, percentage, efficiency_multiplier, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [req.params.id, s.shot_type, s.percentage, s.efficiency_multiplier, s.sort_order ?? idx],
          );
          updatedShots.push(rows[0]);
        }
      } else {
        const { rows: existingShots } = await client.query(
          `SELECT * FROM film_template_shots WHERE template_id = $1 ORDER BY sort_order`,
          [req.params.id],
        );
        updatedShots = existingShots;
      }

      return { ...template, shots: updatedShots };
    });

    res.json(result);
  } catch (err) {
    return handleRouteError(res, err, 'Failed to update template');
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (requireAdmin(req, res)) return;

    await dbQuery(
      `DELETE FROM film_templates WHERE id = $1`,
      [req.params.id],
    );

    res.status(204).end();
  } catch (err) {
    return sendServerError(res, err, 'Failed to delete template');
  }
});

export default router;
