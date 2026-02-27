import { useCallback, useMemo, useState } from 'react';
import { calcShotCount } from '@/lib/utils';
import type {
  FilmTemplateWithShots,
  LineItemCategory,
  QuoteMode,
  QuoteVersionWithShots,
  RateCardItem,
  RateCardWithItems,
} from '@shared/types';
import { ANIMATION_COMPANION_TYPE } from '@shared/types';

export interface BuilderLineItem {
  name: string;
  category: LineItemCategory;
  hours_each: number;
  quantity: number;
  notes: string;
  sort_order: number;
}

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

export interface BuilderModule {
  id: string;
  name: string;
  moduleType: 'film' | 'supplementary';
  duration: number;
  shotCount: number;
  shots: BuilderShot[];
  animationComplexity: 'regular' | 'complex';
}

interface BuilderState {
  mode: QuoteMode;
  modules: BuilderModule[];
  lineItems: BuilderLineItem[];
  notes: string;
  showPricing: boolean;
  hourlyRate: number;
  budgetAmount: number | null;
  poolBudgetHours: number | null;
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

/** Generate a simple unique ID for client-side module tracking. */
function generateModuleId(): string {
  return crypto.randomUUID();
}

/** Update a single module at index, returning a new modules array. */
function updateModuleAt(
  modules: BuilderModule[],
  idx: number,
  fn: (mod: BuilderModule) => BuilderModule,
): BuilderModule[] {
  return modules.map((m, i) => (i === idx ? fn(m) : m));
}

/** Parse raw version shots into BuilderShot[] */
function parseShots(
  rawShots: QuoteVersionWithShots['shots'],
  shotCount: number,
): BuilderShot[] {
  return rawShots.map((shot, index) => ({
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
}

/** Initialize modules from existing version data, or create a default. */
function initModules(
  existingVersion: QuoteVersionWithShots | undefined,
  rateCardItems: RateCardItem[],
): BuilderModule[] {
  const versionModules = existingVersion?.modules ?? [];
  const versionShots = existingVersion?.shots ?? [];

  if (versionModules.length > 0) {
    // Group shots by module_id
    const shotsByModuleId = new Map<string, typeof versionShots>();
    for (const shot of versionShots) {
      const mid = shot.module_id ?? versionModules[0].id;
      if (!shotsByModuleId.has(mid)) shotsByModuleId.set(mid, []);
      shotsByModuleId.get(mid)!.push(shot);
    }

    return versionModules.map((mod) => {
      const moduleShots = shotsByModuleId.get(mod.id) ?? [];
      const duration = mod.duration_seconds ?? 60;
      const sc = calcShotCount(duration);
      const complexity = (mod.animation_complexity as 'regular' | 'complex') ?? 'regular';

      const baseShots = parseShots(moduleShots, sc);
      const userShots = baseShots.filter((s) => !s.is_companion);
      const distributed = rebalance(sc, userShots);
      const withCompanion = syncAnimationCompanion(distributed, complexity, rateCardItems);

      return {
        id: mod.id,
        name: mod.name,
        moduleType: (mod.module_type as 'film' | 'supplementary') ?? 'film',
        duration,
        shotCount: sc,
        shots: withCompanion,
        animationComplexity: complexity,
      };
    });
  }

  // No modules — create a single default
  const duration = existingVersion?.duration_seconds ?? 60;
  const sc = calcShotCount(duration);
  const baseShots = parseShots(versionShots, sc);
  const userShots = baseShots.filter((s) => !s.is_companion);
  const distributed = rebalance(sc, userShots);
  const withCompanion = syncAnimationCompanion(distributed, 'regular', rateCardItems);

  return [
    {
      id: generateModuleId(),
      name: 'Film 1',
      moduleType: 'film',
      duration,
      shotCount: sc,
      shots: withCompanion,
      animationComplexity: 'regular',
    },
  ];
}

export function useBuilderState(
  rateCard: RateCardWithItems | undefined,
  existingVersion: QuoteVersionWithShots | undefined,
  quoteMode: QuoteMode,
) {
  const [state, setState] = useState<BuilderState>(() => {
    const baseHourlyRate = rateCard?.hourly_rate ?? existingVersion?.hourly_rate ?? 125;
    const modules = initModules(existingVersion, rateCard?.items ?? []);

    const existingLineItems: BuilderLineItem[] = (existingVersion?.line_items ?? []).map(
      (item, index) => ({
        name: item.name,
        category: item.category,
        hours_each: Number(item.hours_each),
        quantity: Number(item.quantity),
        notes: item.notes ?? '',
        sort_order: item.sort_order ?? index,
      }),
    );

    const totalDuration = modules.reduce((sum, m) => sum + m.duration, 0);
    const budgetHours =
      quoteMode === 'budget'
        ? (existingVersion?.pool_budget_hours ?? totalDuration * (rateCard?.hours_per_second ?? 0))
        : null;

    return {
      mode: quoteMode,
      modules,
      lineItems: existingLineItems,
      notes: existingVersion?.notes ?? '',
      showPricing: true,
      hourlyRate: baseHourlyRate,
      budgetAmount:
        quoteMode === 'budget'
          ? (existingVersion?.pool_budget_amount ??
            (budgetHours !== null ? budgetHours * baseHourlyRate : null))
          : null,
      poolBudgetHours: budgetHours,
    };
  });

  const editingHoursPer30s = rateCard?.editing_hours_per_30s ?? 0;

  const totalDuration = useMemo(
    () => state.modules.reduce((sum, m) => sum + m.duration, 0),
    [state.modules],
  );

  const totalShotCount = useMemo(
    () => state.modules.reduce((sum, m) => sum + m.shotCount, 0),
    [state.modules],
  );

  const editingHours = useMemo(
    () => Math.ceil(totalDuration / 30) * editingHoursPer30s,
    [totalDuration, editingHoursPer30s],
  );

  const totalShotHours = useMemo(
    () =>
      state.modules.reduce(
        (sum, m) => sum + m.shots.reduce((s, shot) => s + shot.adjusted_hours, 0),
        0,
      ),
    [state.modules],
  );

  const totalLineItemHours = useMemo(
    () => state.lineItems.reduce((sum, item) => sum + item.hours_each * item.quantity, 0),
    [state.lineItems],
  );

  const totalHours = totalShotHours + editingHours + totalLineItemHours;

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

  // ─── Global callbacks ───

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

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  // ─── Module-level callbacks ───

  const addModule = useCallback(
    (name?: string) => {
      setState((prev) => {
        const nextName = name ?? `Film ${prev.modules.length + 1}`;
        const newModule: BuilderModule = {
          id: generateModuleId(),
          name: nextName,
          moduleType: 'film',
          duration: 60,
          shotCount: calcShotCount(60),
          shots: [],
          animationComplexity: 'regular',
        };
        return { ...prev, modules: [...prev.modules, newModule] };
      });
    },
    [],
  );

  const removeModule = useCallback((moduleIdx: number) => {
    setState((prev) => {
      if (prev.modules.length <= 1) return prev; // always keep at least one
      return {
        ...prev,
        modules: prev.modules.filter((_, i) => i !== moduleIdx),
      };
    });
  }, []);

  const updateModuleName = useCallback((moduleIdx: number, name: string) => {
    setState((prev) => ({
      ...prev,
      modules: updateModuleAt(prev.modules, moduleIdx, (m) => ({ ...m, name })),
    }));
  }, []);

  // ─── Module-scoped shot callbacks ───

  const setDuration = useCallback(
    (moduleIdx: number, duration: number) => {
      setState((prev) => {
        const updated = {
          ...prev,
          modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
            const sc = calcShotCount(duration);
            const userShots = mod.shots.filter((s) => !s.is_companion);
            const rebalanced = rebalance(sc, userShots);
            const shots = syncAnimationCompanion(
              rebalanced,
              mod.animationComplexity,
              rateCard?.items ?? [],
            );
            return { ...mod, duration, shotCount: sc, shots };
          }),
        };

        const newTotalDuration = updated.modules.reduce((s, m) => s + m.duration, 0);
        const poolBudgetHours =
          prev.mode === 'budget' && prev.budgetAmount === null
            ? newTotalDuration * (rateCard?.hours_per_second ?? 0)
            : prev.poolBudgetHours;

        return { ...updated, poolBudgetHours };
      });
    },
    [rateCard?.hours_per_second, rateCard?.items],
  );

  const setPercentage = useCallback(
    (moduleIdx: number, index: number, percentage: number) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const clamped = Math.max(0, Math.min(100, percentage));
          const userShots = [...mod.shots.filter((s) => !s.is_companion)];
          const current = userShots[index];
          if (!current) return mod;

          userShots[index] = { ...current, percentage: clamped, manualOverride: false };

          const manualTotal = userShots
            .filter((shot, idx) => idx !== index && shot.manualOverride)
            .reduce((sum, shot) => sum + shot.percentage, 0);

          const adjustable = userShots.filter(
            (shot, idx) => idx !== index && !shot.manualOverride,
          );
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

          const distributed = rebalance(mod.shotCount, rebalanced);
          const shots = syncAnimationCompanion(
            distributed,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const updateQuantity = useCallback(
    (moduleIdx: number, index: number, quantity: number) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const nextQty = Math.max(0, quantity);
          const userShots = mod.shots.filter((s) => !s.is_companion).map((shot, idx) => {
            if (idx !== index) return shot;
            const pct = mod.shotCount > 0 ? (nextQty / mod.shotCount) * 100 : 0;
            return { ...shot, quantity: nextQty, percentage: pct, manualOverride: true };
          });
          const rebalanced = rebalance(mod.shotCount, userShots);
          const shots = syncAnimationCompanion(
            rebalanced,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const unlockManualQuantity = useCallback(
    (moduleIdx: number, index: number) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const userShots = mod.shots.filter((s) => !s.is_companion);
          if (!userShots[index]?.manualOverride) return mod;

          const updated = userShots.map((shot, idx) =>
            idx === index ? { ...shot, manualOverride: false } : shot,
          );
          const rebalanced = rebalance(mod.shotCount, updated);
          const shots = syncAnimationCompanion(
            rebalanced,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const updateEfficiency = useCallback(
    (moduleIdx: number, index: number, multiplier: number) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => ({
          ...mod,
          shots: mod.shots.map((shot, idx) =>
            idx === index ? applyShotEfficiency(shot, multiplier) : shot,
          ),
        })),
      }));
    },
    [],
  );

  const batchSetEfficiency = useCallback(
    (moduleIdx: number, indices: number[], multiplier: number) => {
      const targetSet = new Set(indices);
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => ({
          ...mod,
          shots: mod.shots.map((shot, idx) =>
            targetSet.has(idx) ? applyShotEfficiency(shot, multiplier) : shot,
          ),
        })),
      }));
    },
    [],
  );

  const addShot = useCallback(
    (moduleIdx: number, shotType: string, baseHours: number) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const userShots = mod.shots.filter((s) => !s.is_companion);
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
          const rebalanced = rebalance(mod.shotCount, spread);
          const shots = syncAnimationCompanion(
            rebalanced,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const removeShot = useCallback(
    (moduleIdx: number, index: number) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const userShots = mod.shots.filter((s) => !s.is_companion);
          const remaining = userShots
            .filter((_, idx) => idx !== index)
            .map((shot, idx) => ({ ...shot, sort_order: idx }));
          const rebalanced = rebalance(mod.shotCount, remaining);
          const shots = syncAnimationCompanion(
            rebalanced,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const applyTemplate = useCallback(
    (moduleIdx: number, template: FilmTemplateWithShots) => {
      const rateMap = new Map(
        (rateCard?.items ?? []).map((item) => [item.shot_type.toLowerCase(), Number(item.hours)]),
      );

      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
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

          const distributed = rebalance(mod.shotCount, fromTemplate);
          const shots = syncAnimationCompanion(
            distributed,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const setAnimationComplexity = useCallback(
    (moduleIdx: number, complexity: 'regular' | 'complex') => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const userShots = mod.shots.filter((s) => !s.is_companion);
          const shots = syncAnimationCompanion(userShots, complexity, rateCard?.items ?? []);
          return { ...mod, animationComplexity: complexity, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const setAnimationOverride = useCallback(
    (moduleIdx: number, index: number, override: 'regular' | 'complex' | null) => {
      setState((prev) => ({
        ...prev,
        modules: updateModuleAt(prev.modules, moduleIdx, (mod) => {
          const userShots = mod.shots.filter((s) => !s.is_companion);
          const updated = userShots.map((shot, idx) =>
            idx === index ? { ...shot, animation_override: override } : shot,
          );
          const shots = syncAnimationCompanion(
            updated,
            mod.animationComplexity,
            rateCard?.items ?? [],
          );
          return { ...mod, shots };
        }),
      }));
    },
    [rateCard?.items],
  );

  const toggleShotSelection = useCallback((moduleIdx: number, index: number) => {
    setState((prev) => ({
      ...prev,
      modules: updateModuleAt(prev.modules, moduleIdx, (mod) => ({
        ...mod,
        shots: mod.shots.map((shot, idx) =>
          idx === index ? { ...shot, selected: !shot.selected } : shot,
        ),
      })),
    }));
  }, []);

  const selectAll = useCallback((moduleIdx: number) => {
    setState((prev) => ({
      ...prev,
      modules: updateModuleAt(prev.modules, moduleIdx, (mod) => ({
        ...mod,
        shots: mod.shots.map((shot) => ({ ...shot, selected: true })),
      })),
    }));
  }, []);

  const deselectAll = useCallback((moduleIdx: number) => {
    setState((prev) => ({
      ...prev,
      modules: updateModuleAt(prev.modules, moduleIdx, (mod) => ({
        ...mod,
        shots: mod.shots.map((shot) => ({ ...shot, selected: false })),
      })),
    }));
  }, []);

  // ─── Line item callbacks ───

  const addLineItem = useCallback((item: Omit<BuilderLineItem, 'sort_order'>) => {
    setState((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...item, sort_order: prev.lineItems.length }],
    }));
  }, []);

  const updateLineItem = useCallback((index: number, updates: Partial<BuilderLineItem>) => {
    setState((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, idx) =>
        idx === index ? { ...item, ...updates } : item,
      ),
    }));
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      lineItems: prev.lineItems
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, sort_order: idx })),
    }));
  }, []);

  // ─── Payload ───

  const payload = useMemo(
    () => ({
      mode: state.mode,
      duration_seconds: totalDuration,
      hourly_rate: state.hourlyRate,
      pool_budget_hours: state.mode === 'budget' ? effectivePoolBudgetHours : null,
      pool_budget_amount: state.mode === 'budget' ? effectiveBudgetAmount : null,
      notes: state.notes || undefined,
      modules: state.modules.map((mod, midx) => ({
        id: mod.id,
        name: mod.name,
        module_type: mod.moduleType,
        duration_seconds: mod.duration,
        animation_complexity: mod.animationComplexity,
        sort_order: midx,
        shots: mod.shots.map((shot, sidx) => ({
          shot_type: shot.shot_type,
          percentage: shot.percentage,
          quantity: shot.quantity,
          base_hours_each: shot.base_hours_each,
          efficiency_multiplier: shot.efficiency_multiplier,
          sort_order: sidx,
          is_companion: shot.is_companion ?? false,
          animation_override: shot.animation_override ?? null,
        })),
      })),
      line_items: state.lineItems.map((item, index) => ({
        name: item.name,
        category: item.category,
        hours_each: item.hours_each,
        quantity: item.quantity,
        notes: item.notes || null,
        sort_order: index,
      })),
    }),
    [
      state.mode,
      state.modules,
      state.lineItems,
      state.hourlyRate,
      state.notes,
      totalDuration,
      effectivePoolBudgetHours,
      effectiveBudgetAmount,
    ],
  );

  return {
    mode: state.mode,
    modules: state.modules,
    lineItems: state.lineItems,
    notes: state.notes,
    showPricing: state.showPricing,
    hourlyRate: state.hourlyRate,
    budgetAmount: state.mode === 'budget' ? effectiveBudgetAmount : null,
    poolBudgetHours: effectivePoolBudgetHours,
    totalDuration,
    totalShotCount,
    editingHours,
    editingHoursPer30s,
    totalShotHours,
    totalLineItemHours,
    totalHours,
    remaining,
    setMode,
    setShowPricing,
    setHourlyRate,
    setBudgetAmount,
    setNotes,
    addModule,
    removeModule,
    updateModuleName,
    setDuration,
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
    toggleShotSelection,
    selectAll,
    deselectAll,
    addLineItem,
    updateLineItem,
    removeLineItem,
    payload,
  };
}
