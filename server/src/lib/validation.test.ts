import { describe, it, expect } from 'vitest';
import {
  validate,
  createQuoteSchema,
  updateStatusSchema,
  createVersionSchema,
  createRateCardSchema,
  rateCardItemSchema,
  createTemplateSchema,
} from './validation';

describe('validation schemas', () => {
  describe('createQuoteSchema', () => {
    it('accepts valid payload', () => {
      const result = validate(createQuoteSchema, {
        client_name: 'Acme Corp',
        project_name: 'Product Launch',
        rate_card_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing client_name', () => {
      const result = validate(createQuoteSchema, {
        project_name: 'X',
        rate_card_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty client_name', () => {
      const result = validate(createQuoteSchema, {
        client_name: '',
        project_name: 'X',
        rate_card_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-uuid rate_card_id', () => {
      const result = validate(createQuoteSchema, {
        client_name: 'Acme',
        project_name: 'X',
        rate_card_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStatusSchema', () => {
    it.each(['draft', 'pending_approval', 'approved', 'sent', 'archived'] as const)(
      'accepts valid status: %s',
      (status) => {
        const result = validate(updateStatusSchema, { status });
        expect(result.success).toBe(true);
      },
    );

    it('rejects invalid status', () => {
      const result = validate(updateStatusSchema, { status: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('createVersionSchema', () => {
    it('accepts valid version with shots', () => {
      const result = validate(createVersionSchema, {
        duration_seconds: 60,
        notes: 'Test version',
        shots: [
          {
            shot_type: 'Wide Shot',
            quantity: 3,
            base_hours_each: 10,
            efficiency_multiplier: 1.0,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts version without shots', () => {
      const result = validate(createVersionSchema, {
        duration_seconds: 30,
      });
      expect(result.success).toBe(true);
    });

    it('rejects duration over 600', () => {
      const result = validate(createVersionSchema, {
        duration_seconds: 601,
      });
      expect(result.success).toBe(false);
    });

    it('rejects duration of 0', () => {
      const result = validate(createVersionSchema, {
        duration_seconds: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects efficiency_multiplier below 0.1', () => {
      const result = validate(createVersionSchema, {
        duration_seconds: 60,
        shots: [
          {
            shot_type: 'Wide Shot',
            quantity: 1,
            base_hours_each: 10,
            efficiency_multiplier: 0.05,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects efficiency_multiplier above 5.0', () => {
      const result = validate(createVersionSchema, {
        duration_seconds: 60,
        shots: [
          {
            shot_type: 'Wide Shot',
            quantity: 1,
            base_hours_each: 10,
            efficiency_multiplier: 5.1,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 100 shots', () => {
      const shots = Array.from({ length: 101 }, (_, i) => ({
        shot_type: `Shot ${i}`,
        quantity: 1,
        base_hours_each: 1,
        efficiency_multiplier: 1.0,
      }));
      const result = validate(createVersionSchema, {
        duration_seconds: 60,
        shots,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createRateCardSchema', () => {
    it('accepts valid rate card', () => {
      const result = validate(createRateCardSchema, {
        name: 'DHRE 2025',
        hours_per_second: 17.33,
        editing_hours_per_30s: 100,
        is_default: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts without optional fields', () => {
      const result = validate(createRateCardSchema, {
        name: 'Basic',
        hours_per_second: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = validate(createRateCardSchema, {
        name: '',
        hours_per_second: 10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative hours_per_second', () => {
      const result = validate(createRateCardSchema, {
        name: 'Bad',
        hours_per_second: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rateCardItemSchema', () => {
    it('accepts valid item', () => {
      const result = validate(rateCardItemSchema, {
        shot_type: 'Wide Shot',
        category: 'scene',
        hours: 12,
        sort_order: 0,
      });
      expect(result.success).toBe(true);
    });

    it.each(['scene', 'animation', 'post', 'material'] as const)(
      'accepts category: %s',
      (category) => {
        const result = validate(rateCardItemSchema, {
          shot_type: 'Test',
          category,
          hours: 1,
        });
        expect(result.success).toBe(true);
      },
    );

    it('rejects invalid category', () => {
      const result = validate(rateCardItemSchema, {
        shot_type: 'Test',
        category: 'invalid',
        hours: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createTemplateSchema', () => {
    it('accepts valid template with shots', () => {
      const result = validate(createTemplateSchema, {
        name: 'Standard 30s',
        duration_seconds: 30,
        description: 'A standard 30-second template',
        shots: [{ shot_type: 'Wide Shot', quantity: 2, efficiency_multiplier: 1.0 }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts without optional fields', () => {
      const result = validate(createTemplateSchema, {
        name: 'Minimal',
        duration_seconds: 15,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('validate helper', () => {
    it('returns formatted error messages on failure', () => {
      const result = validate(createQuoteSchema, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('client_name');
        expect(result.error).toContain('project_name');
        expect(result.error).toContain('rate_card_id');
      }
    });
  });
});
