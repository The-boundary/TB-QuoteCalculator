import { useState, useMemo, useCallback } from 'react';
import type {
  RateCardWithItems,
  QuoteVersionWithShots,
  FilmTemplateWithShots,
} from '../../../../../shared/types';

export interface BuilderShot {
  shot_type: string;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  sort_order: number;
  selected: boolean;
}

interface BuilderState {
  duration: number;
  shots: BuilderShot[];
  notes: string;
}

export function useBuilderState(
  rateCard: RateCardWithItems | undefined,
  existingVersion?: QuoteVersionWithShots,
) {
  const [state, setState] = useState<BuilderState>(() => {
    if (existingVersion) {
      return {
        duration: existingVersion.duration_seconds,
        notes: existingVersion.notes ?? '',
        shots: existingVersion.shots.map((s) => ({
          shot_type: s.shot_type,
          quantity: s.quantity,
          base_hours_each: s.base_hours_each,
          efficiency_multiplier: s.efficiency_multiplier,
          sort_order: s.sort_order,
          selected: false,
        })),
      };
    }
    return { duration: 60, shots: [], notes: '' };
  });

  const hoursPerSecond = rateCard?.hours_per_second ?? 0;
  const editingHoursPer30s = rateCard?.editing_hours_per_30s ?? 0;

  const poolBudgetHours = useMemo(
    () => state.duration * hoursPerSecond,
    [state.duration, hoursPerSecond],
  );

  const editingHours = useMemo(
    () => Math.ceil(state.duration / 30) * editingHoursPer30s,
    [state.duration, editingHoursPer30s],
  );

  const totalShotHours = useMemo(
    () =>
      state.shots.reduce(
        (sum, s) => sum + s.quantity * s.base_hours_each * s.efficiency_multiplier,
        0,
      ),
    [state.shots],
  );

  const totalHours = useMemo(() => totalShotHours + editingHours, [totalShotHours, editingHours]);

  const remaining = useMemo(() => poolBudgetHours - totalHours, [poolBudgetHours, totalHours]);

  // --- Actions ---

  const setDuration = useCallback((seconds: number) => {
    setState((prev) => ({ ...prev, duration: seconds }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  const addShot = useCallback((shotType: string, baseHours: number) => {
    setState((prev) => ({
      ...prev,
      shots: [
        ...prev.shots,
        {
          shot_type: shotType,
          quantity: 1,
          base_hours_each: baseHours,
          efficiency_multiplier: 1.0,
          sort_order: prev.shots.length,
          selected: false,
        },
      ],
    }));
  }, []);

  const removeShot = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.filter((_, i) => i !== index),
    }));
  }, []);

  const updateQuantity = useCallback((index: number, qty: number) => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((s, i) => (i === index ? { ...s, quantity: Math.max(1, qty) } : s)),
    }));
  }, []);

  const updateEfficiency = useCallback((index: number, multiplier: number) => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((s, i) =>
        i === index ? { ...s, efficiency_multiplier: Math.min(5.0, Math.max(0.1, multiplier)) } : s,
      ),
    }));
  }, []);

  const batchSetEfficiency = useCallback((indices: number[], multiplier: number) => {
    const clamped = Math.min(5.0, Math.max(0.1, multiplier));
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((s, i) =>
        indices.includes(i) ? { ...s, efficiency_multiplier: clamped } : s,
      ),
    }));
  }, []);

  const toggleShotSelection = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s)),
    }));
  }, []);

  const selectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((s) => ({ ...s, selected: true })),
    }));
  }, []);

  const deselectAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shots: prev.shots.map((s) => ({ ...s, selected: false })),
    }));
  }, []);

  const applyTemplate = useCallback(
    (template: FilmTemplateWithShots) => {
      const rateItems = rateCard?.items ?? [];
      const rateMap = new Map(rateItems.map((ri) => [ri.shot_type.toLowerCase(), ri.hours]));

      setState((prev) => ({
        ...prev,
        duration: template.duration_seconds,
        shots: template.shots.map((ts, idx) => ({
          shot_type: ts.shot_type,
          quantity: ts.quantity,
          base_hours_each: rateMap.get(ts.shot_type.toLowerCase()) ?? 0,
          efficiency_multiplier: ts.efficiency_multiplier,
          sort_order: idx,
          selected: false,
        })),
      }));
    },
    [rateCard],
  );

  const getPayload = useCallback(() => {
    return {
      duration_seconds: state.duration,
      notes: state.notes || undefined,
      shots: state.shots.map((s, i) => ({
        shot_type: s.shot_type,
        quantity: s.quantity,
        base_hours_each: s.base_hours_each,
        efficiency_multiplier: s.efficiency_multiplier,
        sort_order: i,
      })),
    };
  }, [state.duration, state.notes, state.shots]);

  return {
    // State
    duration: state.duration,
    shots: state.shots,
    notes: state.notes,

    // Derived
    poolBudgetHours,
    editingHours,
    editingHoursPer30s,
    totalShotHours,
    totalHours,
    remaining,

    // Actions
    setDuration,
    setNotes,
    addShot,
    removeShot,
    updateQuantity,
    updateEfficiency,
    batchSetEfficiency,
    toggleShotSelection,
    selectAll,
    deselectAll,
    applyTemplate,
    getPayload,
  };
}
