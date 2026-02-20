import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { KantataWorkspace } from '../../../shared/types';

export function useKantataSearch(search: string) {
  return useQuery({
    queryKey: ['kantata', 'workspaces', search],
    queryFn: () =>
      api.get<KantataWorkspace[]>(`/kantata/workspaces?search=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });
}
