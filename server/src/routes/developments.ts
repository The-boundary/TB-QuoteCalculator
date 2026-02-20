import { Router, type Request, type Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import {
  createDevelopmentSchema,
  updateDevelopmentSchema,
  validate,
} from '../lib/validation.js';
import { sendNotFound, sendServerError } from '../utils/route-helpers.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery(
      `SELECT d.*, COUNT(p.id)::int AS project_count
       FROM developments d
       LEFT JOIN projects p ON p.development_id = d.id
       GROUP BY d.id
       ORDER BY d.updated_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list developments');
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await dbQuery('SELECT * FROM developments WHERE id = $1', [req.params.id]);
    if (!rows[0]) return sendNotFound(res, 'Development');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to get development');
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createDevelopmentSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const { name, client_name, description } = parsed.data;
    const { rows } = await dbQuery(
      `INSERT INTO developments (name, client_name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, client_name ?? null, description ?? null, req.user!.id],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to create development');
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const parsed = validate(updateDevelopmentSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        sets.push(`${key} = $${idx}`);
        params.push(value);
        idx += 1;
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    sets.push('updated_at = NOW()');
    params.push(req.params.id);

    const { rows } = await dbQuery(
      `UPDATE developments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (!rows[0]) return sendNotFound(res, 'Development');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to update development');
  }
});

export default router;
