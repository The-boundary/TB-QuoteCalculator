import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { QuoteMode } from '../../../../shared/types';

export function NewQuoteDialog({
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
