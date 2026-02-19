import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { QuoteListItem } from '@/hooks/useQuotes';
import type { QuoteStatus } from '../../../../shared/types';

const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'info' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_approval: { label: 'Pending Approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  sent: { label: 'Sent', variant: 'info' },
  archived: { label: 'Archived', variant: 'outline' },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface QuoteCardProps {
  quote: QuoteListItem;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const navigate = useNavigate();
  const statusConfig = STATUS_CONFIG[quote.status];

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-sb-border-muted"
      onClick={() => navigate(`/quotes/${quote.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{quote.client_name}</h3>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{quote.project_name}</p>
          </div>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {quote.latest_version && (
            <span>
              v{quote.latest_version.version_number} &middot; {quote.latest_version.duration_seconds}s &middot; {quote.latest_version.total_hours} hrs
            </span>
          )}
          <div className="flex items-center justify-between">
            <span>{quote.version_count} {quote.version_count === 1 ? 'version' : 'versions'}</span>
            <span>{formatDate(quote.created_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
