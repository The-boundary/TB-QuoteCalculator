import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Clock, Film } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { formatDuration } from '@/lib/utils';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '@/hooks/useTemplates';
import { useRateCards } from '@/hooks/useRateCards';
import type { FilmTemplateWithShots, FilmTemplateShot } from '../../../shared/types';

// ── Shot Row (editable inline) ──────────────────────────────

interface ShotRowProps {
  shot: FilmTemplateShot;
  isAdmin: boolean;
  onUpdate: (idx: number, field: string, value: string | number) => void;
  onRemove: (idx: number) => void;
  index: number;
}

function ShotRow({ shot, isAdmin, onUpdate, onRemove, index }: ShotRowProps) {
  return (
    <TableRow>
      <TableCell>
        {isAdmin ? (
          <Input
            value={shot.shot_type}
            onChange={(e) => onUpdate(index, 'shot_type', e.target.value)}
            className="h-8"
          />
        ) : (
          shot.shot_type
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="number"
            min="1"
            value={shot.quantity}
            onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 1)}
            className="h-8 w-20"
          />
        ) : (
          shot.quantity
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="number"
            step="0.1"
            min="0.1"
            max="5.0"
            value={shot.efficiency_multiplier}
            onChange={(e) =>
              onUpdate(index, 'efficiency_multiplier', parseFloat(e.target.value) || 1)
            }
            className="h-8 w-20"
          />
        ) : (
          `${shot.efficiency_multiplier}x`
        )}
      </TableCell>
      <TableCell>
        {isAdmin && (
          <Button size="icon-sm" variant="ghost" onClick={() => onRemove(index)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Template Dialog (Create / Edit) ─────────────────────────

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: FilmTemplateWithShots | null;
}

function TemplateDialog({ open, onOpenChange, template }: TemplateDialogProps) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const { data: rateCards } = useRateCards();
  const isEdit = !!template;

  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [rateCardId, setRateCardId] = useState('');

  useEffect(() => {
    if (open) {
      setName(template?.name ?? '');
      setDuration(template?.duration_seconds?.toString() ?? '');
      setDescription(template?.description ?? '');
      setRateCardId(template?.rate_card_id ?? '');
    }
  }, [open, template]);

  const canSubmit =
    name.trim() !== '' && duration !== '' && !isNaN(Number(duration)) && Number(duration) > 0;
  const isPending = createTemplate.isPending || updateTemplate.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payload = {
      name: name.trim(),
      duration_seconds: Number(duration),
      description: description.trim() || null,
      rate_card_id: rateCardId || null,
    };

    if (isEdit && template) {
      await updateTemplate.mutateAsync({ id: template.id, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update template metadata.' : 'Create a new film template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. 60s Film"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tpl-duration">Duration (seconds)</Label>
              <Input
                id="tpl-duration"
                type="number"
                min="1"
                max="600"
                placeholder="e.g. 60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tpl-rc">Rate Card</Label>
              <select
                id="tpl-rc"
                value={rateCardId}
                onChange={(e) => setRateCardId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">None</option>
                {rateCards?.map((rc) => (
                  <option key={rc.id} value={rc.id}>
                    {rc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirmation Dialog ──────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FilmTemplateWithShots | null;
}

function DeleteDialog({ open, onOpenChange, template }: DeleteDialogProps) {
  const deleteTemplate = useDeleteTemplate();

  async function handleDelete() {
    if (!template) return;
    await deleteTemplate.mutateAsync(template.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{template?.name}&rdquo;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteTemplate.isPending}>
            {deleteTemplate.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Expandable Template Card ────────────────────────────────

interface TemplateCardProps {
  template: FilmTemplateWithShots;
  isAdmin: boolean;
  onEdit: (t: FilmTemplateWithShots) => void;
  onDelete: (t: FilmTemplateWithShots) => void;
}

function TemplateCard({ template, isAdmin, onEdit, onDelete }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const updateTemplate = useUpdateTemplate();
  const { data: rateCards } = useRateCards();

  // Local editable copy of shots
  const [localShots, setLocalShots] = useState<FilmTemplateShot[]>(template.shots);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalShots(template.shots);
    setDirty(false);
  }, [template.shots]);

  const totalShots = localShots.reduce((sum, s) => sum + s.quantity, 0);

  const rateCardName = rateCards?.find((rc) => rc.id === template.rate_card_id)?.name;

  const handleShotUpdate = useCallback((idx: number, field: string, value: string | number) => {
    setLocalShots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setDirty(true);
  }, []);

  const handleShotRemove = useCallback((idx: number) => {
    setLocalShots((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }, []);

  const handleAddShot = useCallback(() => {
    setLocalShots((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        template_id: template.id,
        shot_type: '',
        quantity: 1,
        efficiency_multiplier: 1.0,
        sort_order: prev.length,
      },
    ]);
    setDirty(true);
  }, [template.id]);

  async function handleSaveShots() {
    const shots = localShots
      .filter((s) => s.shot_type.trim() !== '')
      .map((s, idx) => ({
        shot_type: s.shot_type.trim(),
        quantity: s.quantity,
        efficiency_multiplier: s.efficiency_multiplier,
        sort_order: idx,
      }));
    await updateTemplate.mutateAsync({ id: template.id, shots });
    setDirty(false);
  }

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
                <Film className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{template.name}</span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(template.duration_seconds)}
                </span>
                <span>{totalShots} shots</span>
                {rateCardName && <Badge variant="secondary">{rateCardName}</Badge>}
              </div>
              {template.description && (
                <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => onEdit(template)}>
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(template)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shot Type</TableHead>
                <TableHead className="w-[100px]">Qty</TableHead>
                <TableHead className="w-[100px]">Efficiency</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {localShots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No shots in this template.
                  </TableCell>
                </TableRow>
              )}
              {localShots.map((shot, idx) => (
                <ShotRow
                  key={shot.id}
                  shot={shot}
                  index={idx}
                  isAdmin={isAdmin}
                  onUpdate={handleShotUpdate}
                  onRemove={handleShotRemove}
                />
              ))}
            </TableBody>
          </Table>

          {isAdmin && (
            <div className="mt-3 flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={handleAddShot}>
                <Plus className="h-3 w-3" />
                Add Shot
              </Button>
              {dirty && (
                <Button size="sm" onClick={handleSaveShots} disabled={updateTemplate.isPending}>
                  {updateTemplate.isPending ? 'Saving...' : 'Save Shots'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────

function TemplatesSkeleton() {
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

export function TemplatesPage() {
  const { access } = useAuth();
  const isAdmin = access?.is_admin ?? false;
  const { data: templates, isLoading, error } = useTemplates();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FilmTemplateWithShots | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<FilmTemplateWithShots | null>(null);

  function handleCreate() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function handleEdit(t: FilmTemplateWithShots) {
    setEditingTemplate(t);
    setDialogOpen(true);
  }

  function handleDelete(t: FilmTemplateWithShots) {
    setDeletingTemplate(t);
    setDeleteDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Film Templates"
        description="Pre-built shot breakdowns for common film durations"
        actions={
          isAdmin ? (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <TemplatesSkeleton />
        ) : error ? (
          <div className="mt-8 text-sm text-destructive">
            Failed to load templates. Please try again.
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            No templates yet.{isAdmin ? ' Create your first film template.' : ''}
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} template={editingTemplate} />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        template={deletingTemplate}
      />
    </>
  );
}
