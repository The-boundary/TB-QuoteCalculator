import { useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Film, Clock } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { useTemplates } from '@/hooks/useTemplates';
import type { FilmTemplateWithShots } from '@shared/types';

interface ApplyTemplatePickerProps {
  onApply: (template: FilmTemplateWithShots) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplyTemplatePicker({ onApply, open, onOpenChange }: ApplyTemplatePickerProps) {
  const { data: templates, isLoading } = useTemplates();

  const sorted = useMemo(
    () => [...(templates ?? [])].sort((a, b) => a.duration_seconds - b.duration_seconds),
    [templates],
  );

  function handleApply(template: FilmTemplateWithShots) {
    onApply(template);
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Film className="h-4 w-4 mr-1" />
          Apply Template
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-medium">Apply Film Template</h4>
          <p className="text-xs text-muted-foreground mt-1">Replaces current duration and shots</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
          {isLoading ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No templates available
            </div>
          ) : (
            sorted.map((t) => {
              const totalPct = t.shots.reduce((sum, s) => sum + Number(s.percentage), 0);
              return (
                <button
                  key={t.id}
                  onClick={() => handleApply(t)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50 cursor-pointer"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(t.duration_seconds)} &middot; {totalPct.toFixed(0)}%
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
