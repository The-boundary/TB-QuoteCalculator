import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { useArchiveQuote, type QuoteListItem } from '@/hooks/useQuotes';
import type { QuoteStatus } from '../../../../shared/types';

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; variant: 'secondary' | 'warning' | 'success' | 'info' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'secondary' },
  negotiating: { label: 'Negotiating', variant: 'warning' },
  awaiting_approval: { label: 'Awaiting Approval', variant: 'info' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  archived: { label: 'Archived', variant: 'outline' },
};

interface QuoteCardProps {
  quote: QuoteListItem;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const navigate = useNavigate();
  const deleteQuote = useArchiveQuote();
  const statusConfig = STATUS_CONFIG[quote.status];

  // Triple-click delete: 0 = idle, 1 = first click (warning), 2 = second click (confirm once more)
  const [deleteClicks, setDeleteClicks] = useState(0);

  // Auto-reset after 3 seconds of inactivity
  useEffect(() => {
    if (deleteClicks === 0) return;
    const timer = setTimeout(() => setDeleteClicks(0), 3000);
    return () => clearTimeout(timer);
  }, [deleteClicks]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (deleteClicks < 2) {
        setDeleteClicks((prev) => prev + 1);
      } else {
        // Third click — actually delete
        deleteQuote.mutate(quote.id);
      }
    },
    [deleteClicks, deleteQuote, quote.id],
  );

  const deleteLabel =
    deleteClicks === 0 ? undefined : deleteClicks === 1 ? 'Click 2 more' : 'Click to confirm';

  const deleteVariant =
    deleteClicks === 0 ? 'ghost' : deleteClicks === 1 ? 'outline' : 'destructive';

  return (
    <Card
      className="group cursor-pointer transition-colors hover:border-sb-border-muted"
      onClick={() => navigate(`/projects/${quote.project_id}/quotes/${quote.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{quote.project_name}</h3>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {quote.development_name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            <Button
              size="icon-sm"
              variant={deleteVariant as 'ghost' | 'outline' | 'destructive'}
              className={`transition-opacity ${deleteClicks === 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
              onClick={handleDelete}
              disabled={deleteQuote.isPending}
              title={deleteClicks === 0 ? 'Delete quote' : deleteLabel}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {deleteClicks > 0 && (
          <p className="text-xs text-destructive mt-1 animate-in fade-in duration-150">
            {deleteClicks === 1
              ? 'Click delete 2 more times to confirm'
              : 'Click once more to permanently delete'}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {quote.latest_version && (
            <span>
              v{quote.latest_version.version_number} &middot;{' '}
              {quote.latest_version.duration_seconds}s &middot; {quote.latest_version.total_hours}{' '}
              hrs
            </span>
          )}
          <div className="flex items-center justify-between">
            <span>
              {quote.version_count} {quote.version_count === 1 ? 'version' : 'versions'}
            </span>
            <span>{formatDate(quote.created_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
