import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface AnimationToggleProps {
  complexity: 'regular' | 'complex';
  onChange: (complexity: 'regular' | 'complex') => void;
}

export function AnimationToggle({ complexity, onChange }: AnimationToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <Label className="text-sm text-muted-foreground">Animation</Label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Regular (16h)</span>
        <Switch
          checked={complexity === 'complex'}
          onCheckedChange={(checked) => onChange(checked ? 'complex' : 'regular')}
        />
        <span className="text-xs text-muted-foreground">Complex (32h)</span>
      </div>
    </div>
  );
}
