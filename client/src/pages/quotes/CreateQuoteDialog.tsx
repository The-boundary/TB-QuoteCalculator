import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useCreateQuote } from '@/hooks/useQuotes';
import { useRateCards } from '@/hooks/useRateCards';

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateQuoteDialog({ open, onOpenChange }: CreateQuoteDialogProps) {
  const navigate = useNavigate();
  const { data: rateCards } = useRateCards();
  const createQuote = useCreateQuote();

  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [rateCardId, setRateCardId] = useState('');

  // Set the default rate card when rate cards load
  useEffect(() => {
    if (rateCards && rateCards.length > 0 && !rateCardId) {
      const defaultCard = rateCards.find((rc) => rc.is_default) ?? rateCards[0];
      if (defaultCard) {
        setRateCardId(defaultCard.id);
      }
    }
  }, [rateCards, rateCardId]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setClientName('');
      setProjectName('');
      if (rateCards && rateCards.length > 0) {
        const defaultCard = rateCards.find((rc) => rc.is_default) ?? rateCards[0];
        setRateCardId(defaultCard?.id ?? '');
      }
    }
  }, [open, rateCards]);

  const canSubmit = clientName.trim() !== '' && projectName.trim() !== '' && rateCardId !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const newQuote = await createQuote.mutateAsync({
      client_name: clientName.trim(),
      project_name: projectName.trim(),
      rate_card_id: rateCardId,
    });

    onOpenChange(false);
    navigate(`/quotes/${newQuote.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Quote</DialogTitle>
            <DialogDescription>Create a new film production quote.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                placeholder="e.g. BBC Studios"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="e.g. Planet Earth IV"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rate-card">Rate Card</Label>
              <Select value={rateCardId} onValueChange={setRateCardId}>
                <SelectTrigger id="rate-card">
                  <SelectValue placeholder="Select a rate card" />
                </SelectTrigger>
                <SelectContent>
                  {rateCards?.map((rc) => (
                    <SelectItem key={rc.id} value={rc.id}>
                      {rc.name}{rc.is_default ? ' (Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || createQuote.isPending}
            >
              {createQuote.isPending ? 'Creating...' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
