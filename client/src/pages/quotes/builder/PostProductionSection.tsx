import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Film } from 'lucide-react';

interface PostProductionSectionProps {
  duration: number;
  editingHours: number;
  editingHoursPer30s: number;
}

export function PostProductionSection({
  duration,
  editingHours,
  editingHoursPer30s,
}: PostProductionSectionProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Film className="h-4 w-4" />
          Post-Production (Editing)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm">
          Editing ({duration}s film) ={' '}
          <span className="font-medium text-foreground">{editingHours.toFixed(1)} hrs</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Auto-calculated at {editingHoursPer30s} hrs per 30s
        </p>
      </CardContent>
    </Card>
  );
}
