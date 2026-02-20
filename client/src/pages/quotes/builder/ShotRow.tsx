import { memo } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import type { BuilderShot } from './useBuilderState';

interface ShotRowProps {
  shot: BuilderShot;
  index: number;
  showPricing: boolean;
  hourlyRate: number;
  onToggleSelect: (index: number) => void;
  onPercentageChange: (index: number, percentage: number) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onUpdateEfficiency: (index: number, multiplier: number) => void;
  onRemove: (index: number) => void;
}

export const ShotRow = memo(function ShotRow({
  shot,
  index,
  showPricing,
  hourlyRate,
  onToggleSelect,
  onPercentageChange,
  onUpdateQuantity,
  onUpdateEfficiency,
  onRemove,
}: ShotRowProps) {
  return (
    <TableRow>
      <TableCell className="w-10">
        <input
          type="checkbox"
          checked={shot.selected}
          onChange={() => onToggleSelect(index)}
          className="h-4 w-4 rounded border-sb-border-stronger bg-transparent accent-sb-brand-500"
        />
      </TableCell>

      <TableCell className="font-medium">{shot.shot_type}</TableCell>

      <TableCell className="w-48">
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
      </TableCell>

      <TableCell>
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
          <Button variant="ghost" size="icon-sm" onClick={() => onUpdateQuantity(index, shot.quantity + 1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {shot.manualOverride && <span className="text-xs text-amber-500">manual</span>}
      </TableCell>

      <TableCell className="tabular-nums text-muted-foreground">{shot.base_hours_each.toFixed(1)}h</TableCell>

      <TableCell>
        <Input
          type="number"
          min={0.1}
          max={5}
          step={0.1}
          value={shot.efficiency_multiplier}
          onChange={(event) => onUpdateEfficiency(index, Number(event.target.value))}
          className="w-20 text-center tabular-nums"
        />
      </TableCell>

      <TableCell className="tabular-nums font-medium">
        {shot.adjusted_hours.toFixed(1)}h
        {showPricing && (
          <span className="ml-1 text-xs text-muted-foreground">
            (${(shot.adjusted_hours * hourlyRate).toFixed(0)})
          </span>
        )}
      </TableCell>

      <TableCell className="w-10">
        <Button variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
          <X className="h-4 w-4 text-muted-foreground hover:text-red-400" />
        </Button>
      </TableCell>
    </TableRow>
  );
});
