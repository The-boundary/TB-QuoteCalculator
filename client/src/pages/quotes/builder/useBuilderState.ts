import { useCallback, useMemo, useState } from 'react';
import { calcShotCount } from '@/lib/utils';
import type {
  FilmTemplateWithShots,
  QuoteMode,
  QuoteVersionWithShots,
  RateCardItem,
  RateCardWithItems,
} from '@shared/types';
import { ANIMATION_COMPANION_TYPE } from '@shared/types';

export interface BuilderShot {
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
  selected: boolean;
  manualOverride: boolean;
  is_companion?: boolean;
  animation_override?: 'regular' | 'complex' | null;
}

interface BuilderState {
  mode: QuoteMode;
  duration: number;
  shotCount: number;
  shots: BuilderShot[];
  notes: string;
  showPricing: boolean;
  hourlyRate: number;
  budgetAmount: number | null;
  poolBudgetHours: number | null;
  animationComplexity: 'regular' | 'complex';
}

function normalizePercentages(shots: BuilderShot[]): BuilderShot[] {
  if (shots.length === 0) return shots;

  const manualTotal = shots
    .filter((shot) => shot.manualOverride)
    .reduce((sum, shot) => sum + shot.percentage, 0);
  const auto = shots.filter((shot) => !shot.manualOverride);

  if (auto.length === 0) {
    const total = shots.reduce((sum, shot) => sum + shot.percentage, 0);
    if (total <= 0) return shots;
    return shots.map((shot) => ({ ...shot, percentage: (shot.percentage / total) * 100 }));
  }

  const autoTotal = auto.reduce((sum, shot) => sum + shot.percentage, 0);
  const available = Math.max(0, 100 - manualTotal);

  return shots.map((shot) => {
    if (shot.manualOverride) return shot;
    if (autoTotal <= 0) return { ...shot, percentage: available / auto.length };
    return { ...shot, percentage: (shot.percentage / autoTotal) * available };
  });
}

function distributeShotsByPercentage(totalShots: number, shots: BuilderShot[]): BuilderShot[] {
  if (shots.length === 0) return [];

  const manualShots = shots.filter((shot) => shot.manualOverride);
  const autoShots = shots.filter((shot) => !shot.manualOverride);

  let remainingShots = totalShots;
  const manualAssignments = new Map<number, number>();

  for (const shot of manualShots) {
    const assigned = Math.max(0, Math.min(shot.quantity, remainingShots));
    manualAssignments.set(shot.sort_order, assigned);
    remainingShots -= assigned;
  }

  const autoTotalPct = autoShots.reduce((sum, shot) => sum + shot.percentage, 0);
  const rows = autoShots.map((shot, index) => {
    const normalizedPct = autoTotalPct > 0 ? shot.percentage / autoTotalPct : 1 / autoShots.length;
    const raw = remainingShots * normalizedPct;
    const floored = Math.floor(raw);
    return {
      sort_order: shot.sort_order,
      index,
      raw,
      floored,
      remainder: raw - floored,
      base_hours_each: shot.base_hours_each,
    };
  });

  const rowBySortOrder = new Map<number, number>();
  for (const row of rows) {
    rowBySortOrder.set(row.sort_order, row.floored);
  }

  const allocated = rows.reduce((sum, row) => sum + row.floored, 0);
  let leftovers = remainingShots - allocated;
  const sortedRemainders = [...rows].sort((a, b) => {
    const rem = b.remainder - a.remainder;
    if (Math.abs(rem) > 0.000001) return rem;
    return b.base_hours_each - a.base_hours_each;
  });

  if (sortedRemainders.length === 0 && manualShots.length > 0 && remainingShots > 0) {
    const firstManualSortOrder = manualShots[0].sort_order;
    manualAssignments.set(
      firstManualSortOrder,
      (manualAssignments.get(firstManualSortOrder) ?? 0) + remainingShots,
    );
    remainingShots = 0;
  }

  let cursor = 0;
  while (leftovers > 0 && sortedRemainders.length > 0) {
    const row = sortedRemainders[cursor % sortedRemainders.length];
    rowBySortOrder.set(row.sort_order, (rowBySortOrder.get(row.sort_order) ?? 0) + 1);
    cursor += 1;
    leftovers -= 1;
  }

  return shots.map((shot) => {
    const quantity = shot.manualOverride
      ? (manualAssignments.get(shot.sort_order) ?? 0)
      : (rowBySortOrder.get(shot.sort_order) ?? 0);
    const adjusted_hours = quantity * shot.base_hours_each * shot.efficiency_multiplier;
    return { ...shot, quantity, adjusted_hours };
  });
}

/** Normalize percentages then distribute shots -- the common pipeline used by most mutations. */
function rebalance(shotCount: number, shots: BuilderShot[]): BuilderShot[] {
  return distributeShotsByPercentage(shotCount, normalizePercentages(shots));
}

/** Clamp efficiency to [0.1, 5] and recalculate adjusted_hours. */
function applyShotEfficiency(shot: BuilderShot, multiplier: number): BuilderShot {
  const clamped = Math.max(0.1, Math.min(5, multiplier));
  return {
    ...shot,
    efficiency_multiplier: clamped,
    adjusted_hours: shot.quantity * shot.base_hours_each * clamped,
  };
}

const REGULAR_HOURS = 16;
const COMPLEX_HOURS = 32;

export function buildCategoryMap(rateCardItems: RateCardItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of rateCardItems) {
    map.set(item.shot_type.toLowerCase(), item.category);
  }
  return map;
}

export function syncAnimationCompanion(
  shots: BuilderShot[],
  masterComplexity: 'regular' | 'complex',
  rateCardItems: RateCardItem[],
): BuilderShot[] {
  const userShots = shots.filter((s) => !s.is_companion);
  const categoryMap = buildCategoryMap(rateCardItems);

  let totalSceneQty = 0;
  let totalCompanionHours = 0;
  for (const shot of userShots) {
    const category = categoryMap.get(shot.shot_type.toLowerCase());
    if (category !== 'scene') continue;
    totalSceneQty += shot.quantity;
    const effective = shot.animation_override ?? masterComplexity;
    const hours = effective === 'complex' ? COMPLEX_HOURS : REGULAR_HOURS;
    totalCompanionHours += shot.quantity * hours;
  }

  if (totalSceneQty === 0) return userShots;

  const baseHoursEach = Math.round((totalCompanionHours / totalSceneQty) * 100) / 100;

  const companion: BuilderShot = {
    shot_type: ANIMATION_COMPANION_TYPE,
    percentage: 0,
    quantity: totalSceneQty,
    base_hours_each: baseHoursEach,
    efficiency_multiplier: 1,
    adjusted_hours: Math.round(baseHoursEach * totalSceneQty * 100) / 100,
    sort_order: userShots.length,
    selected: false,
    manualOverride: true,
    is_companion: true,
    animation_override: null,
  };

  return [...userShots, companion];
}

export function useBuilderState(
  rateCard: RateCardWithItems | undefined,
  existingVersion: QuoteVersionWithShots | undefined,
  quoteMode: QuoteMode,
) {
  const [state, setState] = useState<BuilderState>(() => {
    const baseHourlyRate = rateCard?.hourly_rate ?? existingVersion?.hourly_rate ?? 125;
    const duration = existingVersion?.duration_seconds ?? 60;
    const shotCount = calcShotCount(duration);

    // Derive animation complexity from existing version modules
    const existingModules = existingVersion?.modules ?? [];
    const initialComplexity: 'regular' | 'complex' =
      existingModules.length > 0
        ? (existingModules[0].animation_complexity as 'regular' | 'complex')
        : 'regular';

    const existingShots = existingVersion?.shots ?? [];
    const baseShots: BuilderShot[] = existingShots.map((shot, index) => ({
      shot_type: shot.shot_type,
      percentage:
        shot.percentage !== undefined && shot.percentage !== null
          ? Number(shot.percentage)
          : shotCount > 0
            ? (Math.max(1, Number(shot.quantity)) / shotCount) * 100
            : 0,
      quantity: Number(shot.quantity),
      base_hours_each: Number(shot.base_hours_each),
      efficiency_multiplier: Number(shot.efficiency_multiplier),
      adjusted_hours: Number(shot.adjusted_hours),
      sort_order: shot.sort_order ?? index,
      selected: false,
      manualOverride: shot.is_companion ?? false,
      is_companion: shot.is_companion ?? false,
      animation_override: shot.animation_override ?? null,
    }));

    // Rebalance only non-companion shots, then re-add companion
    const userShots = baseShots.filter((s) => !s.is_companion);
    const distributed = rebalance(shotCount, userShots);
    const withCompanion = syncAnimationCompanion(
      distributed,
      initialComplexity,
      rateCard?.items ?? [],
    );

    const budgetHours =
      quoteMode === 'budget'
        ? (existingVersion?.pool_budget_hours ?? duration * (rateCard?.hours_per_second ?? 0))
        : null;

    return {
      mode: quoteMode,
      duration,
      shotCount,
      shots: withCompanion,
      notes: existingVersion?.notes ?? '',
      showPricing: true,
      hourlyRate: baseHourlyRate,
      budgetAmount:
        quoteMode === 'budget'
          ? (existingVersion?.pool_budget_amount ??
            (budgetHours !== null ? budgetHours * baseHourlyRate : null))
          : null,
      poolBudgetHours: budgetHours,
      animationComplexity: initialComplexity,
    };
  });

  const editingHoursPer30s = rateCard?.editing_hours_per_30s ?? 0;

  const editingHours = useMemo(
    () => Math.ceil(state.duration / 30) * editingHoursPer30s,
    [state.duration, editingHoursPer30s],
  );

  const totalShotHours = useMemo(
    () => state.shots.reduce((sum, shot) => sum + shot.adjusted_hours, 0),
    [state.shots],
  );

  const totalHours = totalShotHours + editingHours;

  const effectivePoolBudgetHours = useMemo(() => {
    if (state.mode !== 'budget') return null;
    if (state.budgetAmount !== null) return state.budgetAmount / Math.max(state.hourlyRate, 1);
    return state.poolBudgetHours;
  }, [state.mode, state.budgetAmount, state.poolBudgetHours, state.hourlyRate]);

  const effectiveBudgetAmount = useMemo(() => {
    if (state.mode !== 'budget') return null;
    if (state.budgetAmount !== null) return state.budgetAmount;
    return effectivePoolBudgetHours !== null ? effectivePoolBudgetHours * state.hourlyRate : null;
  }, [state.mode, state.budgetAmount, effectivePoolBudgetHours, state.hourlyRate]);

  const remaining =
    effectivePoolBudgetHours !== null ? effectivePoolBudgetHours - totalHours : null;

  const setMode = useCallback((mode: QuoteMode) => {
    setState((prev) => ({
      ...prev,
      mode,
      budgetAmount: mode === 'budget' ? (prev.budgetAmount ?? 0) : null,
      poolBudgetHours: mode === 'budget' ? prev.poolBudgetHours : null,
    }));
  }, []);

  const setShowPricing = useCallback((showPricing: boolean) => {
    setState((prev) => ({ ...prev, showPricing }));
  }, []);

  const setDuration = useCallback(
    (duration: number) => {
      setState((prev) => {
        const sc = calcShotCount(duration);
        const userShots = prev.shots.filter((s) => !s.is_companion);
        const rebalanced = rebalance(sc, userShots);
        const shots = syncAnimationCompanion(rebalanced, prev.animationComplexity, rateCard?.items ?? []);

        const poolBudgetHours =
          prev.mode === 'budget' && prev.budgetAmount === null
            ? duration * (rateCard?.hours_per_second ?? 0)
            : prev.poolBudgetHours;

        return { ...prev, duration, shotCount: sc, shots, poolBudgetHours };
      });
    },
    [rateCard?.hours_per_second, rateCard?.items],
  );

  const setHourlyRate = useCallback((hourlyRate: number) => {
    setState((prev) => ({ ...prev, hourlyRate: Math.max(0, hourlyRate) }));
  }, []);

  const setBudgetAmount = useCallback((budgetAmount: number | null) => {
    setState((prev) => ({
      ...prev,
      budgetAmount,
      poolBudgetHours:
        budgetAmount !== null ? budgetAmount / Math.max(prev.hourlyRate, 1) : prev.poolBudgetHours,
    }));
  }, []);

  const setPercentage = useCallback((index: number, percentage: number) => {
    setState((prev) => {
      const clamped = Math.max(0, Math.min(100, percentage));
      const userShots = [...prev.shots.filter((s) => !s.is_companion)];
      const current = userShots[index];
      if (!current) return prev;

      userShots[index] = { ...current, percentage: clamped, manualOverride: false };

      const manualTotal = userShots
        .filter((shot, idx) => idx !== index && shot.manualOverride)
        .reduce((sum, shot) => sum + shot.percentage, 0);

      const adjustable = userShots.filter((shot, idx) => idx !== index && !shot.manualOverride);
      const adjustableTotal = adjustable.reduce((sum, shot) => sum + shot.percentage, 0);
      const available = Math.max(0, 100 - clamped - manualTotal);

      const rebalanced = userShots.map((shot, idx) => {
        if (idx === index || shot.manualOverride) return shot;
        if (adjustable.length === 0) return shot;
        if (adjustableTotal <= 0) {
          return { ...shot, percentage: available / adjustable.length };
        }
        return { ...shot, percentage: (shot.percentage / adjustableTotal) * available };
      });

      const distributed = rebalance(prev.shotCount, rebalanced);
      return { ...prev, shots: syncAnimationCompanion(distributed, prev.animationComplexity, rateCard?.items ?? []) };
    });
  }, [rateCard?.items]);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    setState((prev) => {
      const nextQty = Math.max(0, quantity);
      const userShots = prev.shots.filter((s) => !s.is_companion).map((shot, idx) => {
        if (idx !== index) return shot;
        const percentage = prev.shotCount > 0 ? (nextQty / prev.shotCount) * 100 : 0;
        return { ...shot, quantity: nextQty, percentage, manualOverride: true };
      });
      const rebalanced = rebalance(prev.shotCount, userShots);
      return { ...prev, shots: syncAnimationCompanion(rebalanced, prev.animationComplexity, rateCard?.items ?? []) };
    });
  }, [rateCard?.items]);

  const unlockManualQuantity = useCallback((index: number) => {
    setState((prev) => {
      const userShots = prev.shots.filter((s) => !s.is_companion);
      if (!userShots[index]?.manualOverride) return prev;

      const shots = userShots.map((shot, idx) =>
        idx === index ? { ...shot, manualOverride: false } : shot,
      );

      const rebalanced = rebalance(prev.shotCount, shots);
      return { ...prev, shots: syncAnimationCompanion(rebalanced, prev.animationComplexity, rateCard?.items ?? []) };
    });
  }, [rateCard?.items]);

  const updateEfficiency = useCallback((index: number, multiplier: number) => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((shot, idx) =>
        idx === index ? applyShotEfficiency(shot, multiplier) : shot,
      ),
    }));
  }, []);

  const batchSetEfficiency = useCallback((indices: number[], multiplier: number) => {
    const targetSet = new Set(indices);
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((shot, idx) =>
        targetSet.has(idx) ? applyShotEfficiency(shot, multiplier) : shot,
      ),
    }));
  }, []);

  const addShot = useCallback((shotType: string, baseHours: number) => {
    setState((prev) => {
      const userShots = prev.shots.filter((s) => !s.is_companion);
      const newShot: BuilderShot = {
        shot_type: shotType,
        percentage: 0,
        quantity: 0,
        base_hours_each: baseHours,
        efficiency_multiplier: 1,
        adjusted_hours: 0,
        sort_order: userShots.length,
        selected: false,
        manualOverride: false,
      };

      const nextShots = [...userShots, newShot];
      const equalPct = 100 / nextShots.length;
      const spread = nextShots.map((shot) =>
        shot.manualOverride ? shot : { ...shot, percentage: equalPct },
      );
      const rebalanced = rebalance(prev.shotCount, spread);
      return { ...prev, shots: syncAnimationCompanion(rebalanced, prev.animationComplexity, rateCard?.items ?? []) };
    });
  }, [rateCard?.items]);

  const removeShot = useCallback((index: number) => {
    setState((prev) => {
      const userShots = prev.shots.filter((s) => !s.is_companion);
      const shots = userShots
        .filter((_, idx) => idx !== index)
        .map((shot, idx) => ({ ...shot, sort_order: idx }));
      const rebalanced = rebalance(prev.shotCount, shots);
      return { ...prev, shots: syncAnimationCompanion(rebalanced, prev.animationComplexity, rateCard?.items ?? []) };
    });
  }, [rateCard?.items]);

  const applyTemplate = useCallback(
    (template: FilmTemplateWithShots) => {
      const rateMap = new Map(
        (rateCard?.items ?? []).map((item) => [item.shot_type.toLowerCase(), Number(item.hours)]),
      );

      setState((prev) => {
        const fromTemplate: BuilderShot[] = template.shots.map((shot, index) => ({
          shot_type: shot.shot_type,
          percentage: Number(shot.percentage),
          quantity: 0,
          base_hours_each: Number(rateMap.get(shot.shot_type.toLowerCase()) ?? 0),
          efficiency_multiplier: Number(shot.efficiency_multiplier),
          adjusted_hours: 0,
          sort_order: index,
          selected: false,
          manualOverride: false,
        }));

        // Use CURRENT duration/shotCount, not template's
        const distributed = rebalance(prev.shotCount, fromTemplate);

        return { ...prev, shots: syncAnimationCompanion(distributed, prev.animationComplexity, rateCard?.items ?? []) };
      });
    },
    [rateCard?.items],
  );

  const setAnimationComplexity = useCallback(
    (complexity: 'regular' | 'complex') => {
      setState((prev) => {
        const userShots = prev.shots.filter((s) => !s.is_companion);
        const shots = syncAnimationCompanion(userShots, complexity, rateCard?.items ?? []);
        return { ...prev, animationComplexity: complexity, shots };
      });
    },
    [rateCard?.items],
  );

  const setAnimationOverride = useCallback(
    (index: number, override: 'regular' | 'complex' | null) => {
      setState((prev) => {
        const userShots = prev.shots.filter((s) => !s.is_companion);
        const updated = userShots.map((shot, idx) =>
          idx === index ? { ...shot, animation_override: override } : shot,
        );
        const shots = syncAnimationCompanion(updated, prev.animationComplexity, rateCard?.items ?? []);
        return { ...prev, shots };
      });
    },
    [rateCard?.items],
  );

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  const toggleShotSelection = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((shot, idx) =>
        idx === index ? { ...shot, selected: !shot.selected } : shot,
      ),
    }));
  }, []);

  const selectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((shot) => ({ ...shot, selected: true })),
    }));
  }, []);

  const deselectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((shot) => ({ ...shot, selected: false })),
    }));
  }, []);

  const payload = useMemo(
    () => ({
      mode: state.mode,
      duration_seconds: state.duration,
      hourly_rate: state.hourlyRate,
      pool_budget_hours: state.mode === 'budget' ? effectivePoolBudgetHours : null,
      pool_budget_amount: state.mode === 'budget' ? effectiveBudgetAmount : null,
      notes: state.notes || undefined,
      shots: state.shots.map((shot, index) => ({
        shot_type: shot.shot_type,
        percentage: shot.percentage,
        quantity: shot.quantity,
        base_hours_each: shot.base_hours_each,
        efficiency_multiplier: shot.efficiency_multiplier,
        sort_order: index,
        is_companion: shot.is_companion ?? false,
        animation_override: shot.animation_override ?? null,
      })),
    }),
    [
      state.duration,
      state.hourlyRate,
      state.mode,
      state.notes,
      state.shots,
      effectivePoolBudgetHours,
      effectiveBudgetAmount,
    ],
  );

  return {
    mode: state.mode,
    duration: state.duration,
    shotCount: state.shotCount,
    shots: state.shots,
    notes: state.notes,
    showPricing: state.showPricing,
    hourlyRate: state.hourlyRate,
    animationComplexity: state.animationComplexity,
    budgetAmount: state.mode === 'budget' ? effectiveBudgetAmount : null,
    poolBudgetHours: effectivePoolBudgetHours,
    editingHours,
    editingHoursPer30s,
    totalShotHours,
    totalHours,
    remaining,
    setMode,
    setShowPricing,
    setDuration,
    setHourlyRate,
    setBudgetAmount,
    setPercentage,
    updateQuantity,
    unlockManualQuantity,
    updateEfficiency,
    batchSetEfficiency,
    addShot,
    removeShot,
    applyTemplate,
    setAnimationComplexity,
    setAnimationOverride,
    setNotes,
    toggleShotSelection,
    selectAll,
    deselectAll,
    payload,
  };
}
