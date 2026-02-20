import { Router, type Request, type Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import { createProjectSchema, linkProjectSchema, validate } from '../lib/validation.js';
import { sendNotFound, sendServerError, resolveCreatedBy } from '../utils/route-helpers.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const forecasted = typeof req.query.forecasted === 'string' ? req.query.forecasted : undefined;

    const params: unknown[] = [];
    const whereParts: string[] = [];
    let idx = 1;

    if (forecasted === 'true') {
      whereParts.push('p.is_forecasted = true');
    } else if (forecasted === 'false') {
      whereParts.push('p.is_forecasted = false');
    }

    if (search) {
      whereParts.push(
        `(p.name ILIKE $${idx} OR d.name ILIKE $${idx} OR p.kantata_id = $${idx + 1})`,
      );
      params.push(`%${search}%`, search);
      idx += 2;
    }

    const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const { rows } = await dbQuery(
      `SELECT p.*,
              d.name AS development_name,
              d.client_name AS development_client_name,
              COUNT(q.id)::int AS quote_count,
              (
                SELECT status
                FROM quotes
                WHERE project_id = p.id
                ORDER BY updated_at DESC
                LIMIT 1
              ) AS latest_quote_status
       FROM projects p
       JOIN developments d ON d.id = p.development_id
       LEFT JOIN quotes q ON q.project_id = p.id AND q.status != 'archived'
       ${where}
       GROUP BY p.id, d.name, d.client_name
       ORDER BY p.updated_at DESC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    return sendServerError(res, err, 'Failed to list projects');
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: projectRows } = await dbQuery(
      `SELECT p.*, d.name AS development_name, d.client_name AS development_client_name
       FROM projects p
       JOIN developments d ON d.id = p.development_id
       WHERE p.id = $1`,
      [req.params.id],
    );

    const project = projectRows[0];
    if (!project) return sendNotFound(res, 'Project');

    const { rows: quotes } = await dbQuery(
      `SELECT q.*,
              (
                SELECT json_build_object(
                  'id', v.id,
                  'version_number', v.version_number,
                  'duration_seconds', v.duration_seconds,
                  'total_hours', v.total_hours,
                  'shot_count', v.shot_count,
                  'pool_budget_hours', v.pool_budget_hours,
                  'pool_budget_amount', v.pool_budget_amount,
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
       WHERE q.project_id = $1
         AND q.status != 'archived'
       ORDER BY q.updated_at DESC`,
      [req.params.id],
    );

    res.json({ ...project, quotes });
  } catch (err) {
    return sendServerError(res, err, 'Failed to get project');
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = validate(createProjectSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const { development_id, name, kantata_id } = parsed.data;
    const isForecasted = !kantata_id;
    const createdBy = resolveCreatedBy(req.user!.id);

    const { rows } = await dbQuery(
      `INSERT INTO projects (development_id, name, kantata_id, is_forecasted, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [development_id, name, kantata_id ?? null, isForecasted, createdBy],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to create project');
  }
});

router.post('/:id/link', async (req: Request, res: Response) => {
  try {
    const parsed = validate(linkProjectSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: parsed.error } });
    }

    const { rows } = await dbQuery(
      `UPDATE projects
       SET kantata_id = $1, is_forecasted = false, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [parsed.data.kantata_id, req.params.id],
    );

    if (!rows[0]) return sendNotFound(res, 'Project');
    res.json(rows[0]);
  } catch (err) {
    return sendServerError(res, err, 'Failed to link project');
  }
});

export default router;
