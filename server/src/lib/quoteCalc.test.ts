import { describe, it, expect } from 'vitest';
import {
  poolBudgetHours,
  editingHours,
  totalShotHours,
  totalHours,
  remainingBudget,
  clampEfficiency,
} from './quoteCalc';

describe('quoteCalc', () => {
  describe('poolBudgetHours', () => {
    it('calculates budget from duration and rate', () => {
      expect(poolBudgetHours(60, 17.33)).toBeCloseTo(1039.8);
    });

    it('returns 0 for zero duration', () => {
      expect(poolBudgetHours(0, 17.33)).toBe(0);
    });

    it('returns 0 for zero rate', () => {
      expect(poolBudgetHours(60, 0)).toBe(0);
    });
  });

  describe('editingHours', () => {
    it('rounds up to next 30s chunk', () => {
      // 45 seconds = ceil(45/30) = 2 chunks * 8 hours = 16
      expect(editingHours(45, 8)).toBe(16);
    });

    it('exact 30s boundary', () => {
      // 30 seconds = ceil(30/30) = 1 chunk * 8 = 8
      expect(editingHours(30, 8)).toBe(8);
    });

    it('60 seconds = 2 chunks', () => {
      expect(editingHours(60, 8)).toBe(16);
    });

    it('1 second = 1 chunk', () => {
      expect(editingHours(1, 8)).toBe(8);
    });
  });

  describe('totalShotHours', () => {
    it('sums shot hours correctly', () => {
      const shots = [
        { quantity: 3, base_hours_each: 10, efficiency_multiplier: 1.0 },
        { quantity: 2, base_hours_each: 5, efficiency_multiplier: 1.5 },
      ];
      // 3*10*1.0 + 2*5*1.5 = 30 + 15 = 45
      expect(totalShotHours(shots)).toBe(45);
    });

    it('returns 0 for empty array', () => {
      expect(totalShotHours([])).toBe(0);
    });

    it('handles efficiency multiplier', () => {
      const shots = [{ quantity: 1, base_hours_each: 10, efficiency_multiplier: 2.5 }];
      expect(totalShotHours(shots)).toBe(25);
    });
  });

  describe('totalHours', () => {
    it('combines shot and editing hours', () => {
      expect(totalHours(45, 16)).toBe(61);
    });
  });

  describe('remainingBudget', () => {
    it('positive when under budget', () => {
      expect(remainingBudget(100, 60)).toBe(40);
    });

    it('zero when at budget', () => {
      expect(remainingBudget(100, 100)).toBe(0);
    });

    it('negative when over budget', () => {
      expect(remainingBudget(100, 120)).toBe(-20);
    });
  });

  describe('clampEfficiency', () => {
    it('clamps below minimum to 0.1', () => {
      expect(clampEfficiency(0)).toBe(0.1);
      expect(clampEfficiency(-1)).toBe(0.1);
    });

    it('clamps above maximum to 5.0', () => {
      expect(clampEfficiency(6)).toBe(5.0);
      expect(clampEfficiency(100)).toBe(5.0);
    });

    it('passes through valid values', () => {
      expect(clampEfficiency(1.0)).toBe(1.0);
      expect(clampEfficiency(2.5)).toBe(2.5);
    });
  });
});
