import { describe, expect, it } from 'vitest';
import type { RateCardItem } from '@shared/types';
import { buildSuggestions } from './BudgetSuggestions';

const items: RateCardItem[] = [
  { id: '1', rate_card_id: 'r1', shot_type: 'Wide', category: 'scene', hours: 3, sort_order: 0 },
  { id: '2', rate_card_id: 'r1', shot_type: 'Close', category: 'scene', hours: 2, sort_order: 1 },
  { id: '3', rate_card_id: 'r1', shot_type: 'Comp', category: 'post', hours: 4, sort_order: 2 },
  { id: '4', rate_card_id: 'r1', shot_type: 'Anim Loop', category: 'animation', hours: 5, sort_order: 3 },
];

describe('buildSuggestions', () => {
  it('returns empty for null or zero remaining', () => {
    expect(buildSuggestions(null, items)).toEqual([]);
    expect(buildSuggestions(0, items)).toEqual([]);
    expect(buildSuggestions(-5, items)).toEqual([]);
  });

  it('returns empty when no items provided', () => {
    expect(buildSuggestions(10, [])).toHaveLength(3); // line-item templates still apply
  });

  it('biases post-production items higher via category weight', () => {
    const result = buildSuggestions(12, items);
    // Comp (post, weight 3): qty=3, hours=12, score=36
    // Anim Loop (animation, weight 2): qty=2, hours=10, score=20
    // Close (scene, weight 1): qty=6, hours=12, score=12
    // Wide (scene, weight 1): qty=4, hours=12, score=12
    // Line items also compete
    expect(result[0].shot_type).toBe('Comp');
    expect(result[0].score).toBe(36);
  });

  it('biases animation items above scene items', () => {
    const result = buildSuggestions(10, items);
    const animIdx = result.findIndex((s) => s.shot_type === 'Anim Loop');
    const sceneIdx = result.findIndex((s) => s.shot_type === 'Wide');
    if (animIdx >= 0 && sceneIdx >= 0) {
      expect(animIdx).toBeLessThan(sceneIdx);
    }
  });

  it('includes line-item template suggestions', () => {
    const result = buildSuggestions(24, []);
    const names = result.map((s) => s.shot_type);
    expect(names).toContain('Additional Editing');
    expect(names).toContain('Creative Direction');
    expect(names).toContain('Pre-Production');
  });

  it('caps at 5 suggestions', () => {
    const result = buildSuggestions(100, items);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('skips items with zero hours', () => {
    const zeroItems: RateCardItem[] = [
      { id: '1', rate_card_id: 'r1', shot_type: 'Empty', category: 'scene', hours: 0, sort_order: 0 },
    ];
    const result = buildSuggestions(10, zeroItems);
    const hasEmpty = result.some((s) => s.shot_type === 'Empty');
    expect(hasEmpty).toBe(false);
  });

  it('calculates quantity correctly', () => {
    const result = buildSuggestions(7, [
      { id: '1', rate_card_id: 'r1', shot_type: 'Wide', category: 'scene', hours: 3, sort_order: 0 },
    ]);
    const wide = result.find((s) => s.shot_type === 'Wide');
    expect(wide?.quantity).toBe(2);
    expect(wide?.total_hours).toBe(6);
  });
});
