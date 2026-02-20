import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { calcShotCount } from '@/lib/utils';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from '@/hooks/useTemplates';
import type { FilmTemplateShot, FilmTemplateWithShots } from '../../../shared/types';

function distributeByPercentage(total: number, shots: FilmTemplateShot[]) {
  const rows = shots.map((shot) => {
    const raw = total * (shot.percentage / 100);
    const floored = Math.floor(raw);
    return { shot_type: shot.shot_type, raw, floored, rem: raw - floored };
  });

  let remaining = total - rows.reduce((sum, row) => sum + row.floored, 0);
  const sorted = [...rows].sort((a, b) => b.rem - a.rem);
  let index = 0;
  while (remaining > 0 && sorted.length > 0) {
    sorted[index % sorted.length].floored += 1;
    remaining -= 1;
    index += 1;
  }

  return rows.map((row) => ({ shot_type: row.shot_type, quantity: row.floored }));
}

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: FilmTemplateWithShots | null;
}) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const [name, setName] = useState(template?.name ?? '');
  const [duration, setDuration] = useState(String(template?.duration_seconds ?? 60));

  const isEdit = Boolean(template);
  const isPending = createTemplate.isPending || updateTemplate.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      duration_seconds: Math.max(1, Number(duration) || 60),
    };

    if (template) {
      await updateTemplate.mutateAsync({ id: template.id, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              Template shots are percentage-based and should total 100%.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Duration (seconds)</Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  isAdmin,
  onDelete,
}: {
  template: FilmTemplateWithShots;
  isAdmin: boolean;
  onDelete: (templateId: string) => void;
}) {
  const updateTemplate = useUpdateTemplate();
  const [expanded, setExpanded] = useState(false);
  const [localShots, setLocalShots] = useState(template.shots);

  const updateShot = useCallback(
    (index: number, patch: Partial<FilmTemplateShot>) =>
      setLocalShots((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    [],
  );

  const totalPct = useMemo(
    () => localShots.reduce((sum, shot) => sum + shot.percentage, 0),
    [localShots],
  );
  const preview = useMemo(() => {
    const shotCount = calcShotCount(template.duration_seconds);
    return distributeByPercentage(shotCount, localShots);
  }, [template.duration_seconds, localShots]);

  async function saveShots() {
    await updateTemplate.mutateAsync({
      id: template.id,
      shots: localShots.map((shot, index) => ({
        shot_type: shot.shot_type,
        percentage: shot.percentage,
        efficiency_multiplier: shot.efficiency_multiplier,
        sort_order: index,
      })),
    });
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded((value) => !value)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="font-semibold">{template.name}</p>
              <p className="text-xs text-muted-foreground">{template.duration_seconds}s</p>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            {Math.abs(totalPct - 100) > 0.01 && (
              <Badge variant="warning">{totalPct.toFixed(1)}%</Badge>
            )}
            {isAdmin && (
              <Button size="icon-sm" variant="ghost" onClick={() => onDelete(template.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {localShots.map((shot, index) => (
            <div key={shot.id} className="grid grid-cols-[2fr_1fr_1fr] items-center gap-2">
              <Input
                value={shot.shot_type}
                onChange={(event) => updateShot(index, { shot_type: event.target.value })}
                disabled={!isAdmin}
              />
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={shot.percentage}
                onChange={(event) =>
                  updateShot(index, { percentage: Math.max(0, Number(event.target.value) || 0) })
                }
                disabled={!isAdmin}
              />
              <Input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={shot.efficiency_multiplier}
                onChange={(event) =>
                  updateShot(index, {
                    efficiency_multiplier: Math.max(0.1, Number(event.target.value) || 1),
                  })
                }
                disabled={!isAdmin}
              />
            </div>
          ))}

          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
            For a {template.duration_seconds}s film ({calcShotCount(template.duration_seconds)}{' '}
            shots): {preview.map((row) => `${row.quantity} ${row.shot_type}`).join(', ')}
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setLocalShots((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      template_id: template.id,
                      shot_type: '',
                      percentage: 0,
                      efficiency_multiplier: 1,
                      sort_order: prev.length,
                    },
                  ])
                }
              >
                <Plus className="h-3 w-3" />
                Add Shot
              </Button>
              <Button size="sm" onClick={saveShots} disabled={updateTemplate.isPending}>
                {updateTemplate.isPending ? 'Saving...' : 'Save Shots'}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function TemplatesPage() {
  const { access } = useAuth();
  const isAdmin = access?.is_admin ?? false;
  const { data: templates, isLoading, error } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Film Templates"
        description="Percentage-based shot mix definitions"
        actions={
          isAdmin ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load templates.</p>
        ) : templates && templates.length > 0 ? (
          templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isAdmin={isAdmin}
              onDelete={(templateId) => deleteTemplate.mutate(templateId)}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No templates found.</p>
        )}
      </div>

      <TemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
