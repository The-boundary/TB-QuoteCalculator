import { describe, it, expect } from 'vitest';
import { ANIMATION_COMPANION_TYPE } from '@shared/types';
import type { RateCardItem } from '@shared/types';
import { syncAnimationCompanion, buildCategoryMap, type BuilderShot } from '../useBuilderState';

const mockRateCardItems: RateCardItem[] = [
  { id: '1', rate_card_id: 'rc1', shot_type: 'Aerial', category: 'scene', hours: 10, sort_order: 0 },
  { id: '2', rate_card_id: 'rc1', shot_type: 'Ground', category: 'scene', hours: 8, sort_order: 1 },
  { id: '3', rate_card_id: 'rc1', shot_type: 'VFX Detail', category: 'post', hours: 12, sort_order: 2 },
  { id: '4', rate_card_id: 'rc1', shot_type: 'Animation from Image (simple)', category: 'animation', hours: 6, sort_order: 3 },
];

function makeShot(
  shotType: string,
  opts: { quantity?: number; category?: string; animation_override?: 'regular' | 'complex' | null },
): BuilderShot {
  return {
    shot_type: shotType,
    percentage: 0,
    quantity: opts.quantity ?? 1,
    base_hours_each: 0,
    efficiency_multiplier: 1,
    adjusted_hours: 0,
    sort_order: 0,
    selected: false,
    manualOverride: false,
    is_companion: false,
    animation_override: opts.animation_override ?? null,
  };
}

describe('buildCategoryMap', () => {
  it('maps shot types to categories (lowercase)', () => {
    const map = buildCategoryMap(mockRateCardItems);
    expect(map.get('aerial')).toBe('scene');
    expect(map.get('ground')).toBe('scene');
    expect(map.get('vfx detail')).toBe('post');
  });
});

describe('syncAnimationCompanion', () => {
  it('creates single companion row with qty matching total scene shots', () => {
    const shots = [
      makeShot('Aerial', { quantity: 5 }),
      makeShot('Ground', { quantity: 10 }),
      makeShot('VFX Detail', { quantity: 3 }),
    ];
    const result = syncAnimationCompanion(shots, 'regular', mockRateCardItems);
    const companion = result.find((s) => s.is_companion);
    expect(companion).toBeDefined();
    expect(companion!.shot_type).toBe(ANIMATION_COMPANION_TYPE);
    expect(companion!.quantity).toBe(15);
    expect(companion!.adjusted_hours).toBe(240); // 15 * 16
  });

  it('uses 32h for complex master', () => {
    const shots = [makeShot('Aerial', { quantity: 10 })];
    const result = syncAnimationCompanion(shots, 'complex', mockRateCardItems);
    expect(result.find((s) => s.is_companion)!.adjusted_hours).toBe(320); // 10 * 32
  });

  it('respects per-shot override (mixed regular + complex)', () => {
    const shots = [
      makeShot('Aerial', { quantity: 5, animation_override: 'complex' }),
      makeShot('Ground', { quantity: 5, animation_override: null }),
    ];
    // Aerial: 5*32=160, Ground: 5*16=80 (inherits 'regular' master)
    const result = syncAnimationCompanion(shots, 'regular', mockRateCardItems);
    const companion = result.find((s) => s.is_companion)!;
    expect(companion.quantity).toBe(10);
    expect(companion.adjusted_hours).toBe(240); // 160+80
    expect(companion.base_hours_each).toBe(24); // weighted avg: 240/10
  });

  it('excludes animation-category items from companion qty (no double-count)', () => {
    const shots = [
      makeShot('Aerial', { quantity: 5 }),
      makeShot('Animation from Image (simple)', { quantity: 2 }),
    ];
    const result = syncAnimationCompanion(shots, 'regular', mockRateCardItems);
    expect(result.find((s) => s.is_companion)!.quantity).toBe(5);
  });

  it('rounds repeating-decimal base_hours_each and adjusted_hours to 2dp', () => {
    // 1 regular (16h) + 2 complex (32h) = 16+64 = 80h, qty=3
    // base_hours_each = 80/3 = 26.666... → rounded to 26.67
    // adjusted_hours = 26.67 * 3 = 80.01 (rounded, not raw 80)
    const shots = [
      makeShot('Aerial', { quantity: 1, animation_override: 'regular' }),
      makeShot('Ground', { quantity: 2, animation_override: 'complex' }),
    ];
    const result = syncAnimationCompanion(shots, 'regular', mockRateCardItems);
    const companion = result.find((s) => s.is_companion)!;
    expect(companion.base_hours_each).toBe(26.67);
    expect(companion.adjusted_hours).toBe(80.01);
  });

  it('strips and recomputes companion on each sync (idempotent)', () => {
    const shots: BuilderShot[] = [
      makeShot('Aerial', { quantity: 5 }),
      {
        ...makeShot(ANIMATION_COMPANION_TYPE, { quantity: 99 }),
        is_companion: true,
      },
    ];
    const result = syncAnimationCompanion(shots, 'regular', mockRateCardItems);
    const companions = result.filter((s) => s.is_companion);
    expect(companions).toHaveLength(1);
    expect(companions[0].quantity).toBe(5);
  });

  it('returns no companion when there are no scene shots', () => {
    const shots = [makeShot('VFX Detail', { quantity: 5 })];
    const result = syncAnimationCompanion(shots, 'regular', mockRateCardItems);
    expect(result.find((s) => s.is_companion)).toBeUndefined();
  });
});
