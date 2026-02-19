import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuote, useUpdateQuoteStatus, useCreateVersion } from '@/hooks/useQuotes';
import { VersionCard } from './VersionCard';
import type { QuoteStatus } from '../../../../shared/types';

const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: 'default' | 'secondary' | 'warning' | 'success' | 'info' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_approval: { label: 'Pending Approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  sent: { label: 'Sent', variant: 'info' },
  archived: { label: 'Archived', variant: 'destructive' },
};

interface StatusTransition {
  target: QuoteStatus;
  label: string;
}

function getStatusTransitions(current: QuoteStatus): StatusTransition[] {
  const transitions: StatusTransition[] = [];

  switch (current) {
    case 'draft':
      transitions.push({ target: 'pending_approval', label: 'Submit for Approval' });
      break;
    case 'pending_approval':
      transitions.push({ target: 'approved', label: 'Approve' });
      transitions.push({ target: 'draft', label: 'Reject / Return to Draft' });
      break;
    case 'approved':
      transitions.push({ target: 'sent', label: 'Mark as Sent' });
      break;
  }

  if (current !== 'archived') {
    transitions.push({ target: 'archived', label: 'Archive' });
  }

  return transitions;
}

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const updateStatus = useUpdateQuoteStatus();
  const createVersion = useCreateVersion();

  async function handleStatusChange(status: QuoteStatus) {
    if (!id) return;
    await updateStatus.mutateAsync({ id, status });
  }

  async function handleNewVersion() {
    if (!id || !quote || quote.versions.length === 0) return;

    const sorted = [...quote.versions].sort((a, b) => b.version_number - a.version_number);
    const latest = sorted[0];

    const newVersion = await createVersion.mutateAsync({
      quoteId: id,
      duration_seconds: latest.duration_seconds,
      notes: null as unknown as undefined,
      shots: latest.shots.map((s) => ({
        shot_type: s.shot_type,
        quantity: s.quantity,
        base_hours_each: s.base_hours_each,
        efficiency_multiplier: s.efficiency_multiplier,
        sort_order: s.sort_order,
      })),
    });

    navigate(`/quotes/${id}/versions/${newVersion.id}/build`);
  }

  if (isLoading) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-[38px] w-24" />
              <Skeleton className="h-[38px] w-36" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!quote) {
    return (
      <>
        <div className="text-sm text-muted-foreground">Quote not found.</div>
      </>
    );
  }

  const statusConfig = STATUS_CONFIG[quote.status];
  const transitions = getStatusTransitions(quote.status);
  const sortedVersions = [...quote.versions].sort((a, b) => b.version_number - a.version_number);

  return (
    <>
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotes
        </Button>

        <PageHeader
          title={`${quote.client_name} \u2014 ${quote.project_name}`}
          description={quote.rate_card ? `Rate card: ${quote.rate_card.name}` : undefined}
          actions={
            <>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>

              {transitions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={updateStatus.isPending}>
                      Change Status
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {transitions.map((t, i) => (
                      <span key={t.target}>
                        {t.target === 'archived' && i > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(t.target)}
                          className={t.target === 'archived' ? 'text-red-400 focus:text-red-300' : undefined}
                        >
                          {t.label}
                        </DropdownMenuItem>
                      </span>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {quote.versions.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleNewVersion}
                  disabled={createVersion.isPending}
                >
                  <Plus className="h-4 w-4" />
                  New Version
                </Button>
              )}
            </>
          }
        />

        {sortedVersions.length === 0 ? (
          <div className="mt-8 text-sm text-muted-foreground">
            No versions yet. Create a version to start building this quote.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedVersions.map((version) => (
              <VersionCard key={version.id} version={version} quoteId={quote.id} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
