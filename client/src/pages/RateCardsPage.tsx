import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import {
  useRateCards,
  useRateCard,
  useCreateRateCard,
  useUpdateRateCard,
  useAddRateCardItem,
  useUpdateRateCardItem,
  useDeleteRateCardItem,
} from '@/hooks/useRateCards';
import type { RateCard, RateCardItem } from '../../../shared/types';

// ── Category helpers ─────────────────────────────────────────

const CATEGORIES = ['scene', 'animation', 'post', 'material'] as const;

function categoryLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// ── Create / Edit Rate Card Dialog ───────────────────────────

interface RateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateCard?: RateCard | null;
}

function RateCardDialog({ open, onOpenChange, rateCard }: RateCardDialogProps) {
  const createRateCard = useCreateRateCard();
  const updateRateCard = useUpdateRateCard();
  const isEdit = !!rateCard;

  const [name, setName] = useState('');
  const [hoursPerSecond, setHoursPerSecond] = useState('');
  const [editingHours, setEditingHours] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (open) {
      setName(rateCard?.name ?? '');
      setHoursPerSecond(rateCard?.hours_per_second?.toString() ?? '');
      setEditingHours(rateCard?.editing_hours_per_30s?.toString() ?? '');
      setIsDefault(rateCard?.is_default ?? false);
    }
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

// ── Inline-editable Item Row ─────────────────────────────────

interface ItemRowProps {
  item: RateCardItem;
  rateCardId: string;
  isAdmin: boolean;
}

function ItemRow({ item, rateCardId, isAdmin }: ItemRowProps) {
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
  }, [item]);

  const save = useCallback(async () => {
    if (!shotType.trim()) return;
    await updateItem.mutateAsync({
      rateCardId,
      itemId: item.id,
      shot_type: shotType.trim(),
      category,
      hours: Number(hours) || 0,
    });
    setEditing(false);
  }, [rateCardId, item.id, shotType, category, hours, updateItem]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      setShotType(item.shot_type);
      setCategory(item.category);
      setHours(item.hours.toString());
      setEditing(false);
    }
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShotType(item.shot_type);
                setCategory(item.category);
                setHours(item.hours.toString());
                setEditing(false);
              }}
            >
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

// ── Add Item Row ─────────────────────────────────────────────

interface AddItemRowProps {
  rateCardId: string;
  nextSortOrder: number;
}

function AddItemRow({ rateCardId, nextSortOrder }: AddItemRowProps) {
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
    if (e.key === 'Escape') {
      reset();
    }
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

// ── Expandable Rate Card ─────────────────────────────────────

interface RateCardRowProps {
  rateCard: RateCard;
  isAdmin: boolean;
  onEdit: (rc: RateCard) => void;
}

function RateCardRow({ rateCard, isAdmin, onEdit }: RateCardRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading: detailLoading } = useRateCard(
    expanded ? rateCard.id : undefined,
  );

  const items = detail?.items ?? [];
  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{rateCard.name}</span>
                {rateCard.is_default && <Badge>Default</Badge>}
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span>{rateCard.hours_per_second} hrs/sec</span>
                <span>{rateCard.editing_hours_per_30s} editing hrs/30s</span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(rateCard);
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {detailLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shot Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && !isAdmin && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No items in this rate card.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} rateCardId={rateCard.id} isAdmin={isAdmin} />
                ))}
                {isAdmin && <AddItemRow rateCardId={rateCard.id} nextSortOrder={nextSortOrder} />}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────

function RateCardsSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export function RateCardsPage() {
  const { access } = useAuth();
  const isAdmin = access?.is_admin ?? false;
  const { data: rateCards, isLoading, error } = useRateCards();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);

  function handleCreate() {
    setEditingCard(null);
    setDialogOpen(true);
  }

  function handleEdit(rc: RateCard) {
    setEditingCard(rc);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Rate Cards"
        description="Manage production rate cards"
        actions={
          isAdmin ? (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              New Rate Card
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <RateCardsSkeleton />
        ) : error ? (
          <div className="mt-8 text-sm text-destructive">
            Failed to load rate cards. Please try again.
          </div>
        ) : !rateCards || rateCards.length === 0 ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            No rate cards yet.{isAdmin ? ' Create your first rate card.' : ''}
          </div>
        ) : (
          <div className="space-y-4">
            {rateCards.map((rc) => (
              <RateCardRow key={rc.id} rateCard={rc} isAdmin={isAdmin} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>

      <RateCardDialog open={dialogOpen} onOpenChange={setDialogOpen} rateCard={editingCard} />
    </>
  );
}
