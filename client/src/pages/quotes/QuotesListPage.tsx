import { useState, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuotes } from '@/hooks/useQuotes';
import { QuoteCard } from './QuoteCard';
import { CreateQuoteDialog } from './CreateQuoteDialog';
import type { QuoteStatus } from '../../../../shared/types';

type StatusFilter = 'all' | QuoteStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'confirmed', label: 'Confirmed' },
];

export function QuotesListPage() {
  const { data: quotes, isLoading, error } = useQuotes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    let result = quotes;

    if (statusFilter !== 'all') {
      result = result.filter((q) => q.status === statusFilter);
    }

    const term = search.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (q) =>
          q.project_name.toLowerCase().includes(term) ||
          q.development_name.toLowerCase().includes(term) ||
          (q.kantata_id ?? '').includes(term),
      );
    }

    return result;
  }, [quotes, statusFilter, search]);

  return (
    <>
      <PageHeader
        title="Quote List"
        description="Simple list of all quotes in the database"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Quote
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 text-sm text-destructive">
            Failed to load quotes. Please try again.
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            {quotes && quotes.length > 0
              ? 'No quotes match your filters.'
              : 'No quotes yet. Create your first quote.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredQuotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>
        )}
      </div>

      <CreateQuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
