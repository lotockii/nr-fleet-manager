import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Extended project type matching actual backend response
export interface ProjectWithMeta {
  name: string;
  hasGit: boolean;
  branch: string | null;
  remote: string | null;
  lastCommit: { hash: string; message: string | null; date: string | null } | null;
  isDirty: boolean;
  // Legacy fields (from check endpoint)
  syncStatus?: string;
  availableCommits?: Array<{ hash: string; message: string; author: string; date: string }>;
  previousCommits?: Array<{ hash: string; message: string; author: string; date: string }>;
  commitHash?: string;
  commitMessage?: string;
  lastCheckedAt?: string;
  behindBy?: number;
}

export interface Branch {
  name: string;
  hash: string;
  upstream: string | null;
  isCurrent: boolean;
  isRemote: boolean;
  isLocal: boolean;
}

export interface Commit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface BranchesResponse {
  branches: Branch[];
  commits: Commit[];
  remoteUrl: string | null;
}

export interface ProjectsResponse {
  projects: ProjectWithMeta[];
  syncedAt: string | null;
}

export function useInstanceProjects(instanceId: string) {
  return useQuery<ProjectsResponse>({
    queryKey: ['instance-projects', instanceId],
    queryFn: async () => {
      const { data } = await api.get<ProjectsResponse>(`/instances/${instanceId}/projects`);
      return data;
    },
    staleTime: 60_000,
  });
}

export function useRefreshProjects(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<ProjectsResponse, Error>({
    mutationFn: async () => {
      const { data } = await api.post<ProjectsResponse>(`/instances/${instanceId}/projects/refresh`);
      return data;
    },
    onSuccess: (data) => qc.setQueryData(['instance-projects', instanceId], data),
  });
}

export function usePullProject(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<any, Error, { projectName: string; branch?: string }>({
    mutationFn: async ({ projectName, branch }) => {
      const { data } = await api.post(
        `/instances/${instanceId}/projects/${encodeURIComponent(projectName)}/pull`,
        { branch },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-projects', instanceId] }),
  });
}

export function useProjectBranches(instanceId: string, projectName: string, enabled: boolean) {
  return useQuery<BranchesResponse>({
    queryKey: ['project-branches', instanceId, projectName],
    queryFn: async () => {
      const { data } = await api.get<BranchesResponse>(
        `/instances/${instanceId}/projects/${encodeURIComponent(projectName)}/branches`,
      );
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCheckProjectUpdates(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: async (projectName) => {
      const { data } = await api.post(`/instances/${instanceId}/projects/${projectName}/check`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-projects', instanceId] }),
  });
}

export function usePushProject(instanceId: string) {
  return useMutation<{ output: string }, Error, { projectName: string; localBranch: string; remoteBranch?: string }>({
    mutationFn: async ({ projectName, localBranch, remoteBranch }) => {
      const { data } = await api.post(
        `/instances/${instanceId}/projects/${encodeURIComponent(projectName)}/push`,
        { localBranch, remoteBranch }
      );
      return data;
    },
  });
}

export function useRollbackProject(instanceId: string) {
  const qc = useQueryClient();
  return useMutation<any, Error, { projectName: string; commitHash: string }>({
    mutationFn: async ({ projectName, commitHash }) => {
      const { data } = await api.post(
        `/instances/${instanceId}/projects/${encodeURIComponent(projectName)}/rollback`,
        { commitHash },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instance-projects', instanceId] }),
  });
}
