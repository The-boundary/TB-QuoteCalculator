import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Quote,
  QuoteWithVersions,
  QuoteVersionWithShots,
  QuoteStatus,
} from '../../../shared/types';

export interface QuoteListItem extends Quote {
  latest_version: {
    id: string;
    version_number: number;
    duration_seconds: number;
    pool_budget_hours: number;
    total_hours: number;
  } | null;
  version_count: number;
}

export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: () => api.get<QuoteListItem[]>('/quotes'),
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: () => api.get<QuoteWithVersions>(`/quotes/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { client_name: string; project_name: string; rate_card_id: string }) =>
      api.post<QuoteWithVersions>('/quotes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; client_name?: string; project_name?: string }) =>
      api.put<Quote>(`/quotes/${id}`, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', v.id] });
    },
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      api.put<Quote>(`/quotes/${id}/status`, { status }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', v.id] });
    },
  });
}

export function useArchiveQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Quote>(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      ...body
    }: {
      quoteId: string;
      duration_seconds: number;
      notes?: string;
      shots: Array<{
        shot_type: string;
        quantity: number;
        base_hours_each: number;
        efficiency_multiplier: number;
        sort_order: number;
      }>;
    }) => api.post<QuoteVersionWithShots>(`/quotes/${quoteId}/versions`, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', v.quoteId] });
    },
  });
}

export function useUpdateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      versionId,
      ...body
    }: {
      quoteId: string;
      versionId: string;
      duration_seconds: number;
      notes?: string;
      shots: Array<{
        shot_type: string;
        quantity: number;
        base_hours_each: number;
        efficiency_multiplier: number;
        sort_order: number;
      }>;
    }) => api.put<QuoteVersionWithShots>(`/quotes/${quoteId}/versions/${versionId}`, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', v.quoteId] });
    },
  });
}
