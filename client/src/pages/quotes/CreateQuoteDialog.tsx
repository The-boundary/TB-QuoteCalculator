import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateQuote } from '@/hooks/useQuotes';
import { useRateCards } from '@/hooks/useRateCards';
import { useProjects } from '@/hooks/useProjects';
import type { QuoteMode } from '../../../../shared/types';

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateQuoteDialog({ open, onOpenChange }: CreateQuoteDialogProps) {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: rateCards } = useRateCards();
  const createQuote = useCreateQuote();

  const [projectId, setProjectId] = useState('');
  const [rateCardId, setRateCardId] = useState('');
  const [mode, setMode] = useState<QuoteMode>('retainer');

  const defaultProjectId = useMemo(() => projects?.[0]?.id ?? '', [projects]);
  const defaultRateCardId = useMemo(
    () => rateCards?.find((rateCard) => rateCard.is_default)?.id ?? rateCards?.[0]?.id ?? '',
    [rateCards],
  );

  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId);
    setRateCardId(defaultRateCardId);
    setMode('retainer');
  }, [open, defaultProjectId, defaultRateCardId]);

  const finalProjectId = projectId || defaultProjectId;
  const finalRateCardId = rateCardId || defaultRateCardId;
  const canSubmit = Boolean(finalProjectId && finalRateCardId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const quote = await createQuote.mutateAsync({
      project_id: finalProjectId,
      mode,
      rate_card_id: finalRateCardId,
    });

    onOpenChange(false);
    navigate(`/projects/${finalProjectId}/quotes/${quote.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New Quote</DialogTitle>
            <DialogDescription>Create a quote in the new project-based model.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={finalProjectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Select value={finalRateCardId} onValueChange={setRateCardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rate card" />
                </SelectTrigger>
                <SelectContent>
                  {rateCards?.map((rateCard) => (
                    <SelectItem key={rateCard.id} value={rateCard.id}>
                      {rateCard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || createQuote.isPending}>
              {createQuote.isPending ? 'Creating...' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
