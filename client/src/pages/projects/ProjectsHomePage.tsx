import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Link as LinkIcon, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects } from '@/hooks/useProjects';
import type { ProjectListItem } from '@/hooks/useProjects';
import { LinkToKantataDialog } from './LinkToKantataDialog';
import { NewProjectDialog } from './NewProjectDialog';

function statusLabel(status: string | null): string {
  if (!status) return 'No quotes';
  return status.replace(/_/g, ' ');
}

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-28" />
      </CardContent>
    </Card>
  );
}

function ActiveProjectCard({
  project,
  onClick,
}: {
  project: ProjectListItem;
  onClick: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-sb-brand/60" onClick={onClick}>
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
  );
}

function ForecastedProjectCard({
  project,
  onClick,
  onLink,
}: {
  project: ProjectListItem;
  onClick: () => void;
  onLink: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-sb-brand/60" onClick={onClick}>
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
            onLink();
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Link to Kantata
        </Button>
      </CardContent>
    </Card>
  );
}

interface LinkDialogState {
  projectId: string;
  open: boolean;
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
              ? Array.from({ length: 3 }).map((_, index) => <ProjectCardSkeleton key={index} />)
              : activeProjects.map((project) => (
                  <ActiveProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  />
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
              <ForecastedProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
                onLink={() => setLinkDialog({ projectId: project.id, open: true })}
              />
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
