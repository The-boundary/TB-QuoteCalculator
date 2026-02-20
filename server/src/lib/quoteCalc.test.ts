import { describe, it, expect } from 'vitest';
import {
  budgetToPoolHours,
  clampEfficiency,
  distributeShotsByPercentage,
  editingHours,
  poolBudgetHours,
  remainingBudget,
  shotCount,
  totalHours,
  totalShotHours,
} from './quoteCalc';

describe('quoteCalc', () => {
  describe('shotCount', () => {
    it('calculates expected values for standard durations', () => {
      expect(shotCount(15)).toBe(5);
      expect(shotCount(30)).toBe(8);
      expect(shotCount(45)).toBe(12);
      expect(shotCount(60)).toBe(15);
      expect(shotCount(90)).toBe(23);
      expect(shotCount(120)).toBe(30);
    });

    it('keeps minimum floor for very short durations', () => {
      expect(shotCount(1)).toBe(5);
    });
  });

  describe('poolBudgetHours', () => {
    it('calculates budget from duration and rate', () => {
      expect(poolBudgetHours(60, 17.33)).toBeCloseTo(1039.8);
    });
  });

  describe('budgetToPoolHours', () => {
    it('calculates hours from budget and rate', () => {
      expect(budgetToPoolHours(10000, 125)).toBe(80);
      expect(budgetToPoolHours(5000, 125)).toBe(40);
    });

    it('returns 0 when rate is invalid', () => {
      expect(budgetToPoolHours(10000, 0)).toBe(0);
    });
  });

  describe('editingHours', () => {
    it('rounds up to next 30 second chunk', () => {
      expect(editingHours(45, 8)).toBe(16);
      expect(editingHours(30, 8)).toBe(8);
      expect(editingHours(60, 8)).toBe(16);
    });
  });

  describe('distributeShotsByPercentage', () => {
    it('distributes shots for exact percentages', () => {
      const result = distributeShotsByPercentage(15, [
        { shot_type: 'Masterplan Aerial', percentage: 20, base_hours_each: 80 },
        { shot_type: 'Aerial', percentage: 40, base_hours_each: 60 },
        { shot_type: 'Exterior', percentage: 40, base_hours_each: 40 },
      ]);

      expect(result).toEqual([
        { shot_type: 'Masterplan Aerial', quantity: 3 },
        { shot_type: 'Aerial', quantity: 6 },
        { shot_type: 'Exterior', quantity: 6 },
      ]);
      expect(result.reduce((sum, row) => sum + row.quantity, 0)).toBe(15);
    });

    it('handles fractional distribution', () => {
      const result = distributeShotsByPercentage(8, [
        { shot_type: 'Aerial', percentage: 25, base_hours_each: 60 },
        { shot_type: 'Semi-Aerial', percentage: 25, base_hours_each: 60 },
        { shot_type: 'Exterior', percentage: 50, base_hours_each: 40 },
      ]);

      expect(result.reduce((sum, row) => sum + row.quantity, 0)).toBe(8);
    });

    it('biases rounding to higher-hour shot types on ties', () => {
      const result = distributeShotsByPercentage(7, [
        { shot_type: 'Expensive', percentage: 33.34, base_hours_each: 80 },
        { shot_type: 'Medium', percentage: 33.33, base_hours_each: 60 },
        { shot_type: 'Cheap', percentage: 33.33, base_hours_each: 40 },
      ]);

      expect(result.reduce((sum, row) => sum + row.quantity, 0)).toBe(7);
      expect(result[0].quantity).toBeGreaterThanOrEqual(result[2].quantity);
    });
  });

  describe('totalShotHours', () => {
    it('sums shot hours correctly', () => {
      const shots = [
        { quantity: 3, base_hours_each: 10, efficiency_multiplier: 1 },
        { quantity: 2, base_hours_each: 5, efficiency_multiplier: 1.5 },
      ];
      expect(totalShotHours(shots)).toBe(45);
    });
  });

  describe('totalHours', () => {
    it('combines shot and editing hours', () => {
      expect(totalHours(45, 16)).toBe(61);
    });
  });

  describe('remainingBudget', () => {
    it('returns positive/zero/negative deltas', () => {
      expect(remainingBudget(100, 60)).toBe(40);
      expect(remainingBudget(100, 100)).toBe(0);
      expect(remainingBudget(100, 120)).toBe(-20);
    });
  });

  describe('clampEfficiency', () => {
    it('clamps values to 0.1..5.0', () => {
      expect(clampEfficiency(0)).toBe(0.1);
      expect(clampEfficiency(6)).toBe(5);
      expect(clampEfficiency(2.5)).toBe(2.5);
    });
  });
});
