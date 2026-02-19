import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface TotalsSummaryProps {
  totalShotHours: number;
  editingHours: number;
  totalHours: number;
  poolBudgetHours: number;
  remaining: number;
}

export function TotalsSummary({
  totalShotHours,
  editingHours,
  totalHours,
  poolBudgetHours,
  remaining,
}: TotalsSummaryProps) {
  const isOver = remaining < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label="Shots Total" value={`${totalShotHours.toFixed(1)} hrs`} />
        <Row label="Post-Production" value={`${editingHours.toFixed(1)} hrs`} />

        <Separator />

        <Row label="TOTAL" value={`${totalHours.toFixed(1)} hrs`} bold />
        <Row label="POOL BUDGET" value={`${poolBudgetHours.toFixed(1)} hrs`} />
        <Row
          label="REMAINING"
          value={`${isOver ? '-' : ''}${Math.abs(remaining).toFixed(1)} hrs`}
          bold
          className={isOver ? 'text-red-400' : 'text-emerald-400'}
        />
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn('text-muted-foreground', bold && 'font-semibold text-foreground')}>
        {label}
      </span>
      <span className={cn('tabular-nums', bold && 'font-semibold', className)}>
        {value}
      </span>
    </div>
  );
}
