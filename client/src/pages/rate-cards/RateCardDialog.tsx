import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateRateCard, useUpdateRateCard } from '@/hooks/useRateCards';
import type { RateCard } from '../../../../shared/types';

interface RateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateCard?: RateCard | null;
}

export function RateCardDialog({ open, onOpenChange, rateCard }: RateCardDialogProps) {
  const createRateCard = useCreateRateCard();
  const updateRateCard = useUpdateRateCard();
  const isEdit = !!rateCard;

  const [name, setName] = useState('');
  const [hoursPerSecond, setHoursPerSecond] = useState('');
  const [editingHours, setEditingHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('125');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(rateCard?.name ?? '');
    setHoursPerSecond(rateCard?.hours_per_second?.toString() ?? '');
    setEditingHours(rateCard?.editing_hours_per_30s?.toString() ?? '');
    setHourlyRate(rateCard?.hourly_rate?.toString() ?? '125');
    setIsDefault(rateCard?.is_default ?? false);
  }, [open, rateCard]);

  const canSubmit = name.trim() !== '' && hoursPerSecond !== '' && !isNaN(Number(hoursPerSecond));
  const isPending = createRateCard.isPending || updateRateCard.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = {
      name: name.trim(),
      hours_per_second: Number(hoursPerSecond),
      editing_hours_per_30s: editingHours ? Number(editingHours) : undefined,
      hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
      is_default: isDefault,
    };

    if (isEdit && rateCard) {
      await updateRateCard.mutateAsync({ id: rateCard.id, ...payload });
    } else {
      await createRateCard.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Rate Card' : 'New Rate Card'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update rate card metadata.' : 'Create a new production rate card.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rc-name">Name</Label>
              <Input
                id="rc-name"
                placeholder="e.g. Standard 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rc-hps">Hours per Second</Label>
              <Input
                id="rc-hps"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 1.5"
                value={hoursPerSecond}
                onChange={(e) => setHoursPerSecond(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rc-eh30">Editing Hours per 30s</Label>
              <Input
                id="rc-eh30"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 4"
                value={editingHours}
                onChange={(e) => setEditingHours(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rc-hourly">Hourly Rate ($/hr)</Label>
              <Input
                id="rc-hourly"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 125"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="rc-default" checked={isDefault} onCheckedChange={setIsDefault} />
              <Label htmlFor="rc-default">Set as default rate card</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Rate Card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
