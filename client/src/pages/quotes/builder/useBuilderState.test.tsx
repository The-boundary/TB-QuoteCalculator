/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QuoteVersionWithShots, RateCardWithItems } from '@shared/types';
import { useBuilderState } from './useBuilderState';

const rateCard: RateCardWithItems = {
  id: 'rate-1',
  name: 'Default',
  is_default: true,
  hours_per_second: 1,
  editing_hours_per_30s: 2,
  hourly_rate: 120,
  created_by: 'user-1',
  created_at: '2026-02-20T08:00:00.000Z',
  updated_at: '2026-02-20T08:00:00.000Z',
  items: [
    {
      id: 'item-1',
      rate_card_id: 'rate-1',
      shot_type: 'Wide',
      category: 'scene',
      hours: 3,
      sort_order: 0,
    },
    {
      id: 'item-2',
      rate_card_id: 'rate-1',
      shot_type: 'Close',
      category: 'scene',
      hours: 2,
      sort_order: 1,
    },
  ],
};

const existingVersion: QuoteVersionWithShots = {
  id: 'version-1',
  quote_id: 'quote-1',
  version_number: 1,
  duration_seconds: 60,
  shot_count: 15,
  pool_budget_hours: null,
  pool_budget_amount: null,
  total_hours: 0,
  hourly_rate: 120,
  notes: null,
  created_by: 'user-1',
  created_at: '2026-02-20T08:00:00.000Z',
  shots: [
    {
      id: 'shot-1',
      version_id: 'version-1',
      shot_type: 'Wide',
      percentage: 40,
      quantity: 6,
      base_hours_each: 3,
      efficiency_multiplier: 1,
      adjusted_hours: 18,
      sort_order: 0,
    },
    {
      id: 'shot-2',
      version_id: 'version-1',
      shot_type: 'Close',
      percentage: 60,
      quantity: 9,
      base_hours_each: 2,
      efficiency_multiplier: 1,
      adjusted_hours: 18,
      sort_order: 1,
    },
  ],
};

const existingVersionAt90s: QuoteVersionWithShots = {
  ...existingVersion,
  duration_seconds: 90,
  shot_count: 23,
  shots: existingVersion.shots.map((s) => ({ ...s })),
};

describe('applyTemplate does not override duration', () => {
  it('preserves existing duration when applying a template', () => {
    const { result } = renderHook(() =>
      useBuilderState(rateCard, existingVersionAt90s, 'retainer'),
    );
    expect(result.current.duration).toBe(90);

    act(() => {
      result.current.applyTemplate({
        id: 'tpl-1',
        name: 'Product Film',
        duration_seconds: 60,
        description: null,
        rate_card_id: null,
        created_by: null,
        created_at: '',
        updated_at: '',
        shots: [
          {
            id: '1',
            template_id: 'tpl-1',
            shot_type: 'Wide',
            percentage: 50,
            efficiency_multiplier: 1,
            sort_order: 0,
          },
          {
            id: '2',
            template_id: 'tpl-1',
            shot_type: 'Close',
            percentage: 50,
            efficiency_multiplier: 1,
            sort_order: 1,
          },
        ],
      });
    });

    expect(result.current.duration).toBe(90);
    const userShots = result.current.shots.filter((s) => !s.is_companion);
    expect(userShots.map((s) => s.shot_type)).toEqual(['Wide', 'Close']);
  });
});

describe('useBuilderState manual quantity unlock', () => {
  it('returns a manually adjusted shot back to automatic distribution', () => {
    const { result } = renderHook(() => useBuilderState(rateCard, existingVersion, 'retainer'));

    act(() => {
      result.current.updateQuantity(0, 5);
    });

    expect(result.current.shots[0].manualOverride).toBe(true);
    expect(result.current.shots[0].quantity).toBe(5);

    act(() => {
      result.current.setDuration(120);
    });

    expect(result.current.shots[0].quantity).toBe(5);

    act(() => {
      result.current.unlockManualQuantity(0);
    });

    expect(result.current.shots[0].manualOverride).toBe(false);
    expect(result.current.shots[0].quantity).toBe(10);
  });
});
