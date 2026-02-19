import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../services/supabase.js';
import { logger } from '../utils/logger.js';
import { validate, createTemplateSchema, updateTemplateSchema } from '../lib/validation.js';

const router = Router();

// GET /api/templates — list all templates with shots
router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data: templates, error } = await supabase
      .from('film_templates')
      .select('*')
      .order('duration_seconds', { ascending: true });

    if (error) throw error;
    if (!templates || templates.length === 0) return res.json([]);

    // Batch fetch all shots
    const templateIds = templates.map((t: any) => t.id);
    const { data: allShots } = await supabase
      .from('film_template_shots')
      .select('*')
      .in('template_id', templateIds)
      .order('sort_order', { ascending: true });

    const shotsByTemplate = new Map<string, any[]>();
    for (const s of allShots || []) {
      const existing = shotsByTemplate.get(s.template_id);
      if (existing) existing.push(s);
      else shotsByTemplate.set(s.template_id, [s]);
    }

    const enriched = templates.map((t: any) => ({
      ...t,
      shots: shotsByTemplate.get(t.id) || [],
    }));

    res.json(enriched);
  } catch (err) {
    logger.error('Failed to list templates:', err);
    res.status(500).json({ error: { message: 'Failed to list templates' } });
  }
});

// GET /api/templates/:id — get template with shots
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data: template, error } = await supabase
      .from('film_templates')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!template) return res.status(404).json({ error: { message: 'Template not found' } });

    const { data: shots } = await supabase
      .from('film_template_shots')
      .select('*')
      .eq('template_id', req.params.id)
      .order('sort_order');

    res.json({ ...template, shots: shots || [] });
  } catch (err) {
    logger.error('Failed to get template:', err);
    res.status(500).json({ error: { message: 'Failed to get template' } });
  }
});

// POST /api/templates — create template (admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(createTemplateSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, duration_seconds, description, rate_card_id, shots } = parsed.data;

    const { data: template, error } = await supabase
      .from('film_templates')
      .insert({
        name,
        duration_seconds,
        description: description || null,
        rate_card_id: rate_card_id || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    let createdShots: any[] = [];
    if (shots && shots.length > 0) {
      const shotRows = shots.map((s, idx) => ({
        template_id: template.id,
        shot_type: s.shot_type,
        quantity: s.quantity,
        efficiency_multiplier: s.efficiency_multiplier,
        sort_order: s.sort_order ?? idx,
      }));
      const { data: insertedShots, error: sError } = await supabase
        .from('film_template_shots')
        .insert(shotRows)
        .select();
      if (sError) throw sError;
      createdShots = insertedShots || [];
    }

    res.status(201).json({ ...template, shots: createdShots });
  } catch (err) {
    logger.error('Failed to create template:', err);
    res.status(500).json({ error: { message: 'Failed to create template' } });
  }
});

// PUT /api/templates/:id — update template with shots (admin only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(updateTemplateSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { name, duration_seconds, description, rate_card_id, shots } = parsed.data;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (duration_seconds !== undefined) updateData.duration_seconds = duration_seconds;
    if (description !== undefined) updateData.description = description;
    if (rate_card_id !== undefined) updateData.rate_card_id = rate_card_id;

    const { data: template, error } = await supabase
      .from('film_templates')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Replace shots if provided
    let updatedShots: any[] = [];
    if (shots !== undefined) {
      await supabase
        .from('film_template_shots')
        .delete()
        .eq('template_id', req.params.id);

      if (shots.length > 0) {
        const shotRows = shots.map((s, idx) => ({
          template_id: req.params.id,
          shot_type: s.shot_type,
          quantity: s.quantity,
          efficiency_multiplier: s.efficiency_multiplier,
          sort_order: s.sort_order ?? idx,
        }));
        const { data: insertedShots, error: sError } = await supabase
          .from('film_template_shots')
          .insert(shotRows)
          .select();
        if (sError) throw sError;
        updatedShots = insertedShots || [];
      }
    } else {
      // Return existing shots
      const { data: existingShots } = await supabase
        .from('film_template_shots')
        .select('*')
        .eq('template_id', req.params.id)
        .order('sort_order');
      updatedShots = existingShots || [];
    }

    res.json({ ...template, shots: updatedShots });
  } catch (err) {
    logger.error('Failed to update template:', err);
    res.status(500).json({ error: { message: 'Failed to update template' } });
  }
});

// DELETE /api/templates/:id — delete template (admin only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.appAccess?.is_admin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }

    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { error } = await supabase
      .from('film_templates')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    logger.error('Failed to delete template:', err);
    res.status(500).json({ error: { message: 'Failed to delete template' } });
  }
});

export default router;
