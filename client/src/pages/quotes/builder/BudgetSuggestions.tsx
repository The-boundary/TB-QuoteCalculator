import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import type { RateCardItem } from '../../../../../shared/types';

interface BudgetSuggestionsProps {
  remaining: number;
  rateCardItems: RateCardItem[];
  existingShotTypes: string[];
}

interface Suggestion {
  shot_type: string;
  quantity: number;
  total_hours: number;
}

export function BudgetSuggestions({
  remaining,
  rateCardItems,
  existingShotTypes,
}: BudgetSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (remaining <= 0 || rateCardItems.length === 0) return [];

    const results: Suggestion[] = [];

    for (const item of rateCardItems) {
      if (item.hours <= 0) continue;
      const qty = Math.floor(remaining / item.hours);
      if (qty < 1) continue;

      results.push({
        shot_type: item.shot_type,
        quantity: qty,
        total_hours: qty * item.hours,
      });
    }

    // Sort by total hours descending (most budget-filling first), take top 3
    results.sort((a, b) => b.total_hours - a.total_hours);
    return results.slice(0, 3);
  }, [remaining, rateCardItems, existingShotTypes]);

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
