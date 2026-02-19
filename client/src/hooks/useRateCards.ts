import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RateCard, RateCardWithItems } from '../../../shared/types';

export function useRateCards() {
  return useQuery({
    queryKey: ['rate-cards'],
    queryFn: () => api.get<RateCard[]>('/rate-cards'),
  });
}

export function useRateCard(id: string | undefined) {
  return useQuery({
    queryKey: ['rate-cards', id],
    queryFn: () => api.get<RateCardWithItems>(`/rate-cards/${id}`),
    enabled: !!id,
  });
}

export function useDefaultRateCard() {
  const { data: rateCards } = useRateCards();
  const defaultCard = rateCards?.find((rc) => rc.is_default) ?? rateCards?.[0];
  return useRateCard(defaultCard?.id);
}

export function useCreateRateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; hours_per_second: number; editing_hours_per_30s?: number; is_default?: boolean }) =>
      api.post<RateCard>('/rate-cards', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-cards'] }),
  });
}

export function useUpdateRateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; hours_per_second?: number; editing_hours_per_30s?: number; is_default?: boolean }) =>
      api.put<RateCard>(`/rate-cards/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-cards'] }),
  });
}

export function useAddRateCardItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rateCardId, ...body }: { rateCardId: string; shot_type: string; category: string; hours: number; sort_order?: number }) =>
      api.post(`/rate-cards/${rateCardId}/items`, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['rate-cards', v.rateCardId] }),
  });
}

export function useUpdateRateCardItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rateCardId, itemId, ...body }: { rateCardId: string; itemId: string; shot_type?: string; category?: string; hours?: number; sort_order?: number }) =>
      api.put(`/rate-cards/${rateCardId}/items/${itemId}`, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['rate-cards', v.rateCardId] }),
  });
}

export function useDeleteRateCardItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rateCardId, itemId }: { rateCardId: string; itemId: string }) =>
      api.delete(`/rate-cards/${rateCardId}/items/${itemId}`),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['rate-cards', v.rateCardId] }),
  });
}
