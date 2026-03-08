import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Workspace } from '@/types/api';

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  color: string;
}

export interface UpdateWorkspaceInput {
  id: string;
  name?: string;
  description?: string;
  color?: string;
}

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get<Workspace[]>('/workspaces');
      return data;
    },
  });
}

export function useWorkspace(id: string) {
  return useQuery<Workspace>({
    queryKey: ['workspaces', id],
    queryFn: async () => {
      const { data } = await api.get<Workspace>(`/workspaces/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation<Workspace, Error, CreateWorkspaceInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Workspace>('/workspaces', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation<Workspace, Error, UpdateWorkspaceInput>({
    mutationFn: async ({ id, ...patch }) => {
      const { data } = await api.put<Workspace>(`/workspaces/${id}`, patch);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      qc.setQueryData(['workspaces', data.id], data);
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.delete(`/workspaces/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}
