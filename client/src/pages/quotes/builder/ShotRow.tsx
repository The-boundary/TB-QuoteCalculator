import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableRow, TableCell } from '@/components/ui/table';
import { Minus, Plus, X } from 'lucide-react';
import type { BuilderShot } from './useBuilderState';

interface ShotRowProps {
  shot: BuilderShot;
  index: number;
  onToggleSelect: (index: number) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onUpdateEfficiency: (index: number, multiplier: number) => void;
  onRemove: (index: number) => void;
}

export function ShotRow({
  shot,
  index,
  onToggleSelect,
  onUpdateQuantity,
  onUpdateEfficiency,
  onRemove,
}: ShotRowProps) {
  const totalHrs = shot.quantity * shot.base_hours_each * shot.efficiency_multiplier;

  return (
    <TableRow>
      {/* Checkbox */}
      <TableCell className="w-10">
        <input
          type="checkbox"
          checked={shot.selected}
          onChange={() => onToggleSelect(index)}
          className="h-4 w-4 rounded border-sb-border-stronger bg-transparent accent-sb-brand-500"
        />
      </TableCell>

      {/* Shot type */}
      <TableCell className="font-medium">{shot.shot_type}</TableCell>

      {/* Quantity stepper */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onUpdateQuantity(index, shot.quantity - 1)}
            disabled={shot.quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center tabular-nums">{shot.quantity}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onUpdateQuantity(index, shot.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>

      {/* Hrs/ea */}
      <TableCell className="tabular-nums text-muted-foreground">
        {shot.base_hours_each}
      </TableCell>

      {/* Efficiency */}
      <TableCell>
        <Input
          type="number"
          step={0.1}
          min={0.1}
          max={5.0}
          value={shot.efficiency_multiplier}
          onChange={(e) => onUpdateEfficiency(index, parseFloat(e.target.value) || 1.0)}
          className="w-20 text-center tabular-nums"
        />
      </TableCell>

      {/* Total hrs */}
      <TableCell className="tabular-nums font-medium">{totalHrs.toFixed(1)}</TableCell>

      {/* Remove */}
      <TableCell className="w-10">
        <Button variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
          <X className="h-4 w-4 text-muted-foreground hover:text-red-400" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
