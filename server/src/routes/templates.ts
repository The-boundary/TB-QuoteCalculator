import { Router, type Request, type Response } from 'express';
import { dbQuery, dbTransaction } from '../services/supabase.js';
import { sendServerError, sendNotFound, httpError, type HttpError } from '../utils/route-helpers.js';
import { validate, createTemplateSchema, updateTemplateSchema } from '../lib/validation.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/templates -- list all templates with shots
// ---------------------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows: templates } = await dbQuery(
      `SELECT * FROM film_templates ORDER BY duration_seconds ASC`,
    );

    if (templates.length === 0) return res.json([]);

    // Batch fetch all shots
    const templateIds = templates.map((t: { id: string }) => t.id);
    const { rows: allShots } = await dbQuery(
      `SELECT * FROM film_template_shots WHERE template_id = ANY($1) ORDER BY sort_order ASC`,
      [templateIds],
    );

    const shotsByTemplate = new Map<string, typeof allShots>();
    for (const s of allShots) {
      const existing = shotsByTemplate.get(s.template_id);
      if (existing) existing.push(s);
      else shotsByTemplate.set(s.template_id, [s]);
    }

    const enriched = templates.map((t: { id: string }) => ({
      ...t,
      shots: shotsByTemplate.get(t.id) || [],
    }));

    res.json(enriched);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list templates');
  }
});

// ---------------------------------------------------------------------------
// GET /api/templates/:id -- get template with shots
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST /api/templates -- create template (admin only)
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const parsed = validate(createTemplateSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, duration_seconds, description, rate_card_id, shots } = parsed.data;

    const result = await dbTransaction(async (client) => {
      const { rows: tRows } = await client.query(
        `INSERT INTO film_templates (name, duration_seconds, description, rate_card_id, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, duration_seconds, description || null, rate_card_id || null, req.user!.id],
      );
      const template = tRows[0];

      const createdShots = [];
      if (shots && shots.length > 0) {
        for (let idx = 0; idx < shots.length; idx++) {
          const s = shots[idx];
          const { rows } = await client.query(
            `INSERT INTO film_template_shots (template_id, shot_type, quantity, efficiency_multiplier, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [template.id, s.shot_type, s.quantity, s.efficiency_multiplier, s.sort_order ?? idx],
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

// ---------------------------------------------------------------------------
// PUT /api/templates/:id -- update template with shots (admin only)
// ---------------------------------------------------------------------------
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const parsed = validate(updateTemplateSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, duration_seconds, description, rate_card_id, shots } = parsed.data;

    const result = await dbTransaction(async (client) => {
      // Build dynamic SET clause for optional fields
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (name !== undefined) {
        setClauses.push(`name = $${paramIdx}`);
        params.push(name);
        paramIdx++;
      }
      if (duration_seconds !== undefined) {
        setClauses.push(`duration_seconds = $${paramIdx}`);
        params.push(duration_seconds);
        paramIdx++;
      }
      if (description !== undefined) {
        setClauses.push(`description = $${paramIdx}`);
        params.push(description);
        paramIdx++;
      }
      if (rate_card_id !== undefined) {
        setClauses.push(`rate_card_id = $${paramIdx}`);
        params.push(rate_card_id);
        paramIdx++;
      }

      params.push(req.params.id);
      const { rows: tRows } = await client.query(
        `UPDATE film_templates SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params,
      );
      const template = tRows[0];
      if (!template) throw httpError('Template not found', 404);

      // Replace shots if provided
      let updatedShots: unknown[] = [];
      if (shots !== undefined) {
        await client.query(
          `DELETE FROM film_template_shots WHERE template_id = $1`,
          [req.params.id],
        );

        if (shots.length > 0) {
          for (let idx = 0; idx < shots.length; idx++) {
            const s = shots[idx];
            const { rows } = await client.query(
              `INSERT INTO film_template_shots (template_id, shot_type, quantity, efficiency_multiplier, sort_order)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [req.params.id, s.shot_type, s.quantity, s.efficiency_multiplier, s.sort_order ?? idx],
            );
            updatedShots.push(rows[0]);
          }
        }
      } else {
        // Return existing shots
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
    const httpErr = err as HttpError;
    if (httpErr.statusCode === 404) {
      return res.status(404).json({ error: { message: httpErr.message } });
    }
    return sendServerError(res, err, 'Failed to update template');
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/templates/:id -- delete template (admin only)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

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
