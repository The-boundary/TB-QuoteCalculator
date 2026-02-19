import { type ReactNode, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ShotRow } from './ShotRow';
import type { BuilderShot } from './useBuilderState';

interface ShotBreakdownTableProps {
  shots: BuilderShot[];
  onToggleSelect: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onUpdateEfficiency: (index: number, multiplier: number) => void;
  onRemove: (index: number) => void;
  onBatchSetEfficiency: (indices: number[], multiplier: number) => void;
  addShotAction: ReactNode;
}

export function ShotBreakdownTable({
  shots,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onUpdateQuantity,
  onUpdateEfficiency,
  onRemove,
  onBatchSetEfficiency,
  addShotAction,
}: ShotBreakdownTableProps) {
  const [batchEfficiency, setBatchEfficiency] = useState('1.0');

  const selectedIndices = shots.map((s, i) => (s.selected ? i : -1)).filter((i) => i >= 0);
  const allSelected = shots.length > 0 && shots.every((s) => s.selected);
  const someSelected = selectedIndices.length > 0;

  function handleSelectAllToggle() {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }

  function handleBatchApply() {
    const value = parseFloat(batchEfficiency);
    if (!isNaN(value) && selectedIndices.length > 0) {
      onBatchSetEfficiency(selectedIndices, value);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Shot Breakdown</CardTitle>
        {addShotAction}
      </CardHeader>
      <CardContent>
        {/* Batch action bar */}
        {someSelected && (
          <div className="mb-4 flex items-center gap-3 rounded-md border border-sb-border bg-sb-surface-200 px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              Set efficiency for {selectedIndices.length} selected:
            </span>
            <Input
              type="number"
              step={0.1}
              min={0.1}
              max={5.0}
              value={batchEfficiency}
              onChange={(e) => setBatchEfficiency(e.target.value)}
              className="w-20 text-center"
            />
            <Button size="sm" onClick={handleBatchApply}>
              Apply
            </Button>
          </div>
        )}

        {shots.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No shots added. Click &quot;+ Add Shot&quot; to begin.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAllToggle}
                    className="h-4 w-4 rounded border-sb-border-stronger bg-transparent accent-sb-brand-500"
                  />
                </TableHead>
                <TableHead>Shot Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Hrs/ea</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shots.map((shot, i) => (
                <ShotRow
                  key={`${shot.shot_type}-${i}`}
                  shot={shot}
                  index={i}
                  onToggleSelect={onToggleSelect}
                  onUpdateQuantity={onUpdateQuantity}
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
