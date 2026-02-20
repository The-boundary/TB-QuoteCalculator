import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useRateCard } from '@/hooks/useRateCards';
import { ItemRow } from './ItemRow';
import { AddItemRow } from './AddItemRow';
import type { RateCard } from '../../../../shared/types';

interface RateCardRowProps {
  rateCard: RateCard;
  isAdmin: boolean;
  onEdit: (rc: RateCard) => void;
}

export function RateCardRow({ rateCard, isAdmin, onEdit }: RateCardRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading: detailLoading } = useRateCard(
    expanded ? rateCard.id : undefined,
  );

  const items = detail?.items ?? [];
  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{rateCard.name}</span>
                {rateCard.is_default && <Badge>Default</Badge>}
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                <span>{rateCard.hours_per_second} hrs/sec</span>
                <span>{rateCard.editing_hours_per_30s} editing hrs/30s</span>
                <span>${rateCard.hourly_rate}/hr</span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(rateCard);
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          {detailLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shot Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && !isAdmin && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No items in this rate card.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} rateCardId={rateCard.id} isAdmin={isAdmin} />
                ))}
                {isAdmin && <AddItemRow rateCardId={rateCard.id} nextSortOrder={nextSortOrder} />}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}
