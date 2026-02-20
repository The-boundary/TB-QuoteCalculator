import { Router, type Request, type Response } from 'express';
import { dbQuery } from '../services/supabase.js';
import { sendServerError } from '../utils/route-helpers.js';

const router = Router();

router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length < 2) {
      return res
        .status(400)
        .json({ error: { message: 'Search term must be at least 2 characters' } });
    }

    const { rows } = await dbQuery(
      `SELECT kantata_id, title, status, start_date, due_date
       FROM traffic_light.kantata_workspaces
       WHERE is_current = true
         AND (title ILIKE $1 OR kantata_id = $2)
       ORDER BY kantata_id DESC
       LIMIT 20`,
      [`%${search}%`, search],
    );

    res.json(rows);
  } catch (err) {
    return sendServerError(res, err, 'Failed to search Kantata workspaces');
  }
});

export default router;
