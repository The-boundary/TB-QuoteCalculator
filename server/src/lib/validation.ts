import { z } from 'zod';

export const createQuoteSchema = z.object({
  client_name: z.string().min(1).max(200),
  project_name: z.string().min(1).max(200),
  rate_card_id: z.string().uuid(),
});

export const updateQuoteSchema = z.object({
  client_name: z.string().min(1).max(200).optional(),
  project_name: z.string().min(1).max(200).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'sent', 'archived']),
});

const shotSchema = z.object({
  shot_type: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(9999),
  base_hours_each: z.number().min(0),
  efficiency_multiplier: z.number().min(0.1).max(5.0),
  sort_order: z.number().int().min(0).optional(),
});

export const createVersionSchema = z.object({
  duration_seconds: z.number().int().min(1).max(600),
  notes: z.string().max(2000).nullable().optional(),
  shots: z.array(shotSchema).max(100).optional(),
});

export const updateVersionSchema = z.object({
  duration_seconds: z.number().int().min(1).max(600).optional(),
  notes: z.string().max(2000).nullable().optional(),
  shots: z.array(shotSchema).max(100).optional(),
});

export const createRateCardSchema = z.object({
  name: z.string().min(1).max(200),
  hours_per_second: z.number().min(0),
  editing_hours_per_30s: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
});

export const updateRateCardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  hours_per_second: z.number().min(0).optional(),
  editing_hours_per_30s: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
});

export const rateCardItemSchema = z.object({
  shot_type: z.string().min(1).max(200),
  category: z.enum(['scene', 'animation', 'post', 'material']),
  hours: z.number().min(0),
  sort_order: z.number().int().min(0).optional(),
});

// ── Film Templates ─────────────────────────────────────────

const templateShotSchema = z.object({
  shot_type: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(9999),
  efficiency_multiplier: z.number().min(0.1).max(5.0),
  sort_order: z.number().int().min(0).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  duration_seconds: z.number().int().min(1).max(600),
  description: z.string().max(2000).nullable().optional(),
  rate_card_id: z.string().uuid().nullable().optional(),
  shots: z.array(templateShotSchema).max(100).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  duration_seconds: z.number().int().min(1).max(600).optional(),
  description: z.string().max(2000).nullable().optional(),
  rate_card_id: z.string().uuid().nullable().optional(),
  shots: z.array(templateShotSchema).max(100).optional(),
});

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { success: false, error: messages };
  }
  return { success: true, data: result.data };
}
