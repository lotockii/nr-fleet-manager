import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WorkspaceAccess, WorkspaceAccessRole, WorkspaceUser } from '@/types/api';

// ─── GET /workspaces/:id/access ───────────────────────────────────────────────

export function useWorkspaceAccess(workspaceId: string) {
  return useQuery<WorkspaceAccess[]>({
    queryKey: ['workspaces', workspaceId, 'access'],
    queryFn: async () => {
      const { data } = await api.get<WorkspaceAccess[]>(`/workspaces/${workspaceId}/access`);
      return data;
    },
    enabled: !!workspaceId,
  });
}

// ─── GET /workspaces/:id/available-users ─────────────────────────────────────

export function useAvailableUsers(workspaceId: string) {
  return useQuery<WorkspaceUser[]>({
    queryKey: ['workspaces', workspaceId, 'available-users'],
    queryFn: async () => {
      const { data } = await api.get<WorkspaceUser[]>(`/workspaces/${workspaceId}/available-users`);
      return data;
    },
    enabled: !!workspaceId,
  });
}

// ─── POST /workspaces/:id/access ──────────────────────────────────────────────

export interface GrantAccessInput {
  userId: string;
  role: WorkspaceAccessRole;
}

export function useGrantAccess(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation<WorkspaceAccess, Error, GrantAccessInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<WorkspaceAccess>(`/workspaces/${workspaceId}/access`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'access'] });
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'available-users'] });
    },
  });
}

// ─── PUT /workspaces/:id/access/:accessId ─────────────────────────────────────

export interface UpdateAccessInput {
  accessId: string;
  role: WorkspaceAccessRole;
}

export function useUpdateAccess(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation<WorkspaceAccess, Error, UpdateAccessInput>({
    mutationFn: async ({ accessId, role }) => {
      const { data } = await api.put<WorkspaceAccess>(`/workspaces/${workspaceId}/access/${accessId}`, { role });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'access'] });
    },
  });
}

// ─── DELETE /workspaces/:id/access/:accessId ──────────────────────────────────

export function useRevokeAccess(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (accessId: string) => {
      await api.delete(`/workspaces/${workspaceId}/access/${accessId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'access'] });
      qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'available-users'] });
    },
  });
}
