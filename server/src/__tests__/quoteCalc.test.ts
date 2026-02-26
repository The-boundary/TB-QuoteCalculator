import { describe, it, expect } from 'vitest';
import { validate, createVersionSchema } from '../lib/validation.js';
import { mapShots } from '../routes/quotes.js';

describe('validation: quantity=0 shots', () => {
  it('accepts shots with quantity=0 (newly added shots before distribution)', () => {
    const result = validate(createVersionSchema, {
      duration_seconds: 60,
      shots: [
        {
          shot_type: 'Aerial',
          percentage: 0,
          quantity: 0,
          base_hours_each: 24,
          efficiency_multiplier: 1,
          sort_order: 0,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('mapShots: quantity=0 preservation', () => {
  it('preserves quantity=0 instead of coercing to 1', () => {
    const mapped = mapShots([
      { shot_type: 'Aerial', percentage: 50, quantity: 0, base_hours_each: 24, efficiency_multiplier: 1, sort_order: 0 },
    ]);
    expect(mapped[0].quantity).toBe(0);
    expect(mapped[0].adjusted_hours).toBe(0);
  });

  it('defaults undefined quantity to 0 (not 1)', () => {
    const mapped = mapShots([
      { shot_type: 'Aerial', percentage: 50, base_hours_each: 24, efficiency_multiplier: 1, sort_order: 0 } as any,
    ]);
    expect(mapped[0].quantity).toBe(0);
    expect(mapped[0].adjusted_hours).toBe(0);
  });
});
