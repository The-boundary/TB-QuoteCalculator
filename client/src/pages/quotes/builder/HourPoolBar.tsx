import { cn } from '@/lib/utils';

interface HourPoolBarProps {
  used: number;
  budget: number | null;
  showPricing?: boolean;
  hourlyRate?: number;
}

export function HourPoolBar({
  used,
  budget,
  showPricing = false,
  hourlyRate = 0,
}: HourPoolBarProps) {
  if (budget === null || budget <= 0) {
    return null;
  }

  const percentage = (used / budget) * 100;
  const clampedWidth = Math.min(100, percentage);
  const remaining = budget - used;
  const isOver = remaining < 0;

  const barColor =
    percentage > 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isOver ? 'text-red-400' : 'text-emerald-400';

  const usedCost = used * hourlyRate;
  const budgetCost = budget * hourlyRate;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Hour Pool:{' '}
          <span className="font-medium text-foreground">
            {used.toFixed(1)} / {budget.toFixed(1)} hrs
            {showPricing && (
              <span className="ml-1 text-xs text-muted-foreground">
                (${usedCost.toFixed(0)} / ${budgetCost.toFixed(0)})
              </span>
            )}
          </span>
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
