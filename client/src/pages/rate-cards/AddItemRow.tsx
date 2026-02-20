import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { TableRow, TableCell } from '@/components/ui/table';
import { useAddRateCardItem } from '@/hooks/useRateCards';
import { CATEGORIES, categoryLabel } from './constants';

interface AddItemRowProps {
  rateCardId: string;
  nextSortOrder: number;
}

export function AddItemRow({ rateCardId, nextSortOrder }: AddItemRowProps) {
  const addItem = useAddRateCardItem();
  const [adding, setAdding] = useState(false);
  const [shotType, setShotType] = useState('');
  const [category, setCategory] = useState<string>('scene');
  const [hours, setHours] = useState('');

  function reset() {
    setShotType('');
    setCategory('scene');
    setHours('');
    setAdding(false);
  }

  async function handleSave() {
    if (!shotType.trim()) return;
    await addItem.mutateAsync({
      rateCardId,
      shot_type: shotType.trim(),
      category,
      hours: Number(hours) || 0,
      sort_order: nextSortOrder,
    });
    reset();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') reset();
  }

  if (!adding) {
    return (
      <TableRow>
        <TableCell colSpan={4}>
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" />
            Add Item
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          placeholder="Shot type"
          value={shotType}
          onChange={(e) => setShotType(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8"
          autoFocus
        />
      </TableCell>
      <TableCell>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {categoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="Hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleSave} disabled={addItem.isPending}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
