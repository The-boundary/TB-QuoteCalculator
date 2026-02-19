import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock, Film, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { QuoteVersionWithShots } from '../../../../shared/types';

interface VersionCardProps {
  version: QuoteVersionWithShots;
  quoteId: string;
}

export function VersionCard({ version, quoteId }: VersionCardProps) {
  const navigate = useNavigate();

  const usagePercent =
    version.pool_budget_hours > 0
      ? Math.min((version.total_hours / version.pool_budget_hours) * 100, 100)
      : 0;

  const isOverBudget = version.total_hours > version.pool_budget_hours;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-sb-brand/50"
      onClick={() => navigate(`/quotes/${quoteId}/versions/${version.id}/build`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Version {version.version_number}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {format(new Date(version.created_at), 'dd MMM yyyy, HH:mm')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {version.duration_seconds}s
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Film className="h-3.5 w-3.5" />
            {version.shots.length} shot type{version.shots.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Hours</span>
            <span className={isOverBudget ? 'text-red-400 font-medium' : 'text-foreground'}>
              {version.total_hours} / {version.pool_budget_hours} hrs
            </span>
          </div>
          <Progress
            value={usagePercent}
            className="h-1.5"
            indicatorClassName={isOverBudget ? 'bg-red-500' : undefined}
          />
        </div>

        {version.notes && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <FileText className="mt-0.5 h-3 w-3 shrink-0" />
            {version.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
