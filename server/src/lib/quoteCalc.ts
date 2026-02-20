export interface ShotInput {
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
}

export interface PercentageShot {
  shot_type: string;
  percentage: number;
  base_hours_each: number;
}

export interface DistributedShot {
  shot_type: string;
  quantity: number;
}

export function shotCount(durationSeconds: number): number {
  if (durationSeconds <= 15) return 5;
  return Math.ceil(durationSeconds / 4);
}

export function poolBudgetHours(durationSeconds: number, hoursPerSecond: number): number {
  return durationSeconds * hoursPerSecond;
}

export function budgetToPoolHours(budgetAmount: number, hourlyRate: number): number {
  if (hourlyRate <= 0) return 0;
  return budgetAmount / hourlyRate;
}

export function editingHours(durationSeconds: number, editingHoursPer30s: number): number {
  return Math.ceil(durationSeconds / 30) * editingHoursPer30s;
}

export function totalShotHours(shots: ShotInput[]): number {
  return shots.reduce(
    (sum, shot) => sum + shot.quantity * shot.base_hours_each * shot.efficiency_multiplier,
    0,
  );
}

export function totalHours(shotHours: number, editHours: number): number {
  return shotHours + editHours;
}

export function remainingBudget(pool: number, total: number): number {
  return pool - total;
}

export function clampEfficiency(value: number): number {
  return Math.min(5, Math.max(0.1, value));
}

export function distributeShotsByPercentage(
  totalShots: number,
  shots: PercentageShot[],
): DistributedShot[] {
  if (shots.length === 0 || totalShots <= 0) {
    return shots.map((shot) => ({ shot_type: shot.shot_type, quantity: 0 }));
  }

  const working = shots.map((shot, index) => {
    const rawQty = totalShots * (shot.percentage / 100);
    const floored = Math.floor(rawQty);
    return {
      index,
      shot_type: shot.shot_type,
      base_hours_each: shot.base_hours_each,
      rawQty,
      floored,
      remainder: rawQty - floored,
    };
  });

  let allocated = working.reduce((sum, item) => sum + item.floored, 0);

  if (allocated > totalShots) {
    const sortedToTrim = [...working].sort((a, b) => {
      const remDiff = a.remainder - b.remainder;
      if (Math.abs(remDiff) > 0.000001) return remDiff;
      return a.base_hours_each - b.base_hours_each;
    });

    let toTrim = allocated - totalShots;
    for (const row of sortedToTrim) {
      if (toTrim <= 0) break;
      const current = working[row.index];
      if (current.floored > 0) {
        current.floored -= 1;
        toTrim -= 1;
      }
    }
    allocated = totalShots;
  }

  let remaining = totalShots - allocated;

  const sortedForRemainders = [...working].sort((a, b) => {
    const remDiff = b.remainder - a.remainder;
    if (Math.abs(remDiff) > 0.000001) return remDiff;
    return b.base_hours_each - a.base_hours_each;
  });

  let cursor = 0;
  while (remaining > 0 && sortedForRemainders.length > 0) {
    const pick = sortedForRemainders[cursor % sortedForRemainders.length];
    working[pick.index].floored += 1;
    cursor += 1;
    remaining -= 1;
  }

  return working
    .sort((a, b) => a.index - b.index)
    .map((item) => ({ shot_type: item.shot_type, quantity: item.floored }));
}
