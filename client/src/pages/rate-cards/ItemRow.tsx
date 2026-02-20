import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { TableRow, TableCell } from '@/components/ui/table';
import { useUpdateRateCardItem, useDeleteRateCardItem } from '@/hooks/useRateCards';
import { CATEGORIES, categoryLabel } from './constants';
import type { RateCardItem } from '../../../../shared/types';

interface ItemRowProps {
  item: RateCardItem;
  rateCardId: string;
  isAdmin: boolean;
}

export function ItemRow({ item, rateCardId, isAdmin }: ItemRowProps) {
  const updateItem = useUpdateRateCardItem();
  const deleteItem = useDeleteRateCardItem();

  const [editing, setEditing] = useState(false);
  const [shotType, setShotType] = useState(item.shot_type);
  const [category, setCategory] = useState(item.category);
  const [hours, setHours] = useState(item.hours.toString());

  useEffect(() => {
    setShotType(item.shot_type);
    setCategory(item.category);
    setHours(item.hours.toString());
  }, [item.shot_type, item.category, item.hours]);

  function resetToItem() {
    setShotType(item.shot_type);
    setCategory(item.category);
    setHours(item.hours.toString());
    setEditing(false);
  }

  async function save() {
    if (!shotType.trim()) return;
    await updateItem.mutateAsync({
      rateCardId,
      itemId: item.id,
      shot_type: shotType.trim(),
      category,
      hours: Number(hours) || 0,
    });
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') resetToItem();
  }

  if (editing && isAdmin) {
    return (
      <TableRow>
        <TableCell>
          <Input
            value={shotType}
            onChange={(e) => setShotType(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8"
            autoFocus
          />
        </TableCell>
        <TableCell>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as RateCardItem['category'])}
          >
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
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 w-24"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={save} disabled={updateItem.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={resetToItem}>
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className={isAdmin ? 'cursor-pointer' : undefined}
      onClick={() => isAdmin && setEditing(true)}
    >
      <TableCell>{item.shot_type}</TableCell>
      <TableCell>
        <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
      </TableCell>
      <TableCell>{item.hours}</TableCell>
      <TableCell>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                deleteItem.mutateAsync({ rateCardId, itemId: item.id });
              }}
              disabled={deleteItem.isPending}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
