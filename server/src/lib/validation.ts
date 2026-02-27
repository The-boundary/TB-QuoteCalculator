import { z } from 'zod';

// Developments
export const createDevelopmentSchema = z.object({
  name: z.string().min(1).max(200),
  client_name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const updateDevelopmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  client_name: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

// Projects
export const createProjectSchema = z.object({
  development_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  kantata_id: z.string().max(20).optional(),
});

export const linkProjectSchema = z.object({
  kantata_id: z.string().min(1).max(20),
});

// Quotes
export const createQuoteSchema = z.object({
  project_id: z.string().uuid(),
  mode: z.enum(['retainer', 'budget']),
  rate_card_id: z.string().uuid(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived']),
});

// Shots
export const shotSchema = z.object({
  shot_type: z.string().min(1).max(200),
  percentage: z.number().min(0).max(100),
  quantity: z.number().int().min(0).max(9999),
  base_hours_each: z.number().min(0),
  efficiency_multiplier: z.number().min(0.1).max(5),
  sort_order: z.number().int().min(0).optional(),
  is_companion: z.boolean().default(false),
  module_id: z.string().uuid().optional(),
  animation_override: z.enum(['regular', 'complex']).nullable().default(null),
});

// Versions
export const createVersionSchema = z.object({
  mode: z.enum(['retainer', 'budget']).optional(),
  duration_seconds: z.number().int().min(1).max(600),
  hourly_rate: z.number().min(0).optional(),
  pool_budget_hours: z.number().min(0).nullable().optional(),
  pool_budget_amount: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
  shots: z.array(shotSchema).max(100).optional(),
});

export const updateVersionSchema = z.object({
  mode: z.enum(['retainer', 'budget']).optional(),
  duration_seconds: z.number().int().min(1).max(600).optional(),
  hourly_rate: z.number().min(0).optional(),
  pool_budget_hours: z.number().min(0).nullable().optional(),
  pool_budget_amount: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
  shots: z.array(shotSchema).max(100).optional(),
});

// Rate cards
export const createRateCardSchema = z.object({
  name: z.string().min(1).max(200),
  hours_per_second: z.number().min(0),
  editing_hours_per_30s: z.number().min(0).optional(),
  hourly_rate: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
});

export const updateRateCardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  hours_per_second: z.number().min(0).optional(),
  editing_hours_per_30s: z.number().min(0).optional(),
  hourly_rate: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
});

export const rateCardItemSchema = z.object({
  shot_type: z.string().min(1).max(200),
  category: z.enum(['scene', 'animation', 'post', 'material']),
  hours: z.number().min(0),
  sort_order: z.number().int().min(0).optional(),
});

// Templates
export const templateShotSchema = z.object({
  shot_type: z.string().min(1).max(200),
  percentage: z.number().min(0).max(100),
  efficiency_multiplier: z.number().min(0.1).max(5),
  sort_order: z.number().int().min(0).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  duration_seconds: z.number().int().min(1).max(600),
  description: z.string().max(2000).optional(),
  rate_card_id: z.string().uuid().optional(),
  shots: z.array(templateShotSchema).max(50).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  duration_seconds: z.number().int().min(1).max(600).optional(),
  description: z.string().max(2000).nullable().optional(),
  rate_card_id: z.string().uuid().nullable().optional(),
  shots: z.array(templateShotSchema).max(50).optional(),
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
