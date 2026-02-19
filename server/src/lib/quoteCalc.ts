/**
 * Pure calculation functions for quote building.
 * Mirrors the logic in useBuilderState so it can be tested and reused server-side.
 */

export interface ShotInput {
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
}

/** Pool budget = duration in seconds * rate card's hours per second */
export function poolBudgetHours(durationSeconds: number, hoursPerSecond: number): number {
  return durationSeconds * hoursPerSecond;
}

/** Post-production editing hours = ceil(duration / 30) * editing hours per 30s */
export function editingHours(durationSeconds: number, editingHoursPer30s: number): number {
  return Math.ceil(durationSeconds / 30) * editingHoursPer30s;
}

/** Total shot hours = sum of (quantity * base * efficiency) across all shots */
export function totalShotHours(shots: ShotInput[]): number {
  return shots.reduce(
    (sum, s) => sum + s.quantity * s.base_hours_each * s.efficiency_multiplier,
    0,
  );
}

/** Total hours = shot hours + editing hours */
export function totalHours(shotHours: number, editHours: number): number {
  return shotHours + editHours;
}

/** Remaining budget = pool budget - total hours */
export function remainingBudget(pool: number, total: number): number {
  return pool - total;
}

/** Clamp efficiency multiplier to [0.1, 5.0] */
export function clampEfficiency(value: number): number {
  return Math.min(5.0, Math.max(0.1, value));
}
