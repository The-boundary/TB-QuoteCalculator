import { describe, it, expect } from 'vitest';

describe('companion persistence round-trip', () => {
  it('persisted companion base_hours_each survives reload without drift', () => {
    // Simulate: 3 regular (16h) + 2 complex (32h) = 48+64 = 112h, qty=5
    // Weighted avg = 112/5 = 22.4
    const totalHours = 3 * 16 + 2 * 32; // 112
    const qty = 5;
    const baseHoursEach = Math.round((totalHours / qty) * 100) / 100; // 22.4

    // Simulate persist (bare numeric in DB, app-side 2dp rounding) → reload
    const persisted = parseFloat(baseHoursEach.toFixed(2)); // DB round-trip
    expect(persisted * qty).toBe(totalHours);
  });

  it('handles repeating decimal: 7 regular = 112h / 7 = 16 (clean)', () => {
    const baseHoursEach = Math.round((112 / 7) * 100) / 100;
    expect(baseHoursEach).toBe(16);
  });

  it('handles repeating decimal: 3 shots mixed = 80h / 3 ≈ 26.67', () => {
    // 1 regular (16h) + 2 complex (32h) = 16+64 = 80h, qty=3
    // 80/3 = 26.666... → rounds to 26.67
    const baseHoursEach = Math.round((80 / 3) * 100) / 100;
    expect(baseHoursEach).toBe(26.67);
    // Total via companion row: 26.67 * 3 = 80.01 (1 penny drift vs true 80)
    expect(Math.round(baseHoursEach * 3 * 100) / 100).toBe(80.01);
  });
});
