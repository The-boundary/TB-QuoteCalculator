import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Link as LinkIcon, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { useCreateDevelopment, useDevelopments } from '@/hooks/useDevelopments';
import { useKantataSearch } from '@/hooks/useKantata';
import { useCreateProject, useLinkProject, useProjects } from '@/hooks/useProjects';

function statusLabel(status: string | null): string {
  if (!status) return 'No quotes';
  return status.replace(/_/g, ' ');
}

interface LinkDialogState {
  projectId: string;
  open: boolean;
}

function LinkToKantataDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const linkProject = useLinkProject();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string>('');
  const { data, isFetching } = useKantataSearch(search);

  async function submit() {
    if (!selected) return;
    await linkProject.mutateAsync({ id: projectId, kantata_id: selected });
    onOpenChange(false);
    setSearch('');
    setSelected('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to Kantata</DialogTitle>
          <DialogDescription>Search workspaces and attach one to this project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or ID"
          />
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-2">
            {search.length < 2 ? (
              <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>
            ) : isFetching ? (
              <p className="text-sm text-muted-foreground">Searching...</p>
            ) : data && data.length > 0 ? (
              data.map((workspace) => (
                <button
                  key={workspace.kantata_id}
                  type="button"
                  onClick={() => setSelected(workspace.kantata_id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selected === workspace.kantata_id
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent hover:bg-accent/50'
                  }`}
                >
                  <div className="font-medium">{workspace.title}</div>
                  <div className="text-xs text-muted-foreground">#{workspace.kantata_id}</div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No workspaces found.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!selected || linkProject.isPending}>
            {linkProject.isPending ? 'Linking...' : 'Link Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProjectDialog({
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
  const { data: kantataResults } = useKantataSearch('');

  const [developmentId, setDevelopmentId] = useState('');
  const [newDevelopmentName, setNewDevelopmentName] = useState('');
  const [projectType, setProjectType] = useState<'forecasted' | 'kantata'>('forecasted');
  const [projectName, setProjectName] = useState('');
  const [kantataId, setKantataId] = useState('');

  const resolvedDevelopmentId = developmentId;
  const canSubmit =
    (resolvedDevelopmentId || newDevelopmentName.trim()) &&
    (projectType === 'forecasted' ? projectName.trim() : kantataId.trim());

  async function submit() {
    if (!canSubmit) return;

    let finalDevelopmentId = resolvedDevelopmentId;
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
              {kantataResults && kantataResults.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Existing workspace IDs are available via search after creation.
                </p>
              )}
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

export function ProjectsHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState>({ projectId: '', open: false });
  const { data: projects, isLoading, error } = useProjects({ search });

  const { activeProjects, forecastedProjects } = useMemo(() => {
    const all = projects ?? [];
    return {
      activeProjects: all.filter((project) => !project.is_forecasted),
      forecastedProjects: all.filter((project) => project.is_forecasted),
    };
  }, [projects]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Active and forecasted quote projects"
        actions={
          <Button onClick={() => setNewDialogOpen(true)}>
            <FolderPlus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="mt-6 flex max-w-md items-center gap-2 rounded-md border border-border px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          className="border-none px-0"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by project, development, or Kantata ID"
        />
      </div>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold">Active Projects</h2>
          <p className="text-sm text-muted-foreground">Projects linked to Kantata</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-28" />
                    </CardContent>
                  </Card>
                ))
              : activeProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="cursor-pointer transition-colors hover:border-sb-brand/60"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.development_name}</p>
                        </div>
                        {project.kantata_id && <Badge variant="info">#{project.kantata_id}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                      <p>{project.quote_count} quotes</p>
                      <p>Latest status: {statusLabel(project.latest_quote_status)}</p>
                    </CardContent>
                  </Card>
                ))}
            {!isLoading && activeProjects.length === 0 && (
              <p className="text-sm text-muted-foreground">No active projects yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Forecasted Projects</h2>
          <p className="text-sm text-muted-foreground">Not linked to Kantata yet</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {forecastedProjects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-colors hover:border-sb-brand/60"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <p className="text-sm font-semibold">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.development_name}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>{project.quote_count} quotes</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      setLinkDialog({ projectId: project.id, open: true });
                    }}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Link to Kantata
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!isLoading && forecastedProjects.length === 0 && (
              <p className="text-sm text-muted-foreground">No forecasted projects yet.</p>
            )}
          </div>
        </section>
      </div>

      {error && <p className="mt-6 text-sm text-destructive">Failed to load projects.</p>}

      <NewProjectDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />

      {linkDialog.open && (
        <LinkToKantataDialog
          projectId={linkDialog.projectId}
          open={linkDialog.open}
          onOpenChange={(open) => setLinkDialog((prev) => ({ ...prev, open }))}
        />
      )}
    </>
  );
}
