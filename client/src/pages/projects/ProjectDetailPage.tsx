import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link as LinkIcon, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useProject } from '@/hooks/useProjects';
import { LinkToKantataDialog } from './LinkToKantataDialog';
import { NewQuoteDialog } from './NewQuoteDialog';

function statusVariant(status: string) {
  if (status === 'confirmed') return 'success';
  if (status === 'awaiting_approval') return 'info';
  if (status === 'negotiating') return 'warning';
  return 'secondary';
}

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, error } = useProject(id);
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project...</p>;
  }

  if (error || !project || !id) {
    return <p className="text-sm text-destructive">Failed to load project.</p>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Button>

      <PageHeader
        title={project.name}
        description={project.development_name}
        actions={
          <>
            {project.kantata_id ? (
              <Badge variant="info">Kantata #{project.kantata_id}</Badge>
            ) : (
              <Button variant="outline" onClick={() => setLinkOpen(true)}>
                <LinkIcon className="h-4 w-4" />
                Link to Kantata
              </Button>
            )}
            <Button onClick={() => setNewQuoteOpen(true)}>
              <Plus className="h-4 w-4" />
              New Quote
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {project.quotes.map((quote) => (
          <Card
            key={quote.id}
            className="cursor-pointer transition-colors hover:border-sb-brand/60"
            onClick={() => navigate(`/projects/${project.id}/quotes/${quote.id}`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant={quote.mode === 'budget' ? 'info' : 'secondary'}>{quote.mode}</Badge>
                <Badge
                  variant={
                    statusVariant(quote.status) as 'info' | 'secondary' | 'warning' | 'success'
                  }
                >
                  {quote.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {quote.latest_version ? (
                <>
                  <p>v{quote.latest_version.version_number}</p>
                  <p>{quote.latest_version.duration_seconds}s</p>
                  <p>{quote.latest_version.total_hours}h</p>
                </>
              ) : (
                <p>No versions yet</p>
              )}
              <p>{quote.version_count} versions</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {project.quotes.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No quotes yet. Create your first quote.
        </p>
      )}

      <NewQuoteDialog projectId={id} open={newQuoteOpen} onOpenChange={setNewQuoteOpen} />
      <LinkToKantataDialog projectId={id} open={linkOpen} onOpenChange={setLinkOpen} />
    </>
  );
}
