import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Instance } from '@/types/api';
import { useWorkspaceStore } from '@/store/workspace';

export interface CreateInstanceInput {
  name: string;
  host: string;
  port: number;
  tags?: string[];
}

export interface UpdateInstanceInput {
  id: string;
  name?: string;
  host?: string;
  port?: number;
  tags?: string[];
}

export function useInstances(options?: { ignoreWorkspaceFilter?: boolean }) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const effectiveWorkspaceId = options?.ignoreWorkspaceFilter ? null : activeWorkspaceId;

  return useQuery<Instance[]>({
    queryKey: ['instances', effectiveWorkspaceId],
    queryFn: async () => {
      const { data } = await api.get<Instance[]>('/instances', {
        params: effectiveWorkspaceId ? { workspaceId: effectiveWorkspaceId } : undefined,
      });
      return data;
    },
  });
}

export function useInstance(id: string) {
  return useQuery<Instance>({
    queryKey: ['instances', id],
    queryFn: async () => {
      const { data } = await api.get<Instance>(`/instances/${id}`);
      return data;
    },
  });
}

export function useAddInstance() {
  const qc = useQueryClient();
  return useMutation<Instance, Error, CreateInstanceInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Instance>('/instances', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.delete(`/instances/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instances'] }),
  });
}

export function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation<Instance, Error, UpdateInstanceInput>({
    mutationFn: async ({ id, ...patch }) => {
      const { data } = await api.put<Instance>(`/instances/${id}`, patch);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      qc.setQueryData(['instances', data.id], data);
    },
  });
}

function useInstanceAction(action: 'start' | 'stop' | 'restart') {
  const qc = useQueryClient();
  return useMutation<Instance, Error, string>({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Instance>(`/instances/${id}/${action}`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['instances'] });
      qc.setQueryData(['instances', data.id], data);
    },
  });
}

export const useStartInstance = () => useInstanceAction('start');
export const useStopInstance = () => useInstanceAction('stop');
export const useRestartInstance = () => useInstanceAction('restart');

export interface BulkActionInput {
  ids: string[];
  action: 'start' | 'stop' | 'restart';
}

export interface BulkActionResult {
  id: string;
  success: boolean;
  error?: string;
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation<{ results: BulkActionResult[] }, Error, BulkActionInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<{ results: BulkActionResult[] }>('/instances/bulk-action', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instances'] });
    },
  });
}
