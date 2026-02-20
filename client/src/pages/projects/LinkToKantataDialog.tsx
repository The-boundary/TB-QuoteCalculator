import { useState } from 'react';
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
import { useKantataSearch } from '@/hooks/useKantata';
import { useLinkProject } from '@/hooks/useProjects';

export function LinkToKantataDialog({
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
