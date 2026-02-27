import { memo } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/currency';
import { ANIMATION_COMPANION_TYPE } from '@shared/types';
import type { BuilderShot } from './useBuilderState';

const DISPLAY_NAMES: Record<string, string> = {
  [ANIMATION_COMPANION_TYPE]: 'Animation (auto)',
};

function displayName(shotType: string): string {
  return DISPLAY_NAMES[shotType] ?? shotType;
}

interface ShotRowProps {
  shot: BuilderShot;
  index: number;
  showPricing: boolean;
  hourlyRate: number;
  isSceneCategory?: boolean;
  animationComplexity?: 'regular' | 'complex';
  onToggleSelect: (index: number) => void;
  onPercentageChange: (index: number, percentage: number) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onUnlockManual: (index: number) => void;
  onUpdateEfficiency: (index: number, multiplier: number) => void;
  onRemove: (index: number) => void;
  onAnimationOverride?: (index: number, override: 'regular' | 'complex' | null) => void;
}

export const ShotRow = memo(function ShotRow({
  shot,
  index,
  showPricing,
  hourlyRate,
  isSceneCategory,
  animationComplexity,
  onToggleSelect,
  onPercentageChange,
  onUpdateQuantity,
  onUnlockManual,
  onUpdateEfficiency,
  onRemove,
  onAnimationOverride,
}: ShotRowProps) {
  const isCompanion = shot.is_companion === true;

  return (
    <TableRow className={isCompanion ? 'bg-muted/30 italic' : undefined}>
      <TableCell className="w-10">
        {!isCompanion && (
          <input
            type="checkbox"
            checked={shot.selected}
            onChange={() => onToggleSelect(index)}
            className="h-4 w-4 rounded border-sb-border-stronger bg-transparent accent-sb-brand-500"
          />
        )}
      </TableCell>

      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {displayName(shot.shot_type)}
          {isCompanion && (
            <Badge variant="secondary" className="text-[10px]">auto</Badge>
          )}
          {isSceneCategory && !isCompanion && onAnimationOverride && (
            <select
              value={shot.animation_override ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onAnimationOverride(index, val === '' ? null : val as 'regular' | 'complex');
              }}
              className="h-6 text-[10px] rounded border border-border bg-transparent px-1"
            >
              <option value="">Inherit ({animationComplexity ?? 'regular'})</option>
              <option value="regular">Override: Regular</option>
              <option value="complex">Override: Complex</option>
            </select>
          )}
        </div>
      </TableCell>

      <TableCell className="w-48">
        {isCompanion ? (
          <div className="text-xs text-muted-foreground">—</div>
        ) : (
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.max(0, Math.min(100, shot.percentage))}
              onChange={(event) => onPercentageChange(index, Number(event.target.value))}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">{shot.percentage.toFixed(0)}%</div>
          </div>
        )}
      </TableCell>

      <TableCell>
        {isCompanion ? (
          <span className="tabular-nums text-muted-foreground">{shot.quantity}</span>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onUpdateQuantity(index, shot.quantity - 1)}
                disabled={shot.quantity <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-9 text-center tabular-nums">{shot.quantity}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onUpdateQuantity(index, shot.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {shot.manualOverride && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-amber-500">manual</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px]"
                  onClick={() => onUnlockManual(index)}
                >
                  auto
                </Button>
              </div>
            )}
          </>
        )}
      </TableCell>

      <TableCell className="tabular-nums text-muted-foreground">
        {shot.base_hours_each.toFixed(1)}h
      </TableCell>

      <TableCell>
        {isCompanion ? (
          <span className="tabular-nums text-muted-foreground">—</span>
        ) : (
          <Input
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            value={shot.efficiency_multiplier}
            onChange={(event) => onUpdateEfficiency(index, Number(event.target.value))}
            className="w-20 text-center tabular-nums"
          />
        )}
      </TableCell>

      <TableCell className="tabular-nums font-medium">
        {shot.adjusted_hours.toFixed(1)}h
        {showPricing && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({formatCurrency(shot.adjusted_hours * hourlyRate)})
          </span>
        )}
      </TableCell>

      <TableCell className="w-10">
        {!isCompanion && (
          <Button variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
            <X className="h-4 w-4 text-muted-foreground hover:text-red-400" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
});
