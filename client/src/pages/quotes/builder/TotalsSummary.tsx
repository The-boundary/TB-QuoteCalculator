import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';

interface TotalsSummaryProps {
  totalShotHours: number;
  editingHours: number;
  totalLineItemHours: number;
  totalHours: number;
  poolBudgetHours: number | null;
  remaining: number | null;
  showPricing: boolean;
  hourlyRate: number;
}

export function TotalsSummary({
  totalShotHours,
  editingHours,
  totalLineItemHours,
  totalHours,
  poolBudgetHours,
  remaining,
  showPricing,
  hourlyRate,
}: TotalsSummaryProps) {
  const isOver = remaining !== null && remaining < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row
          label="Shots Total"
          hours={totalShotHours}
          showPricing={showPricing}
          cost={totalShotHours * hourlyRate}
        />
        <Row
          label="Post-Production"
          hours={editingHours}
          showPricing={showPricing}
          cost={editingHours * hourlyRate}
        />
        {totalLineItemHours > 0 && (
          <Row
            label="Additional Items"
            hours={totalLineItemHours}
            showPricing={showPricing}
            cost={totalLineItemHours * hourlyRate}
          />
        )}

        <Separator />

        <Row
          label="TOTAL"
          hours={totalHours}
          bold
          showPricing={showPricing}
          cost={totalHours * hourlyRate}
        />

        {poolBudgetHours !== null && (
          <Row
            label="POOL BUDGET"
            hours={poolBudgetHours}
            showPricing={showPricing}
            cost={poolBudgetHours * hourlyRate}
          />
        )}

        {remaining !== null && (
          <Row
            label="REMAINING"
            hours={Math.abs(remaining)}
            bold
            showPricing={showPricing}
            cost={Math.abs(remaining) * hourlyRate}
            className={isOver ? 'text-red-400' : 'text-emerald-400'}
            sign={isOver ? '-' : ''}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  hours,
  cost,
  showPricing,
  bold,
  className,
  sign,
}: {
  label: string;
  hours: number;
  cost: number;
  showPricing: boolean;
  bold?: boolean;
  className?: string;
  sign?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn('text-muted-foreground', bold && 'font-semibold text-foreground')}>
        {label}
      </span>
      <span className={cn('tabular-nums', bold && 'font-semibold', className)}>
        {sign ?? ''}
        {hours.toFixed(1)} hrs
        {showPricing && (
          <span className="ml-1 text-xs text-muted-foreground">({formatCurrency(cost)})</span>
        )}
      </span>
    </div>
  );
}
