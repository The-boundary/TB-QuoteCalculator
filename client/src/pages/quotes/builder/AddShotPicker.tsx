import { useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface RateCardItemLike {
  shot_type: string;
  category: string;
  hours: number;
}

interface AddShotPickerProps {
  rateCardItems: RateCardItemLike[];
  existingShotTypes: string[];
  onAdd: (shotType: string, baseHours: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  scene: 'Scene',
  animation: 'Animation',
  material: 'Material',
  post: 'Post',
};

export function AddShotPicker({
  rateCardItems,
  existingShotTypes,
  onAdd,
  open,
  onOpenChange,
}: AddShotPickerProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, RateCardItemLike[]> = {};
    for (const item of rateCardItems) {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [rateCardItems]);

  function handleAdd(item: RateCardItemLike) {
    onAdd(item.shot_type, Number(item.hours));
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Shot
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="text-sm font-medium">Add Shot Type</h4>
          <p className="text-xs text-muted-foreground mt-1">Select from rate card items</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-2 py-1">
                <Badge variant="secondary" className="text-[11px]">
                  {CATEGORY_LABELS[category] ?? category}
                </Badge>
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const exists = existingShotTypes.includes(item.shot_type);
                  return (
                    <button
                      key={item.shot_type}
                      onClick={() => handleAdd(item)}
                      disabled={exists}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                        exists
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-accent/50 cursor-pointer',
                      )}
                    >
                      <span>{item.shot_type}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {item.hours} hrs
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
