import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WorkspaceUser, WorkspaceRole } from '@/types/api';

export function useWorkspaceUsers() {
  return useQuery<WorkspaceUser[]>({
    queryKey: ['workspace-users'],
    queryFn: async () => {
      const { data } = await api.get<WorkspaceUser[]>('/workspace-users');
      return data;
    },
  });
}

export interface CreateWorkspaceUserInput {
  email: string;
  name: string;
  role: WorkspaceRole;
  password: string;
}

export function useCreateWorkspaceUser() {
  const qc = useQueryClient();
  return useMutation<WorkspaceUser, Error, CreateWorkspaceUserInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<WorkspaceUser>('/workspace-users', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-users'] }),
  });
}

export interface UpdateWorkspaceUserInput {
  id: string;
  name?: string;
  role?: WorkspaceRole;
}

export function useUpdateWorkspaceUser() {
  const qc = useQueryClient();
  return useMutation<WorkspaceUser, Error, UpdateWorkspaceUserInput>({
    mutationFn: async ({ id, ...patch }) => {
      const { data } = await api.put<WorkspaceUser>(`/workspace-users/${id}`, patch);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-users'] }),
  });
}

export function useDeleteWorkspaceUser() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.delete(`/workspace-users/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-users'] }),
  });
}
