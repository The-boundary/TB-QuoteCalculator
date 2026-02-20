import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateVersion, useQuote, useUpdateVersion } from '@/hooks/useQuotes';
import { useRateCard } from '@/hooks/useRateCards';
import { AddShotPicker } from './builder/AddShotPicker';
import { ApplyTemplatePicker } from './builder/ApplyTemplatePicker';
import { BudgetSuggestions } from './builder/BudgetSuggestions';
import { HourPoolBar } from './builder/HourPoolBar';
import { PostProductionSection } from './builder/PostProductionSection';
import { ShotBreakdownTable } from './builder/ShotBreakdownTable';
import { TotalsSummary } from './builder/TotalsSummary';
import { useBuilderState } from './builder/useBuilderState';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function QuoteBuilderPage() {
  const navigate = useNavigate();
  const {
    id: projectId,
    quoteId,
    versionId,
  } = useParams<{
    id: string;
    quoteId: string;
    versionId: string;
  }>();

  const { data: quote, isLoading: quoteLoading } = useQuote(quoteId);
  const existingVersion = useMemo(
    () => quote?.versions.find((version) => version.id === versionId),
    [quote?.versions, versionId],
  );
  const { data: rateCard, isLoading: rateCardLoading } = useRateCard(quote?.rate_card_id);

  const builder = useBuilderState(rateCard, existingVersion, quote?.mode ?? 'retainer');
  const updateVersion = useUpdateVersion();
  const createVersion = useCreateVersion();

  const [addShotOpen, setAddShotOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingShotTypes = useMemo(
    () => builder.shots.map((shot) => shot.shot_type),
    [builder.shots],
  );

  const saveVersion = useCallback(async () => {
    if (!quoteId) return;
    setSaving(true);
    try {
      if (versionId) {
        await updateVersion.mutateAsync({
          quoteId,
          versionId,
          ...builder.payload,
        });
      } else {
        await createVersion.mutateAsync({
          quoteId,
          ...builder.payload,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [builder.payload, quoteId, versionId, updateVersion, createVersion]);

  const saveAndClose = useCallback(async () => {
    await saveVersion();
    if (projectId && quoteId) {
      navigate(`/projects/${projectId}/quotes/${quoteId}`);
    }
  }, [saveVersion, navigate, projectId, quoteId]);

  if (quoteLoading || rateCardLoading) {
    return <p className="text-sm text-muted-foreground">Loading builder...</p>;
  }

  if (!quote || !projectId || !quoteId) {
    return <p className="text-sm text-muted-foreground">Quote not found.</p>;
  }

  const versionNumber = existingVersion?.version_number ?? quote.versions.length + 1;

  return (
    <>
      <PageHeader
        title={`${quote.project?.name ?? 'Quote'} — Version ${versionNumber}`}
        description={`${builder.shotCount} shots for ${builder.duration}s`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/quotes/${quoteId}`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mode and Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Label htmlFor="mode-toggle">Mode</Label>
                <Switch
                  id="mode-toggle"
                  checked={builder.mode === 'budget'}
                  onCheckedChange={(checked) => builder.setMode(checked ? 'budget' : 'retainer')}
                />
                <span className="text-sm font-medium">
                  {builder.mode === 'budget' ? 'Budget' : 'Retainer'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="pricing-toggle">Show Pricing</Label>
                <Switch
                  id="pricing-toggle"
                  checked={builder.showPricing}
                  onCheckedChange={builder.setShowPricing}
                />
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="hourly-rate">Hourly Rate</Label>
                <Input
                  id="hourly-rate"
                  type="number"
                  min={0}
                  step={1}
                  value={builder.hourlyRate}
                  onChange={(event) => builder.setHourlyRate(Number(event.target.value) || 0)}
                  className="w-28"
                />
              </div>
            </div>

            {builder.mode === 'budget' && (
              <div className="flex items-center gap-2">
                <Label htmlFor="budget-amount">Budget ($)</Label>
                <Input
                  id="budget-amount"
                  type="number"
                  min={0}
                  step={100}
                  value={builder.budgetAmount ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    builder.setBudgetAmount(value === '' ? null : Number(value));
                  }}
                  className="w-40"
                />
              </div>
            )}
          </CardContent>
        </Card>

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
                  variant={builder.duration === seconds ? 'default' : 'outline'}
                  onClick={() => builder.setDuration(seconds)}
                >
                  {seconds}s
                </Button>
              ))}

              <div className="ml-2 border-l border-border pl-2">
                <ApplyTemplatePicker
                  onApply={builder.applyTemplate}
                  open={templateOpen}
                  onOpenChange={setTemplateOpen}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="duration-input">Custom (seconds)</Label>
              <Input
                id="duration-input"
                type="number"
                min={1}
                max={600}
                value={builder.duration}
                onChange={(event) =>
                  builder.setDuration(Math.max(1, Number(event.target.value) || 1))
                }
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">{builder.shotCount} total shots</span>
            </div>
          </CardContent>
        </Card>

        {builder.mode === 'budget' && (
          <HourPoolBar
            used={builder.totalHours}
            budget={builder.poolBudgetHours}
            showPricing={builder.showPricing}
            hourlyRate={builder.hourlyRate}
          />
        )}

        <ShotBreakdownTable
          shots={builder.shots}
          showPricing={builder.showPricing}
          hourlyRate={builder.hourlyRate}
          onToggleSelect={builder.toggleShotSelection}
          onSelectAll={builder.selectAll}
          onDeselectAll={builder.deselectAll}
          onPercentageChange={builder.setPercentage}
          onUpdateQuantity={builder.updateQuantity}
          onUpdateEfficiency={builder.updateEfficiency}
          onRemove={builder.removeShot}
          onBatchSetEfficiency={builder.batchSetEfficiency}
          addShotAction={
            <AddShotPicker
              rateCardItems={rateCard?.items ?? []}
              existingShotTypes={existingShotTypes}
              onAdd={(shotType, baseHours) => builder.addShot(shotType, baseHours)}
              open={addShotOpen}
              onOpenChange={setAddShotOpen}
            />
          }
        />

        <PostProductionSection
          duration={builder.duration}
          editingHours={builder.editingHours}
          editingHoursPer30s={builder.editingHoursPer30s}
        />

        <TotalsSummary
          totalShotHours={builder.totalShotHours}
          editingHours={builder.editingHours}
          totalHours={builder.totalHours}
          poolBudgetHours={builder.poolBudgetHours}
          remaining={builder.remaining}
          showPricing={builder.showPricing}
          hourlyRate={builder.hourlyRate}
        />

        {builder.mode === 'budget' && (
          <BudgetSuggestions remaining={builder.remaining} rateCardItems={rateCard?.items ?? []} />
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={builder.notes}
              onChange={(event) => builder.setNotes(event.target.value)}
              placeholder="Add notes for this version..."
              rows={3}
              className="flex w-full resize-none rounded-md border border-sb-border-stronger bg-[rgba(250,250,250,0.027)] px-3 py-2 text-sm text-sb-text placeholder:text-sb-text-muted"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/quotes/${quoteId}`)}
          >
            Cancel
          </Button>
          <Button variant="secondary" onClick={saveVersion} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={saveAndClose} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? 'Saving...' : 'Save & Close'}
          </Button>
        </div>
      </div>
    </>
  );
}
