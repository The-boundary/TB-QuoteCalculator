import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link as LinkIcon, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKantataSearch } from '@/hooks/useKantata';
import { useCreateQuote } from '@/hooks/useQuotes';
import { useRateCards } from '@/hooks/useRateCards';
import { useLinkProject, useProject } from '@/hooks/useProjects';
import type { QuoteMode } from '../../../../shared/types';

function statusVariant(status: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'awaiting_approval') return 'info';
  if (status === 'negotiating') return 'warning';
  return 'secondary';
}

function LinkToKantataDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const linkProject = useLinkProject();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string>('');
  const { data, isFetching } = useKantataSearch(search);

  async function submit() {
    if (!selected) return;
    await linkProject.mutateAsync({ id: projectId, kantata_id: selected });
    onOpenChange(false);
    setSelected('');
    setSearch('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to Kantata</DialogTitle>
          <DialogDescription>Select a workspace to attach this project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by workspace title or ID"
          />
          <div className="max-h-64 overflow-y-auto rounded-md border border-border p-2">
            {search.length < 2 ? (
              <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>
            ) : isFetching ? (
              <p className="text-sm text-muted-foreground">Searching...</p>
            ) : data && data.length > 0 ? (
              <div className="space-y-2">
                {data.map((workspace) => (
                  <button
                    key={workspace.kantata_id}
                    type="button"
                    onClick={() => setSelected(workspace.kantata_id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selected === workspace.kantata_id
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent hover:bg-accent/50'
                    }`}
                  >
                    <p className="font-medium">{workspace.title}</p>
                    <p className="text-xs text-muted-foreground">#{workspace.kantata_id}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No results.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!selected || linkProject.isPending}>
            {linkProject.isPending ? 'Linking...' : 'Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewQuoteDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createQuote = useCreateQuote();
  const { data: rateCards } = useRateCards();
  const [mode, setMode] = useState<QuoteMode>('retainer');
  const [rateCardId, setRateCardId] = useState('');

  const defaultRateCardId = useMemo(
    () => rateCards?.find((card) => card.is_default)?.id ?? rateCards?.[0]?.id ?? '',
    [rateCards],
  );

  const resolvedRateCardId = rateCardId || defaultRateCardId;

  async function submit() {
    if (!resolvedRateCardId) return;
    const quote = await createQuote.mutateAsync({
      project_id: projectId,
      mode,
      rate_card_id: resolvedRateCardId,
    });
    onOpenChange(false);
    const firstVersion = quote.versions[0];
    navigate(`/projects/${projectId}/quotes/${quote.id}/versions/${firstVersion.id}/build`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Quote</DialogTitle>
          <DialogDescription>Create a quote in retainer or budget mode.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'retainer' ? 'default' : 'outline'}
                onClick={() => setMode('retainer')}
              >
                Retainer
              </Button>
              <Button
                type="button"
                variant={mode === 'budget' ? 'default' : 'outline'}
                onClick={() => setMode('budget')}
              >
                Budget
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Rate Card</Label>
            <Select value={resolvedRateCardId} onValueChange={setRateCardId}>
              <SelectTrigger>
                <SelectValue placeholder="Select rate card" />
              </SelectTrigger>
              <SelectContent>
                {rateCards?.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!resolvedRateCardId || createQuote.isPending}>
            {createQuote.isPending ? 'Creating...' : 'Create Quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, error } = useProject(id);
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project...</p>;
  }

  if (error || !project || !id) {
    return <p className="text-sm text-destructive">Failed to load project.</p>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Button>

      <PageHeader
        title={project.name}
        description={project.development_name}
        actions={
          <>
            {project.kantata_id ? (
              <Badge variant="info">Kantata #{project.kantata_id}</Badge>
            ) : (
              <Button variant="outline" onClick={() => setLinkOpen(true)}>
                <LinkIcon className="h-4 w-4" />
                Link to Kantata
              </Button>
            )}
            <Button onClick={() => setNewQuoteOpen(true)}>
              <Plus className="h-4 w-4" />
              New Quote
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {project.quotes.map((quote) => (
          <Card
            key={quote.id}
            className="cursor-pointer transition-colors hover:border-sb-brand/60"
            onClick={() => navigate(`/projects/${project.id}/quotes/${quote.id}`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant={quote.mode === 'budget' ? 'info' : 'secondary'}>{quote.mode}</Badge>
                <Badge variant={statusVariant(quote.status) as 'info' | 'secondary' | 'warning' | 'success'}>
                  {quote.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {quote.latest_version ? (
                <>
                  <p>v{quote.latest_version.version_number}</p>
                  <p>{quote.latest_version.duration_seconds}s</p>
                  <p>{quote.latest_version.total_hours}h</p>
                </>
              ) : (
                <p>No versions yet</p>
              )}
              <p>{quote.version_count} versions</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {project.quotes.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No quotes yet. Create your first quote.</p>
      )}

      <NewQuoteDialog projectId={id} open={newQuoteOpen} onOpenChange={setNewQuoteOpen} />
      <LinkToKantataDialog projectId={id} open={linkOpen} onOpenChange={setLinkOpen} />
    </>
  );
}
