import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project, QuoteStatus } from '../../../shared/types';

export interface ProjectListItem extends Project {
  development_name: string;
  development_client_name: string | null;
  quote_count: number;
  latest_quote_status: QuoteStatus | null;
}

export interface ProjectDetail extends ProjectListItem {
  quotes: Array<{
    id: string;
    mode: 'retainer' | 'budget';
    status: QuoteStatus;
    rate_card_id: string;
    created_at: string;
    updated_at: string;
    latest_version: {
      id: string;
      version_number: number;
      duration_seconds: number;
      total_hours: number;
      shot_count: number;
      pool_budget_hours: number | null;
      pool_budget_amount: number | null;
      hourly_rate: number;
    } | null;
    version_count: number;
  }>;
}

export function useProjects(opts?: { forecasted?: boolean; search?: string }) {
  const params = new URLSearchParams();
  if (opts?.forecasted !== undefined) params.set('forecasted', String(opts.forecasted));
  if (opts?.search) params.set('search', opts.search);
  const queryString = params.toString();

  return useQuery({
    queryKey: ['projects', opts],
    queryFn: () => api.get<ProjectListItem[]>(`/projects${queryString ? `?${queryString}` : ''}`),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { development_id: string; name: string; kantata_id?: string }) =>
      api.post<Project>('/projects', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['developments'] });
    },
  });
}

export function useLinkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kantata_id }: { id: string; kantata_id: string }) =>
      api.post<Project>(`/projects/${id}/link`, { kantata_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
