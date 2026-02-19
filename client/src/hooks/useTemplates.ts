import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FilmTemplateWithShots } from '../../../shared/types';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<FilmTemplateWithShots[]>('/templates'),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => api.get<FilmTemplateWithShots>(`/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      duration_seconds: number;
      description?: string | null;
      rate_card_id?: string | null;
      shots?: Array<{
        shot_type: string;
        quantity: number;
        efficiency_multiplier: number;
        sort_order?: number;
      }>;
    }) => api.post<FilmTemplateWithShots>('/templates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      duration_seconds?: number;
      description?: string | null;
      rate_card_id?: string | null;
      shots?: Array<{
        shot_type: string;
        quantity: number;
        efficiency_multiplier: number;
        sort_order?: number;
      }>;
    }) => api.put<FilmTemplateWithShots>(`/templates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}
