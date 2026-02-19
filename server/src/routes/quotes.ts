import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../services/supabase.js';
import { logger } from '../utils/logger.js';
import {
  validate,
  createQuoteSchema,
  updateQuoteSchema,
  updateStatusSchema,
  createVersionSchema,
  updateVersionSchema,
} from '../lib/validation.js';

const router = Router();

// GET /api/quotes — list all quotes with latest version summary
router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('*')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (!quotes || quotes.length === 0) return res.json([]);

    // Batch fetch all versions for these quotes (single query instead of N+1)
    const quoteIds = quotes.map((q: any) => q.id);
    const { data: allVersions } = await supabase
      .from('quote_versions')
      .select('id, quote_id, version_number, duration_seconds, pool_budget_hours, total_hours, created_at')
      .in('quote_id', quoteIds)
      .order('version_number', { ascending: false });

    // Group versions by quote_id
    const versionsByQuote = new Map<string, any[]>();
    for (const v of allVersions || []) {
      const existing = versionsByQuote.get(v.quote_id);
      if (existing) existing.push(v);
      else versionsByQuote.set(v.quote_id, [v]);
    }

    const enriched = quotes.map((quote: any) => {
      const versions = versionsByQuote.get(quote.id) || [];
      return {
        ...quote,
        latest_version: versions[0] || null, // Already sorted desc by version_number
        version_count: versions.length,
      };
    });

    res.json(enriched);
  } catch (err) {
    logger.error('Failed to list quotes:', err);
    res.status(500).json({ error: { message: 'Failed to list quotes' } });
  }
});

// GET /api/quotes/:id — get quote with all versions and shots
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data: quote, error: qError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (qError) throw qError;
    if (!quote) return res.status(404).json({ error: { message: 'Quote not found' } });

    // Get rate card
    const { data: rateCard } = await supabase
      .from('rate_cards')
      .select('*')
      .eq('id', quote.rate_card_id)
      .single();

    // Get all versions
    const { data: versions, error: vError } = await supabase
      .from('quote_versions')
      .select('*')
      .eq('quote_id', req.params.id)
      .order('version_number', { ascending: true });

    if (vError) throw vError;

    // Get shots for each version
    const versionsWithShots = await Promise.all(
      (versions || []).map(async (version: any) => {
        const { data: shots } = await supabase
          .from('version_shots')
          .select('*')
          .eq('version_id', version.id)
          .order('sort_order');

        return { ...version, shots: shots || [] };
      })
    );

    res.json({ ...quote, rate_card: rateCard, versions: versionsWithShots });
  } catch (err) {
    logger.error('Failed to get quote:', err);
    res.status(500).json({ error: { message: 'Failed to get quote' } });
  }
});

// POST /api/quotes — create quote with empty v1
router.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(createQuoteSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { client_name, project_name, rate_card_id } = parsed.data;

    // Get rate card for pool calculation
    const { data: rateCard, error: rcError } = await supabase
      .from('rate_cards')
      .select('hours_per_second, editing_hours_per_30s')
      .eq('id', rate_card_id)
      .single();

    if (rcError || !rateCard) {
      return res.status(400).json({ error: { message: 'Invalid rate card' } });
    }

    // Create quote
    const { data: quote, error: qError } = await supabase
      .from('quotes')
      .insert({
        client_name,
        project_name,
        rate_card_id,
        status: 'draft',
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (qError) throw qError;

    // Create empty version 1 with default 60s duration
    const defaultDuration = 60;
    const poolBudget = defaultDuration * rateCard.hours_per_second;
    const editingHours = Math.ceil(defaultDuration / 30) * rateCard.editing_hours_per_30s;

    const { data: version, error: vError } = await supabase
      .from('quote_versions')
      .insert({
        quote_id: quote.id,
        version_number: 1,
        duration_seconds: defaultDuration,
        pool_budget_hours: poolBudget,
        total_hours: editingHours, // Just editing hours for empty version
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (vError) throw vError;

    res.status(201).json({ ...quote, versions: [{ ...version, shots: [] }] });
  } catch (err) {
    logger.error('Failed to create quote:', err);
    res.status(500).json({ error: { message: 'Failed to create quote' } });
  }
});

// PUT /api/quotes/:id — update quote metadata
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(updateQuoteSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { client_name, project_name } = parsed.data;

    const { data, error } = await supabase
      .from('quotes')
      .update({ client_name, project_name, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Failed to update quote:', err);
    res.status(500).json({ error: { message: 'Failed to update quote' } });
  }
});

// PUT /api/quotes/:id/status — update status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(updateStatusSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { status } = parsed.data;

    // Approval requires Approver or Admin role
    if (status === 'approved' && !req.user?.appAccess?.is_admin) {
      const role = req.user?.appAccess?.role_slug;
      if (role !== 'approver' && role !== 'admin') {
        return res.status(403).json({ error: { message: 'Only approvers or admins can approve quotes' } });
      }
    }

    const { data, error } = await supabase
      .from('quotes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Failed to update quote status:', err);
    res.status(500).json({ error: { message: 'Failed to update quote status' } });
  }
});

// DELETE /api/quotes/:id — archive quote (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Failed to archive quote:', err);
    res.status(500).json({ error: { message: 'Failed to archive quote' } });
  }
});

// POST /api/quotes/:id/versions — create new version
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(createVersionSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { duration_seconds, notes, shots } = parsed.data;

    // Get quote and rate card
    const { data: quote, error: qError } = await supabase
      .from('quotes')
      .select('rate_card_id')
      .eq('id', req.params.id)
      .single();

    if (qError || !quote) return res.status(404).json({ error: { message: 'Quote not found' } });

    const { data: rateCard } = await supabase
      .from('rate_cards')
      .select('hours_per_second, editing_hours_per_30s')
      .eq('id', quote.rate_card_id)
      .single();

    if (!rateCard) return res.status(400).json({ error: { message: 'Rate card not found' } });

    // Get next version number
    const { data: existingVersions } = await supabase
      .from('quote_versions')
      .select('version_number')
      .eq('quote_id', req.params.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version_number || 0) + 1;

    // Calculate budget
    const poolBudget = duration_seconds * rateCard.hours_per_second;
    const editingHours = Math.ceil(duration_seconds / 30) * rateCard.editing_hours_per_30s;

    // Calculate total shot hours
    const shotRows = (shots || []).map((shot: any, idx: number) => ({
      shot_type: shot.shot_type,
      quantity: shot.quantity || 1,
      base_hours_each: shot.base_hours_each,
      efficiency_multiplier: shot.efficiency_multiplier || 1.0,
      adjusted_hours: (shot.base_hours_each || 0) * (shot.quantity || 1) * (shot.efficiency_multiplier || 1.0),
      sort_order: shot.sort_order ?? idx,
    }));

    const totalShotHours = shotRows.reduce((sum: number, s: any) => sum + s.adjusted_hours, 0);
    const totalHours = totalShotHours + editingHours;

    // Create version
    const { data: version, error: vError } = await supabase
      .from('quote_versions')
      .insert({
        quote_id: req.params.id,
        version_number: nextVersion,
        duration_seconds,
        pool_budget_hours: poolBudget,
        total_hours: totalHours,
        notes: notes || null,
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (vError) throw vError;

    // Create shots
    let createdShots: any[] = [];
    if (shotRows.length > 0) {
      const shotsWithVersion = shotRows.map((s: any) => ({ ...s, version_id: version.id }));
      const { data: insertedShots, error: sError } = await supabase
        .from('version_shots')
        .insert(shotsWithVersion)
        .select();

      if (sError) throw sError;
      createdShots = insertedShots || [];
    }

    // Update quote updated_at
    await supabase
      .from('quotes')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json({ ...version, shots: createdShots });
  } catch (err) {
    logger.error('Failed to create version:', err);
    res.status(500).json({ error: { message: 'Failed to create version' } });
  }
});

// PUT /api/quotes/:id/versions/:versionId — update version shots
router.put('/:id/versions/:versionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return res.status(503).json({ error: { message: 'Database not configured' } });

    const parsed = validate(updateVersionSchema, req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error } });
    const { duration_seconds, shots, notes } = parsed.data;

    // Get rate card for calculations
    const { data: quote } = await supabase
      .from('quotes')
      .select('rate_card_id')
      .eq('id', req.params.id)
      .single();

    if (!quote) return res.status(404).json({ error: { message: 'Quote not found' } });

    const { data: rateCard } = await supabase
      .from('rate_cards')
      .select('hours_per_second, editing_hours_per_30s')
      .eq('id', quote.rate_card_id)
      .single();

    if (!rateCard) return res.status(400).json({ error: { message: 'Rate card not found' } });

    const dur = duration_seconds || 60;
    const poolBudget = dur * rateCard.hours_per_second;
    const editingHours = Math.ceil(dur / 30) * rateCard.editing_hours_per_30s;

    // Recalculate shots
    const shotRows = (shots || []).map((shot: any, idx: number) => ({
      version_id: req.params.versionId,
      shot_type: shot.shot_type,
      quantity: shot.quantity || 1,
      base_hours_each: shot.base_hours_each,
      efficiency_multiplier: shot.efficiency_multiplier || 1.0,
      adjusted_hours: (shot.base_hours_each || 0) * (shot.quantity || 1) * (shot.efficiency_multiplier || 1.0),
      sort_order: shot.sort_order ?? idx,
    }));

    const totalShotHours = shotRows.reduce((sum: number, s: any) => sum + s.adjusted_hours, 0);
    const totalHours = totalShotHours + editingHours;

    // Delete existing shots
    await supabase
      .from('version_shots')
      .delete()
      .eq('version_id', req.params.versionId);

    // Insert new shots
    let createdShots: any[] = [];
    if (shotRows.length > 0) {
      const { data: insertedShots, error: sError } = await supabase
        .from('version_shots')
        .insert(shotRows)
        .select();

      if (sError) throw sError;
      createdShots = insertedShots || [];
    }

    // Update version
    const updateData: any = {
      duration_seconds: dur,
      pool_budget_hours: poolBudget,
      total_hours: totalHours,
    };
    if (notes !== undefined) updateData.notes = notes;

    const { data: version, error: vError } = await supabase
      .from('quote_versions')
      .update(updateData)
      .eq('id', req.params.versionId)
      .select()
      .single();

    if (vError) throw vError;

    // Update quote updated_at
    await supabase
      .from('quotes')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.json({ ...version, shots: createdShots });
  } catch (err) {
    logger.error('Failed to update version:', err);
    res.status(500).json({ error: { message: 'Failed to update version' } });
  }
});

export default router;
