import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/currency';
import type { BuilderLineItem } from './useBuilderState';

const CATEGORY_LABELS: Record<string, string> = {
  service: 'Service',
  deliverable: 'Deliverable',
  pre_production: 'Pre-Production',
};

interface LineItemsSectionProps {
  lineItems: BuilderLineItem[];
  showPricing: boolean;
  hourlyRate: number;
  onAdd: (item: Omit<BuilderLineItem, 'sort_order'>) => void;
  onUpdate: (index: number, updates: Partial<BuilderLineItem>) => void;
  onRemove: (index: number) => void;
}

export function LineItemsSection({
  lineItems,
  showPricing,
  hourlyRate,
  onAdd,
  onUpdate,
  onRemove,
}: LineItemsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Additional Items</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onAdd({
                name: '',
                category: 'service',
                hours_each: 0,
                quantity: 1,
                notes: '',
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lineItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No additional items. Add services, deliverables, or pre-production items.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_140px_80px_80px_90px_32px] items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Category</span>
              <span className="text-right">Hrs Each</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {lineItems.map((item, index) => {
              const totalHrs = item.hours_each * item.quantity;
              return (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_140px_80px_80px_90px_32px] items-center gap-2"
                >
                  <Input
                    value={item.name}
                    onChange={(e) => onUpdate(index, { name: e.target.value })}
                    placeholder="Item name..."
                    className="h-8 text-sm"
                  />
                  <Select
                    value={item.category}
                    onValueChange={(value) =>
                      onUpdate(index, {
                        category: value as BuilderLineItem['category'],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={item.hours_each}
                    onChange={(e) =>
                      onUpdate(index, { hours_each: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="h-8 text-right text-sm"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdate(index, {
                        quantity: Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1))),
                      })
                    }
                    className="h-8 text-right text-sm"
                  />
                  <div className="text-right text-sm tabular-nums">
                    {totalHrs.toFixed(1)} hrs
                    {showPricing && (
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(totalHrs * hourlyRate)}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
