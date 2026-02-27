import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Quote,
  QuoteMode,
  QuoteStatus,
  QuoteWithVersions,
  QuoteVersionWithShots,
} from '../../../shared/types';

export interface QuoteListItem extends Quote {
  project_name: string;
  kantata_id: string | null;
  is_forecasted: boolean;
  development_id: string;
  development_name: string;
  development_client_name: string | null;
  latest_version: {
    id: string;
    version_number: number;
    duration_seconds: number;
    shot_count: number;
    pool_budget_hours: number | null;
    pool_budget_amount: number | null;
    total_hours: number;
    hourly_rate: number;
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
    mutationFn: (body: { project_id: string; mode: QuoteMode; rate_card_id: string }) =>
      api.post<QuoteWithVersions>('/quotes', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      api.put<Quote>(`/quotes/${id}/status`, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', vars.id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useArchiveQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Quote>(`/quotes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export interface QuoteShotPayload {
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  sort_order: number;
}

export interface QuoteLineItemPayload {
  name: string;
  category: 'service' | 'deliverable' | 'pre_production';
  hours_each: number;
  quantity: number;
  notes?: string | null;
  sort_order: number;
}

export interface QuoteModulePayload {
  id?: string;
  name: string;
  module_type: 'film' | 'supplementary';
  duration_seconds: number;
  animation_complexity: 'regular' | 'complex';
  sort_order: number;
  shots: QuoteShotPayload[];
}

export interface QuoteVersionPayload {
  mode?: QuoteMode;
  duration_seconds: number;
  hourly_rate?: number;
  pool_budget_hours?: number | null;
  pool_budget_amount?: number | null;
  notes?: string;
  modules?: QuoteModulePayload[];
  shots?: QuoteShotPayload[];
  line_items?: QuoteLineItemPayload[];
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, ...body }: { quoteId: string } & QuoteVersionPayload) =>
      api.post<QuoteVersionWithShots>(`/quotes/${quoteId}/versions`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', vars.quoteId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
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
    } & Partial<QuoteVersionPayload>) =>
      api.put<QuoteVersionWithShots>(`/quotes/${quoteId}/versions/${versionId}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quotes', vars.quoteId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
