import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDevelopment, useDevelopments } from '@/hooks/useDevelopments';
import { useCreateProject } from '@/hooks/useProjects';

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: developments } = useDevelopments();
  const createDevelopment = useCreateDevelopment();
  const createProject = useCreateProject();

  const [developmentId, setDevelopmentId] = useState('');
  const [newDevelopmentName, setNewDevelopmentName] = useState('');
  const [projectType, setProjectType] = useState<'forecasted' | 'kantata'>('forecasted');
  const [projectName, setProjectName] = useState('');
  const [kantataId, setKantataId] = useState('');

  const canSubmit =
    (developmentId || newDevelopmentName.trim()) &&
    (projectType === 'forecasted' ? projectName.trim() : kantataId.trim());

  async function submit() {
    if (!canSubmit) return;

    let finalDevelopmentId = developmentId;
    if (!finalDevelopmentId) {
      const created = await createDevelopment.mutateAsync({ name: newDevelopmentName.trim() });
      finalDevelopmentId = created.id;
    }

    const payload =
      projectType === 'forecasted'
        ? { development_id: finalDevelopmentId, name: projectName.trim() }
        : {
            development_id: finalDevelopmentId,
            name: projectName.trim() || `Kantata ${kantataId.trim()}`,
            kantata_id: kantataId.trim(),
          };

    const project = await createProject.mutateAsync(payload);
    onOpenChange(false);
    navigate(`/projects/${project.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a forecasted project or link it to Kantata.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="dev-select">Development</Label>
            <select
              id="dev-select"
              value={developmentId}
              onChange={(event) => setDevelopmentId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Create new development</option>
              {developments?.map((development) => (
                <option key={development.id} value={development.id}>
                  {development.name}
                </option>
              ))}
            </select>
          </div>

          {!developmentId && (
            <div className="grid gap-2">
              <Label htmlFor="new-dev">New development name</Label>
              <Input
                id="new-dev"
                value={newDevelopmentName}
                onChange={(event) => setNewDevelopmentName(event.target.value)}
                placeholder="Dubai Islands E"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Project Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={projectType === 'forecasted' ? 'default' : 'outline'}
                onClick={() => setProjectType('forecasted')}
              >
                Forecasted
              </Button>
              <Button
                type="button"
                variant={projectType === 'kantata' ? 'default' : 'outline'}
                onClick={() => setProjectType('kantata')}
              >
                Kantata Linked
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Masterplan Film 60s"
            />
          </div>

          {projectType === 'kantata' && (
            <div className="grid gap-2">
              <Label htmlFor="kantata-id">Kantata ID</Label>
              <Input
                id="kantata-id"
                value={kantataId}
                onChange={(event) => setKantataId(event.target.value)}
                placeholder="23046"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit || createProject.isPending || createDevelopment.isPending}
          >
            {createProject.isPending || createDevelopment.isPending ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
