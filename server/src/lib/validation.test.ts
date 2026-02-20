import { describe, it, expect } from 'vitest';
import {
  createDevelopmentSchema,
  createProjectSchema,
  createQuoteSchema,
  createRateCardSchema,
  createTemplateSchema,
  createVersionSchema,
  linkProjectSchema,
  rateCardItemSchema,
  shotSchema,
  templateShotSchema,
  updateStatusSchema,
  validate,
} from './validation';

describe('validation schemas', () => {
  describe('createDevelopmentSchema', () => {
    it('requires name', () => {
      expect(validate(createDevelopmentSchema, { name: '' }).success).toBe(false);
      expect(validate(createDevelopmentSchema, { name: 'Dubai Islands E' }).success).toBe(true);
    });
  });

  describe('createProjectSchema', () => {
    it('requires development_id and name', () => {
      const valid = { development_id: crypto.randomUUID(), name: 'Masterplan Film' };
      expect(validate(createProjectSchema, valid).success).toBe(true);
    });

    it('optionally accepts kantata_id', () => {
      const valid = {
        development_id: crypto.randomUUID(),
        name: 'Film',
        kantata_id: '23046',
      };
      expect(validate(createProjectSchema, valid).success).toBe(true);
    });
  });

  describe('createQuoteSchema', () => {
    it('requires project_id, mode, rate_card_id', () => {
      const valid = {
        project_id: crypto.randomUUID(),
        mode: 'retainer',
        rate_card_id: crypto.randomUUID(),
      };
      expect(validate(createQuoteSchema, valid).success).toBe(true);
    });

    it('rejects invalid mode', () => {
      const invalid = {
        project_id: crypto.randomUUID(),
        mode: 'other',
        rate_card_id: crypto.randomUUID(),
      };
      expect(validate(createQuoteSchema, invalid).success).toBe(false);
    });
  });

  describe('updateStatusSchema', () => {
    it('accepts new status values', () => {
      const values = ['draft', 'negotiating', 'awaiting_approval', 'confirmed', 'archived'];
      for (const status of values) {
        expect(validate(updateStatusSchema, { status }).success).toBe(true);
      }
    });

    it('rejects old status values', () => {
      expect(validate(updateStatusSchema, { status: 'pending_approval' }).success).toBe(false);
      expect(validate(updateStatusSchema, { status: 'sent' }).success).toBe(false);
    });
  });

  describe('shotSchema', () => {
    it('includes percentage', () => {
      const valid = {
        shot_type: 'Aerial',
        percentage: 40,
        quantity: 6,
        base_hours_each: 60,
        efficiency_multiplier: 1,
      };
      expect(validate(shotSchema, valid).success).toBe(true);
    });
  });

  describe('createVersionSchema', () => {
    it('accepts pool_budget_amount and hourly_rate', () => {
      const valid = {
        duration_seconds: 60,
        hourly_rate: 125,
        pool_budget_amount: 10000,
        shots: [],
      };
      expect(validate(createVersionSchema, valid).success).toBe(true);
    });
  });

  describe('templateShotSchema', () => {
    it('uses percentage not quantity', () => {
      const valid = { shot_type: 'Aerial', percentage: 40, efficiency_multiplier: 1 };
      expect(validate(templateShotSchema, valid).success).toBe(true);
    });
  });

  describe('linkProjectSchema', () => {
    it('requires kantata_id string', () => {
      expect(validate(linkProjectSchema, { kantata_id: '23046' }).success).toBe(true);
      expect(validate(linkProjectSchema, { kantata_id: '' }).success).toBe(false);
    });
  });

  describe('legacy schemas still valid where expected', () => {
    it('supports rate card payloads', () => {
      expect(
        validate(createRateCardSchema, {
          name: 'DHRE 2025',
          hours_per_second: 17.33,
          editing_hours_per_30s: 100,
          hourly_rate: 125,
          is_default: true,
        }).success,
      ).toBe(true);
    });

    it('supports rate card items', () => {
      expect(
        validate(rateCardItemSchema, {
          shot_type: 'Wide Shot',
          category: 'scene',
          hours: 12,
          sort_order: 0,
        }).success,
      ).toBe(true);
    });

    it('supports templates', () => {
      expect(
        validate(createTemplateSchema, {
          name: 'Masterplan Film',
          duration_seconds: 60,
          shots: [{ shot_type: 'Aerial', percentage: 40, efficiency_multiplier: 1 }],
        }).success,
      ).toBe(true);
    });
  });
});
