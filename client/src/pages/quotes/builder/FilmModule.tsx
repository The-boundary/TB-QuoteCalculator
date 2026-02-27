import { useMemo, useState } from 'react';
import type { FilmTemplateWithShots, RateCardWithItems } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddShotPicker } from './AddShotPicker';
import { AnimationToggle } from './AnimationToggle';
import { ApplyTemplatePicker } from './ApplyTemplatePicker';
import { PostProductionSection } from './PostProductionSection';
import { ShotBreakdownTable } from './ShotBreakdownTable';
import { buildCategoryMap, type BuilderModule } from './useBuilderState';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

interface FilmModuleProps {
  module: BuilderModule;
  moduleIdx: number;
  rateCard: RateCardWithItems | undefined;
  showPricing: boolean;
  hourlyRate: number;
  editingHoursPer30s: number;
  onSetDuration: (moduleIdx: number, duration: number) => void;
  onSetPercentage: (moduleIdx: number, index: number, percentage: number) => void;
  onUpdateQuantity: (moduleIdx: number, index: number, quantity: number) => void;
  onUnlockManualQuantity: (moduleIdx: number, index: number) => void;
  onUpdateEfficiency: (moduleIdx: number, index: number, multiplier: number) => void;
  onBatchSetEfficiency: (moduleIdx: number, indices: number[], multiplier: number) => void;
  onAddShot: (moduleIdx: number, shotType: string, baseHours: number) => void;
  onRemoveShot: (moduleIdx: number, index: number) => void;
  onApplyTemplate: (moduleIdx: number, template: FilmTemplateWithShots) => void;
  onSetAnimationComplexity: (moduleIdx: number, complexity: 'regular' | 'complex') => void;
  onAnimationOverride: (moduleIdx: number, index: number, override: 'regular' | 'complex' | null) => void;
  onToggleSelect: (moduleIdx: number, index: number) => void;
  onSelectAll: (moduleIdx: number) => void;
  onDeselectAll: (moduleIdx: number) => void;
}

export function FilmModule({
  module: mod,
  moduleIdx,
  rateCard,
  showPricing,
  hourlyRate,
  editingHoursPer30s,
  onSetDuration,
  onSetPercentage,
  onUpdateQuantity,
  onUnlockManualQuantity,
  onUpdateEfficiency,
  onBatchSetEfficiency,
  onAddShot,
  onRemoveShot,
  onApplyTemplate,
  onSetAnimationComplexity,
  onAnimationOverride,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: FilmModuleProps) {
  const [addShotOpen, setAddShotOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const existingShotTypes = useMemo(
    () => mod.shots.map((shot) => shot.shot_type),
    [mod.shots],
  );

  const sceneShotTypes = useMemo(() => {
    const categoryMap = buildCategoryMap(rateCard?.items ?? []);
    const set = new Set<string>();
    for (const [shotType, category] of categoryMap) {
      if (category === 'scene') set.add(shotType);
    }
    return set;
  }, [rateCard?.items]);

  const editingHours = Math.ceil(mod.duration / 30) * editingHoursPer30s;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Duration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((seconds) => (
              <Button
                key={seconds}
                size="sm"
                variant={mod.duration === seconds ? 'default' : 'outline'}
                onClick={() => onSetDuration(moduleIdx, seconds)}
              >
                {seconds}s
              </Button>
            ))}

            <div className="ml-2 border-l border-border pl-2">
              <ApplyTemplatePicker
                onApply={(template) => onApplyTemplate(moduleIdx, template)}
                open={templateOpen}
                onOpenChange={setTemplateOpen}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor={`duration-input-${moduleIdx}`}>Custom (seconds)</Label>
            <Input
              id={`duration-input-${moduleIdx}`}
              type="number"
              min={1}
              max={600}
              value={mod.duration}
              onChange={(event) =>
                onSetDuration(moduleIdx, Math.max(1, Number(event.target.value) || 1))
              }
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">{mod.shotCount} total shots</span>
          </div>

          <AnimationToggle
            complexity={mod.animationComplexity}
            onChange={(complexity) => onSetAnimationComplexity(moduleIdx, complexity)}
          />
        </CardContent>
      </Card>

      <ShotBreakdownTable
        shots={mod.shots}
        showPricing={showPricing}
        hourlyRate={hourlyRate}
        sceneShotTypes={sceneShotTypes}
        animationComplexity={mod.animationComplexity}
        onToggleSelect={(index) => onToggleSelect(moduleIdx, index)}
        onSelectAll={() => onSelectAll(moduleIdx)}
        onDeselectAll={() => onDeselectAll(moduleIdx)}
        onPercentageChange={(index, pct) => onSetPercentage(moduleIdx, index, pct)}
        onUpdateQuantity={(index, qty) => onUpdateQuantity(moduleIdx, index, qty)}
        onUnlockManualQuantity={(index) => onUnlockManualQuantity(moduleIdx, index)}
        onUpdateEfficiency={(index, mult) => onUpdateEfficiency(moduleIdx, index, mult)}
        onRemove={(index) => onRemoveShot(moduleIdx, index)}
        onBatchSetEfficiency={(indices, mult) => onBatchSetEfficiency(moduleIdx, indices, mult)}
        onAnimationOverride={(index, override) => onAnimationOverride(moduleIdx, index, override)}
        addShotAction={
          <AddShotPicker
            rateCardItems={rateCard?.items ?? []}
            existingShotTypes={existingShotTypes}
            onAdd={(shotType, baseHours) => onAddShot(moduleIdx, shotType, baseHours)}
            open={addShotOpen}
            onOpenChange={setAddShotOpen}
          />
        }
      />

      <PostProductionSection
        duration={mod.duration}
        editingHours={editingHours}
        editingHoursPer30s={editingHoursPer30s}
      />
    </div>
  );
}
