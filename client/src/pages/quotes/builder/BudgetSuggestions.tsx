import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import type { RateCardItem } from '@shared/types';

const CATEGORY_WEIGHT: Record<string, number> = {
  post: 3,
  animation: 2,
  scene: 1,
  material: 1,
  service: 2,
};

interface BudgetSuggestionsProps {
  remaining: number | null;
  rateCardItems: RateCardItem[];
}

export interface Suggestion {
  shot_type: string;
  category: string;
  quantity: number;
  total_hours: number;
  score: number;
}

const LINE_ITEM_TEMPLATES = [
  { name: 'Additional Editing', category: 'service', hours: 4 },
  { name: 'Creative Direction', category: 'service', hours: 6 },
  { name: 'Pre-Production', category: 'service', hours: 8 },
];

export function buildSuggestions(
  remaining: number | null,
  rateCardItems: RateCardItem[],
): Suggestion[] {
  if (remaining === null || remaining <= 0) return [];

  const results: Suggestion[] = [];

  for (const item of rateCardItems) {
    if (item.hours <= 0) continue;
    const qty = Math.floor(remaining / item.hours);
    if (qty < 1) continue;

    const weight = CATEGORY_WEIGHT[item.category] ?? 1;
    const totalHours = qty * item.hours;

    results.push({
      shot_type: item.shot_type,
      category: item.category,
      quantity: qty,
      total_hours: totalHours,
      score: totalHours * weight,
    });
  }

  // Add line-item suggestions
  for (const template of LINE_ITEM_TEMPLATES) {
    const qty = Math.floor(remaining / template.hours);
    if (qty < 1) continue;

    const weight = CATEGORY_WEIGHT[template.category] ?? 1;
    const totalHours = qty * template.hours;

    results.push({
      shot_type: template.name,
      category: template.category,
      quantity: qty,
      total_hours: totalHours,
      score: totalHours * weight,
    });
  }

  // Sort by weighted score descending, take top 5
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

export function BudgetSuggestions({ remaining, rateCardItems }: BudgetSuggestionsProps) {
  const suggestions = useMemo(
    () => buildSuggestions(remaining, rateCardItems),
    [remaining, rateCardItems],
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-sb-brand/20 bg-sb-brand/5 px-3 py-2.5">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sb-brand" />
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">You could add: </span>
        {suggestions.map((s, i) => (
          <span key={s.shot_type}>
            {i > 0 && (i === suggestions.length - 1 ? ' or ' : ', ')}
            <span className="text-foreground">
              {s.quantity} {s.shot_type}
              {s.quantity !== 1 ? 's' : ''}
            </span>{' '}
            ({s.total_hours.toFixed(0)}h)
          </span>
        ))}
      </p>
    </div>
  );
}
