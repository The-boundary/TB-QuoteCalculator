import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { useQuote, useUpdateVersion, useCreateVersion } from '@/hooks/useQuotes';
import { useRateCard } from '@/hooks/useRateCards';
import { useBuilderState } from './builder/useBuilderState';
import { HourPoolBar } from './builder/HourPoolBar';
import { ShotBreakdownTable } from './builder/ShotBreakdownTable';
import { AddShotPicker } from './builder/AddShotPicker';
import { ApplyTemplatePicker } from './builder/ApplyTemplatePicker';
import { PostProductionSection } from './builder/PostProductionSection';
import { TotalsSummary } from './builder/TotalsSummary';
import { BudgetSuggestions } from './builder/BudgetSuggestions';

const DURATION_PRESETS = [15, 30, 60, 90, 120];

export function QuoteBuilderPage() {
  const { id, versionId } = useParams<{ id: string; versionId: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading: quoteLoading } = useQuote(id);

  const existingVersion = useMemo(
    () => quote?.versions.find((v) => v.id === versionId),
    [quote, versionId],
  );

  const { data: rateCard, isLoading: rateCardLoading } = useRateCard(quote?.rate_card_id);

  const builder = useBuilderState(rateCard, existingVersion);

  const updateVersion = useUpdateVersion();
  const createVersion = useCreateVersion();

  const [addShotOpen, setAddShotOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingShotTypes = useMemo(
    () => builder.shots.map((s) => s.shot_type),
    [builder.shots],
  );

  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = builder.getPayload();
      if (versionId) {
        await updateVersion.mutateAsync({ quoteId: id, versionId, ...payload });
      } else {
        await createVersion.mutateAsync({ quoteId: id, ...payload });
      }
    } finally {
      setSaving(false);
    }
  }, [id, versionId, builder, updateVersion, createVersion]);

  const handleSaveAndClose = useCallback(async () => {
    await handleSave();
    navigate(`/quotes/${id}`);
  }, [handleSave, navigate, id]);

  if (quoteLoading || rateCardLoading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Loading builder...</div>
        </div>
      </>
    );
  }

  if (!quote) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Quote not found.</div>
        </div>
      </>
    );
  }

  const versionNumber = existingVersion?.version_number ?? (quote.versions.length + 1);

  return (
    <>
      {/* Header */}
      <PageHeader
        title={`${quote.project_name} — Version ${versionNumber}`}
        description={quote.client_name}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(`/quotes/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        }
      />

      <div className="mt-8 space-y-6">
        {/* Duration Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Film Duration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {DURATION_PRESETS.map((d) => (
                <Button
                  key={d}
                  variant={builder.duration === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => builder.setDuration(d)}
                >
                  {d}s
                </Button>
              ))}
              <div className="ml-2 border-l border-border pl-2">
                <ApplyTemplatePicker
                  onApply={builder.applyTemplate}
                  open={templatePickerOpen}
                  onOpenChange={setTemplatePickerOpen}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="duration-input" className="text-sm text-muted-foreground whitespace-nowrap">
                Custom (seconds):
              </Label>
              <Input
                id="duration-input"
                type="number"
                min={1}
                max={600}
                value={builder.duration}
                onChange={(e) => builder.setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-28"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hour Pool Bar */}
        <HourPoolBar used={builder.totalHours} budget={builder.poolBudgetHours} />

        {/* Shot Breakdown */}
        <ShotBreakdownTable
          shots={builder.shots}
          onToggleSelect={builder.toggleShotSelection}
          onSelectAll={builder.selectAll}
          onDeselectAll={builder.deselectAll}
          onUpdateQuantity={builder.updateQuantity}
          onUpdateEfficiency={builder.updateEfficiency}
          onRemove={builder.removeShot}
          onBatchSetEfficiency={builder.batchSetEfficiency}
          addShotAction={
            <AddShotPicker
              rateCardItems={rateCard?.items ?? []}
              existingShotTypes={existingShotTypes}
              onAdd={(shotType, baseHours) => {
                builder.addShot(shotType, baseHours);
              }}
              open={addShotOpen}
              onOpenChange={setAddShotOpen}
            />
          }
        />

        {/* Post-Production */}
        <PostProductionSection
          duration={builder.duration}
          editingHours={builder.editingHours}
          editingHoursPer30s={builder.editingHoursPer30s}
        />

        {/* Totals */}
        <TotalsSummary
          totalShotHours={builder.totalShotHours}
          editingHours={builder.editingHours}
          totalHours={builder.totalHours}
          poolBudgetHours={builder.poolBudgetHours}
          remaining={builder.remaining}
        />

        {/* Budget Suggestions */}
        <BudgetSuggestions
          remaining={builder.remaining}
          rateCardItems={rateCard?.items ?? []}
          existingShotTypes={existingShotTypes}
        />

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={builder.notes}
              onChange={(e) => builder.setNotes(e.target.value)}
              placeholder="Add any notes about this version..."
              rows={3}
              className="flex w-full rounded-md px-3 py-2 text-sm bg-[rgba(250,250,250,0.027)] border border-sb-border-stronger text-sb-text placeholder:text-sb-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sb-brand focus-visible:ring-offset-2 focus-visible:ring-offset-sb-bg focus-visible:border-transparent resize-none"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate(`/quotes/${id}`)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={handleSaveAndClose} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save & Close'}
          </Button>
        </div>
      </div>
    </>
  );
}
