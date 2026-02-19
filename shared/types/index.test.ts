import { describe, it, expect } from 'vitest';
import type { RateCard, VersionShot, QuoteStatus } from './index';

describe('shared types', () => {
  it('QuoteStatus allows valid statuses', () => {
    const statuses: QuoteStatus[] = ['draft', 'pending_approval', 'approved', 'sent', 'archived'];
    expect(statuses).toHaveLength(5);
  });

  it('RateCard shape is valid', () => {
    const card: RateCard = {
      id: '1',
      name: 'DHRE 2025',
      is_default: true,
      hours_per_second: 17.33,
      editing_hours_per_30s: 8,
      created_by: 'user-1',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    };
    expect(card.hours_per_second).toBe(17.33);
  });

  it('VersionShot adjusted_hours matches formula', () => {
    const shot: VersionShot = {
      id: '1',
      version_id: 'v1',
      shot_type: 'aerial',
      quantity: 3,
      base_hours_each: 10,
      efficiency_multiplier: 1.2,
      adjusted_hours: 36,
      sort_order: 0,
    };
    const computed = shot.quantity * shot.base_hours_each * shot.efficiency_multiplier;
    expect(computed).toBe(shot.adjusted_hours);
  });
});
