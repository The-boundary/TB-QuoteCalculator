import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FilmTemplateWithShots, RateCardWithItems } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FilmModule } from './FilmModule';
import type { BuilderModule } from './useBuilderState';

interface ModuleManagerProps {
  modules: BuilderModule[];
  rateCard: RateCardWithItems | undefined;
  showPricing: boolean;
  hourlyRate: number;
  editingHoursPer30s: number;
  onAddModule: (name?: string) => void;
  onRemoveModule: (moduleIdx: number) => void;
  onUpdateModuleName: (moduleIdx: number, name: string) => void;
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

export function ModuleManager({
  modules,
  rateCard,
  showPricing,
  hourlyRate,
  editingHoursPer30s,
  onAddModule,
  onRemoveModule,
  onUpdateModuleName,
  ...shotCallbacks
}: ModuleManagerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, modules.length - 1);

  return (
    <div className="space-y-4">
      {/* Module tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        {modules.map((mod, idx) => (
          <div key={mod.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveIdx(idx)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                idx === safeIdx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {mod.name}
            </button>
            {modules.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  onRemoveModule(idx);
                  if (safeIdx >= modules.length - 1) setActiveIdx(Math.max(0, safeIdx - 1));
                }}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddModule()}
          className="ml-1"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Film
        </Button>
      </div>

      {/* Active module name edit */}
      {modules.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Module name:</span>
          <Input
            value={modules[safeIdx].name}
            onChange={(e) => onUpdateModuleName(safeIdx, e.target.value)}
            className="h-8 w-48 text-sm"
          />
        </div>
      )}

      {/* Active module content */}
      <FilmModule
        module={modules[safeIdx]}
        moduleIdx={safeIdx}
        rateCard={rateCard}
        showPricing={showPricing}
        hourlyRate={hourlyRate}
        editingHoursPer30s={editingHoursPer30s}
        {...shotCallbacks}
      />
    </div>
  );
}
