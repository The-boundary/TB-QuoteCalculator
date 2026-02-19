import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../services/supabase.js';
import { logger } from '../utils/logger.js';
import {
  validate,
  createRateCardSchema,
  updateRateCardSchema,
  rateCardItemSchema,
} from '../lib/validation.js';

const router = Router();

// GET /api/rate-cards — list all rate cards
router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data, error } = await supabase
      .from('rate_cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Failed to list rate cards:', err);
    res.status(500).json({ error: { message: 'Failed to list rate cards' } });
  }
});

// GET /api/rate-cards/:id — get rate card with items
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data: rateCard, error: rcError } = await supabase
      .from('rate_cards')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (rcError) throw rcError;
    if (!rateCard) return res.status(404).json({ error: { message: 'Rate card not found' } });

    const { data: items, error: itemsError } = await supabase
      .from('rate_card_items')
      .select('*')
      .eq('rate_card_id', req.params.id)
      .order('sort_order');

    if (itemsError) throw itemsError;

    res.json({ ...rateCard, items: items || [] });
  } catch (err) {
    logger.error('Failed to get rate card:', err);
    res.status(500).json({ error: { message: 'Failed to get rate card' } });
  }
});

// POST /api/rate-cards — create rate card (admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(createRateCardSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, hours_per_second, editing_hours_per_30s, is_default } = parsed.data;

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase.from('rate_cards').update({ is_default: false }).eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('rate_cards')
      .insert({
        name,
        hours_per_second,
        editing_hours_per_30s: editing_hours_per_30s || 100,
        is_default: is_default || false,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    logger.error('Failed to create rate card:', err);
    res.status(500).json({ error: { message: 'Failed to create rate card' } });
  }
});

// PUT /api/rate-cards/:id — update rate card (admin only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(updateRateCardSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, hours_per_second, editing_hours_per_30s, is_default } = parsed.data;

    if (is_default) {
      await supabase.from('rate_cards').update({ is_default: false }).eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('rate_cards')
      .update({
        name,
        hours_per_second,
        editing_hours_per_30s,
        is_default,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Failed to update rate card:', err);
    res.status(500).json({ error: { message: 'Failed to update rate card' } });
  }
});

// POST /api/rate-cards/:id/items — add item (admin only)
router.post('/:id/items', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(rateCardItemSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { shot_type, category, hours, sort_order } = parsed.data;

    const { data, error } = await supabase
      .from('rate_card_items')
      .insert({
        rate_card_id: req.params.id,
        shot_type,
        category,
        hours,
        sort_order: sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    logger.error('Failed to add rate card item:', err);
    res.status(500).json({ error: { message: 'Failed to add rate card item' } });
  }
});

// PUT /api/rate-cards/:id/items/:itemId — update item (admin only)
router.put('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(rateCardItemSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { shot_type, category, hours, sort_order } = parsed.data;

    const { data, error } = await supabase
      .from('rate_card_items')
      .update({ shot_type, category, hours, sort_order })
      .eq('id', req.params.itemId)
      .eq('rate_card_id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Failed to update rate card item:', err);
    res.status(500).json({ error: { message: 'Failed to update rate card item' } });
  }
});

// DELETE /api/rate-cards/:id/items/:itemId — remove item (admin only)
router.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { error } = await supabase
      .from('rate_card_items')
      .delete()
      .eq('id', req.params.itemId)
      .eq('rate_card_id', req.params.id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    logger.error('Failed to delete rate card item:', err);
    res.status(500).json({ error: { message: 'Failed to delete rate card item' } });
  }
});

export default router;
