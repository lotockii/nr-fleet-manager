import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NRUser } from '@/types/api';

export interface UsersResponse {
  users: NRUser[];
  syncedAt: string | null;
}

export interface AddUserResult {
  username: string;
  permissions: string;
  plainPassword?: string;
}

export interface ResetPasswordResult {
  username: string;
  plainPassword: string;
}

export function useInstanceUsers(instanceId: string) {
  return useQuery<UsersResponse>({
    queryKey: ['instance-users', instanceId],
    queryFn: async () => {
      const { data } = await api.get<UsersResponse>(`/instances/${instanceId}/users`);
      return data;
    },
    staleTime: 60_000,
  });
}

export function useRefreshUsers(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<UsersResponse, Error>({
    mutationFn: async () => {
      const { data } = await api.post<UsersResponse>(`/instances/${instanceId}/users/refresh`);
      return data;
    },
    onSuccess: (data) => qc.setQueryData(['instance-users', instanceId], data),
  });
}

export function useAddUser(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<
    AddUserResult,
    Error,
    { username: string; permissions: string; password?: string; generatePassword?: boolean }
  >({
    mutationFn: async (body) => {
      const { data } = await api.post<AddUserResult>(`/instances/${instanceId}/users`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-users', instanceId] }),
  });
}

export function useUpdateUser(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<{ username: string; permissions: string }, Error, { username: string; permissions: string }>({
    mutationFn: async ({ username, permissions }) => {
      const { data } = await api.put<{ username: string; permissions: string }>(
        `/instances/${instanceId}/users/${username}`,
        { permissions },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-users', instanceId] }),
  });
}

export function useResetPassword(instanceId: string) {
  return useMutation<
    ResetPasswordResult,
    Error,
    { username: string; password?: string; generatePassword?: boolean }
  >({
    mutationFn: async ({ username, ...body }) => {
      const { data } = await api.post<ResetPasswordResult>(
        `/instances/${instanceId}/users/${username}/reset-password`,
        body,
      );
      return data;
    },
  });
}

export function useDeleteUser(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (username) => {
      await api.delete(`/instances/${instanceId}/users/${username}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-users', instanceId] }),
  });
}
