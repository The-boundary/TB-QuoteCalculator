import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useRateCards } from '@/hooks/useRateCards';
import { RateCardDialog } from './rate-cards/RateCardDialog';
import { RateCardRow } from './rate-cards/RateCardRow';
import { RateCardsSkeleton } from './rate-cards/RateCardsSkeleton';
import type { RateCard } from '../../../shared/types';

export function RateCardsPage() {
  const { access } = useAuth();
  const isAdmin = access?.is_admin ?? false;
  const { data: rateCards, isLoading, error } = useRateCards();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);

  function handleCreate() {
    setEditingCard(null);
    setDialogOpen(true);
  }

  function handleEdit(rc: RateCard) {
    setEditingCard(rc);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Rate Cards"
        description="Manage production rate cards"
        actions={
          isAdmin ? (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              New Rate Card
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <RateCardsSkeleton />
        ) : error ? (
          <div className="mt-8 text-sm text-destructive">
            Failed to load rate cards. Please try again.
          </div>
        ) : !rateCards || rateCards.length === 0 ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            No rate cards yet.{isAdmin ? ' Create your first rate card.' : ''}
          </div>
        ) : (
          <div className="space-y-4">
            {rateCards.map((rc) => (
              <RateCardRow key={rc.id} rateCard={rc} isAdmin={isAdmin} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>

      <RateCardDialog open={dialogOpen} onOpenChange={setDialogOpen} rateCard={editingCard} />
    </>
  );
}
