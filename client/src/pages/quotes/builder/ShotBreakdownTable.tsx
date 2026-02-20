import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShotRow } from './ShotRow';
import type { BuilderShot } from './useBuilderState';

interface ShotBreakdownTableProps {
  shots: BuilderShot[];
  showPricing: boolean;
  hourlyRate: number;
  onToggleSelect: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPercentageChange: (index: number, percentage: number) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onUnlockManualQuantity: (index: number) => void;
  onUpdateEfficiency: (index: number, multiplier: number) => void;
  onRemove: (index: number) => void;
  onBatchSetEfficiency: (indices: number[], multiplier: number) => void;
  addShotAction: ReactNode;
}

export function ShotBreakdownTable({
  shots,
  showPricing,
  hourlyRate,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onPercentageChange,
  onUpdateQuantity,
  onUnlockManualQuantity,
  onUpdateEfficiency,
  onRemove,
  onBatchSetEfficiency,
  addShotAction,
}: ShotBreakdownTableProps) {
  const [batchEfficiency, setBatchEfficiency] = useState('1.0');

  const selectedIndices = useMemo(
    () => shots.map((shot, index) => (shot.selected ? index : -1)).filter((index) => index >= 0),
    [shots],
  );
  const allSelected = shots.length > 0 && shots.every((shot) => shot.selected);
  const someSelected = selectedIndices.length > 0;
  const totalPct = shots.reduce((sum, shot) => sum + shot.percentage, 0);

  function applyBatch() {
    const value = Number(batchEfficiency);
    if (Number.isNaN(value) || selectedIndices.length === 0) return;
    onBatchSetEfficiency(selectedIndices, value);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Shot Breakdown</CardTitle>
        {addShotAction}
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-xs text-muted-foreground">
          Total allocation: {totalPct.toFixed(1)}%
        </div>

        {someSelected && (
          <div className="mb-4 flex items-center gap-3 rounded-md border border-sb-border bg-sb-surface-200 px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              Set efficiency for {selectedIndices.length} selected:
            </span>
            <Input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={batchEfficiency}
              onChange={(event) => setBatchEfficiency(event.target.value)}
              className="w-20 text-center"
            />
            <Button size="sm" onClick={applyBatch}>
              Apply
            </Button>
          </div>
        )}

        {shots.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No shots added. Click &quot;Add Shot&quot; to begin.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={allSelected ? onDeselectAll : onSelectAll}
                    className="h-4 w-4 rounded border-sb-border-stronger bg-transparent accent-sb-brand-500"
                  />
                </TableHead>
                <TableHead>Shot Type</TableHead>
                <TableHead className="w-48">Mix %</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Hrs/ea</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shots.map((shot, index) => (
                <ShotRow
                  key={`${shot.shot_type}-${index}`}
                  shot={shot}
                  index={index}
                  showPricing={showPricing}
                  hourlyRate={hourlyRate}
                  onToggleSelect={onToggleSelect}
                   onPercentageChange={onPercentageChange}
                   onUpdateQuantity={onUpdateQuantity}
                    onUnlockManual={onUnlockManualQuantity}
                    onUpdateEfficiency={onUpdateEfficiency}
                    onRemove={onRemove}
                  />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
