import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, LayoutGrid, List, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCreateVersion, useQuote, useUpdateQuoteStatus } from '@/hooks/useQuotes';
import { VersionCard } from './VersionCard';
import { STATUS_CONFIG } from './statusConfig';
import type { QuoteStatus } from '../../../../shared/types';

interface Transition {
  target: QuoteStatus;
  label: string;
}

function getTransitions(current: QuoteStatus): Transition[] {
  if (current === 'archived') return [];

  const transitions: Transition[] = [];
  if (current === 'draft') transitions.push({ target: 'negotiating', label: 'Start Negotiation' });
  if (current === 'negotiating') {
    transitions.push({ target: 'awaiting_approval', label: 'Send for Approval' });
    transitions.push({ target: 'draft', label: 'Return to Draft' });
  }
  if (current === 'awaiting_approval') {
    transitions.push({ target: 'confirmed', label: 'Mark Confirmed' });
    transitions.push({ target: 'draft', label: 'Return to Draft' });
  }
  if (current === 'confirmed') transitions.push({ target: 'draft', label: 'Reopen as Draft' });
  transitions.push({ target: 'archived', label: 'Archive' });
  return transitions;
}

export function QuoteDetailPage() {
  const navigate = useNavigate();
  const { id: projectId, quoteId } = useParams<{ id: string; quoteId: string }>();
  const { data: quote, isLoading } = useQuote(quoteId);
  const updateStatus = useUpdateQuoteStatus();
  const createVersion = useCreateVersion();
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const sortedVersions = useMemo(
    () => [...(quote?.versions ?? [])].sort((a, b) => b.version_number - a.version_number),
    [quote?.versions],
  );

  async function onStatusChange(status: QuoteStatus) {
    if (!quoteId) return;
    await updateStatus.mutateAsync({ id: quoteId, status });
  }

  async function onNewVersion() {
    if (!quote || !quoteId || !projectId || sortedVersions.length === 0) return;

    const latest = sortedVersions[0];
    // Group shots by module_id for proper module-based cloning
    const shotsByModuleId = new Map<string, typeof latest.shots>();
    for (const shot of latest.shots) {
      const mid = shot.module_id ?? (latest.modules?.[0]?.id ?? 'default');
      if (!shotsByModuleId.has(mid)) shotsByModuleId.set(mid, []);
      shotsByModuleId.get(mid)!.push(shot);
    }

    const newVersion = await createVersion.mutateAsync({
      quoteId,
      duration_seconds: latest.duration_seconds,
      hourly_rate: latest.hourly_rate,
      pool_budget_hours: latest.pool_budget_hours,
      pool_budget_amount: latest.pool_budget_amount,
      modules: (latest.modules ?? []).map((mod) => ({
        name: mod.name,
        module_type: mod.module_type,
        duration_seconds: mod.duration_seconds ?? 60,
        animation_complexity: mod.animation_complexity,
        sort_order: mod.sort_order,
        shots: (shotsByModuleId.get(mod.id) ?? []).map((shot) => ({
          shot_type: shot.shot_type,
          percentage: shot.percentage,
          quantity: shot.quantity,
          base_hours_each: shot.base_hours_each,
          efficiency_multiplier: shot.efficiency_multiplier,
          sort_order: shot.sort_order,
          is_companion: shot.is_companion ?? false,
          animation_override: shot.animation_override ?? null,
        })),
      })),
      line_items: (latest.line_items ?? []).map((item) => ({
        name: item.name,
        category: item.category,
        hours_each: item.hours_each,
        quantity: item.quantity,
        notes: item.notes,
        sort_order: item.sort_order,
      })),
    });

    navigate(`/projects/${projectId}/quotes/${quoteId}/versions/${newVersion.id}/build`);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!quote || !projectId || !quoteId) {
    return <p className="text-sm text-muted-foreground">Quote not found.</p>;
  }

  const currentStatus = STATUS_CONFIG[quote.status];
  const transitions = getTransitions(quote.status);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Project
      </Button>

      <PageHeader
        title={`${quote.project?.name ?? 'Quote'} — ${quote.mode}`}
        description={quote.rate_card ? `Rate card: ${quote.rate_card.name}` : undefined}
        actions={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button">
                  <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="text-sm font-medium">Status History</div>
                <div className="mt-2 space-y-2">
                  {(quote.status_log ?? []).map((entry) => (
                    <div
                      key={entry.id}
                      className="border-b border-border pb-2 last:border-0 last:pb-0"
                    >
                      <div className="text-sm font-medium capitalize">
                        {entry.new_status.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        by {entry.changed_by_email ?? 'Unknown'} ·{' '}
                        {format(new Date(entry.changed_at), 'dd MMM yyyy HH:mm')}
                      </div>
                    </div>
                  ))}
                  {(quote.status_log ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No history entries yet.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={updateStatus.isPending}>
                    Change Status
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {transitions.map((transition, index) => (
                    <div key={transition.target}>
                      {transition.target === 'archived' && index > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={() => onStatusChange(transition.target)}
                        className={
                          transition.target === 'archived'
                            ? 'text-red-400 focus:text-red-300'
                            : undefined
                        }
                      >
                        {transition.label}
                      </DropdownMenuItem>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {sortedVersions.length > 0 && (
              <Button size="sm" onClick={onNewVersion} disabled={createVersion.isPending}>
                <Plus className="h-4 w-4" />
                New Version
              </Button>
            )}
          </>
        }
      />

      {sortedVersions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No versions yet.</p>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedVersions.map((version, index) => (
                <VersionCard
                  key={version.id}
                  version={version}
                  quoteId={quote.id}
                  projectId={projectId}
                  isLatest={index === 0}
                />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Shots</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVersions.map((version, index) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">
                      V{version.version_number}
                      {index === 0 && (
                        <Badge
                          variant="default"
                          className="ml-2 bg-sb-brand text-white text-[10px]"
                        >
                          Latest
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{version.duration_seconds}s</TableCell>
                    <TableCell>{version.shots.length}</TableCell>
                    <TableCell>{version.total_hours} hrs</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(version.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/projects/${projectId}/quotes/${quoteId}/versions/${version.id}/build`,
                          )
                        }
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
