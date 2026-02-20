import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!open) return;
    setProjectId(projects?.[0]?.id ?? '');
    setRateCardId(rateCards?.find((rc) => rc.is_default)?.id ?? rateCards?.[0]?.id ?? '');
    setMode('retainer');
  }, [open, projects, rateCards]);

  const canSubmit = Boolean(projectId && rateCardId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const quote = await createQuote.mutateAsync({
      project_id: projectId,
      mode,
      rate_card_id: rateCardId,
    });

    onOpenChange(false);
    navigate(`/projects/${projectId}/quotes/${quote.id}`);
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
              <Select value={projectId} onValueChange={setProjectId}>
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
              <Select value={rateCardId} onValueChange={setRateCardId}>
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
