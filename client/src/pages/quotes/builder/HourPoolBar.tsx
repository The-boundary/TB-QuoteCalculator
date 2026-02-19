import { cn } from '@/lib/utils';

interface HourPoolBarProps {
  used: number;
  budget: number;
}

export function HourPoolBar({ used, budget }: HourPoolBarProps) {
  const percentage = budget > 0 ? (used / budget) * 100 : 0;
  const clampedWidth = Math.min(100, percentage);
  const remaining = budget - used;
  const isOver = remaining < 0;

  const barColor =
    percentage > 100
      ? 'bg-red-500'
      : percentage >= 80
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  const textColor = isOver ? 'text-red-400' : 'text-emerald-400';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Hour Pool: <span className="text-foreground font-medium">{used.toFixed(1)} / {budget.toFixed(1)} hrs</span>
        </span>
        <span className={cn('font-medium', textColor)}>
          {isOver
            ? `${Math.abs(remaining).toFixed(1)} hrs over budget`
            : `${remaining.toFixed(1)} hrs remaining`}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
    </div>
  );
}
