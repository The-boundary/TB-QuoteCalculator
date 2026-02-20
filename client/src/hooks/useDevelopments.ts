import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Development } from '../../../shared/types';

export type DevelopmentListItem = Development & { project_count: number };

export function useDevelopments() {
  return useQuery({
    queryKey: ['developments'],
    queryFn: () => api.get<DevelopmentListItem[]>('/developments'),
  });
}

export function useCreateDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; client_name?: string; description?: string }) =>
      api.post<Development>('/developments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['developments'] }),
  });
}
