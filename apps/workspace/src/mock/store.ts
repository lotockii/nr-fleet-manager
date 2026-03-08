import { randomUUID } from 'crypto';
import type { Instance, InstanceStatus, NRUser, NRProject, CommitInfo, AuditLog, AuditAction, WorkspaceUser, WorkspaceRole, Workspace, WorkspaceAccess, WorkspaceAccessRole } from '@nr-fleet/shared-types';
import { initialInstances, initialUsers, initialProjects, initialAuditLogs, workspaceUsers as initialWorkspaceUsers, initialWorkspaces, initialWorkspaceAccess } from './data.js';

export type CreateInstanceInput = {
  name: string;
  host: string;
  port: number;
  tags?: string[];
  workspaceId?: string;
};

// ─── In-memory state ──────────────────────────────────────────────────────────

let instances: Instance[] = structuredClone(initialInstances);
const users: Record<string, NRUser[]> = structuredClone(initialUsers);
const projects: Record<string, NRProject[]> = structuredClone(initialProjects);
let auditLogs: AuditLog[] = structuredClone(initialAuditLogs);
let workspaceUsers: WorkspaceUser[] = structuredClone(initialWorkspaceUsers);
let workspaces: Workspace[] = structuredClone(initialWorkspaces);
let workspaceAccess: WorkspaceAccess[] = structuredClone(initialWorkspaceAccess);

// Mock password store: email → password
const workspacePasswords = new Map<string, string>([
  ['admin@admin.com', 'admin123'],
  ['operator@example.com', 'operator123'],
  ['viewer@example.com', 'viewer123'],
]);

// ─── Workspaces ───────────────────────────────────────────────────────────────

export function getWorkspaces(): Workspace[] {
  return workspaces;
}

export function getWorkspace(id: string): Workspace | undefined {
  return workspaces.find((w) => w.id === id);
}

export function createWorkspace(data: { name: string; description?: string; color: string }): Workspace {
  const workspace: Workspace = {
    id: `ws-${randomUUID().slice(0, 8)}`,
    name: data.name,
    description: data.description,
    color: data.color,
    createdAt: new Date().toISOString(),
  };
  workspaces.push(workspace);
  return workspace;
}

export function updateWorkspace(id: string, patch: Partial<Pick<Workspace, 'name' | 'description' | 'color'>>): Workspace | undefined {
  const ws = workspaces.find((w) => w.id === id);
  if (!ws) return undefined;
  if (patch.name !== undefined) ws.name = patch.name;
  if (patch.description !== undefined) ws.description = patch.description;
  if (patch.color !== undefined) ws.color = patch.color;
  return ws;
}

export function deleteWorkspace(id: string): boolean {
  const idx = workspaces.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  workspaces.splice(idx, 1);
  return true;
}

export function getWorkspaceInstanceCount(id: string): number {
  return instances.filter((i) => i.workspaceId === id).length;
}

// ─── Instances ────────────────────────────────────────────────────────────────

export interface GetInstancesFilters {
  workspaceId?: string;
}

export function getInstances(filters?: GetInstancesFilters): Instance[] {
  if (!filters?.workspaceId) return instances;
  return instances.filter((i) => i.workspaceId === filters.workspaceId);
}

export function getInstance(id: string): Instance | undefined {
  return instances.find((i) => i.id === id);
}

export function createInstance(input: CreateInstanceInput): Instance {
  const now = new Date().toISOString();
  const inst: Instance = {
    id: `inst-${randomUUID().slice(0, 8)}`,
    name: input.name,
    host: input.host,
    port: input.port,
    tags: input.tags ?? [],
    status: 'offline',
    uptimeSeconds: 0,
    workspaceId: input.workspaceId ?? workspaces[0]?.id ?? 'ws-1',
    createdAt: now,
    updatedAt: now,
  };
  instances.push(inst);
  return inst;
}

export function updateInstanceStatus(id: string, status: InstanceStatus): Instance | undefined {
  const inst = instances.find((i) => i.id === id);
  if (!inst) return undefined;
  inst.status = status;
  inst.updatedAt = new Date().toISOString();
  if (status === 'online') {
    inst.uptimeSeconds = 0;
  } else if (status === 'offline') {
    inst.uptimeSeconds = 0;
  }
  return inst;
}

export type UpdateInstancePatch = {
  name?: string;
  host?: string;
  port?: number;
  tags?: string[];
};

export function updateInstance(id: string, patch: UpdateInstancePatch): Instance | undefined {
  const inst = instances.find((i) => i.id === id);
  if (!inst) return undefined;
  if (patch.name !== undefined) inst.name = patch.name;
  if (patch.host !== undefined) inst.host = patch.host;
  if (patch.port !== undefined) inst.port = patch.port;
  if (patch.tags !== undefined) inst.tags = patch.tags;
  inst.updatedAt = new Date().toISOString();
  return inst;
}

export function deleteInstance(id: string): boolean {
  const idx = instances.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  instances.splice(idx, 1);
  return true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUsers(instanceId: string): NRUser[] {
  return users[instanceId] ?? [];
}

export function addUser(instanceId: string, user: NRUser): NRUser {
  if (!users[instanceId]) users[instanceId] = [];
  users[instanceId].push(user);
  return user;
}

export function updateUser(
  instanceId: string,
  username: string,
  patch: Partial<Omit<NRUser, 'username'>>,
): NRUser | undefined {
  const list = users[instanceId] ?? [];
  const user = list.find((u) => u.username === username);
  if (!user) return undefined;
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.permissions !== undefined) user.permissions = patch.permissions;
  return user;
}

export function deleteUser(instanceId: string, username: string): boolean {
  const list = users[instanceId];
  if (!list) return false;
  const idx = list.findIndex((u) => u.username === username);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

// Mock commit data pool for realistic simulation
const MOCK_COMMIT_POOL: Array<{ message: string; author: string }> = [
  { message: 'feat: add new sensor integration', author: 'John Operator' },
  { message: 'fix: resolve MQTT reconnection issue', author: 'Admin User' },
  { message: 'refactor: optimize flow execution pipeline', author: 'Olena Koval' },
  { message: 'chore: update Node-RED dependencies', author: 'Admin User' },
  { message: 'feat: improve dashboard telemetry', author: 'John Operator' },
  { message: 'fix: correct threshold calculation edge case', author: 'Olena Koval' },
  { message: 'docs: update flow documentation', author: 'Admin User' },
  { message: 'feat: add webhook notification support', author: 'John Operator' },
];

function generateMockCommits(count: number): CommitInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const pool = MOCK_COMMIT_POOL[(i + Math.floor(Math.random() * MOCK_COMMIT_POOL.length)) % MOCK_COMMIT_POOL.length];
    return {
      hash: randomUUID().slice(0, 7),
      message: pool.message,
      author: pool.author,
      date: new Date(Date.now() - i * 3600000).toISOString(),
    };
  });
}

export function getProjects(instanceId: string): NRProject[] {
  return projects[instanceId] ?? [];
}

export function checkProjectUpdates(instanceId: string, name: string): NRProject | undefined {
  const list = projects[instanceId] ?? [];
  const project = list.find((p) => p.name === name);
  if (!project) return undefined;

  project.lastCheckedAt = new Date().toISOString();

  if (project.syncStatus === 'dirty') {
    // Local changes — no remote updates available
    project.availableCommits = [];
  } else if (project.syncStatus === 'behind') {
    // Already known to be behind — generate 1-3 new commits
    const count = (project.behindBy ?? 0) > 0 ? Math.min(project.behindBy!, 3) : Math.floor(Math.random() * 3) + 1;
    project.availableCommits = generateMockCommits(count);
    project.behindBy = project.availableCommits.length;
  } else {
    // up-to-date or unknown — 30% chance of finding new commits
    if (Math.random() < 0.3) {
      const count = Math.floor(Math.random() * 2) + 1;
      project.availableCommits = generateMockCommits(count);
      project.syncStatus = 'behind';
      project.behindBy = project.availableCommits.length;
    } else {
      project.availableCommits = [];
      project.syncStatus = 'up-to-date';
      project.behindBy = 0;
    }
  }

  return project;
}

export function pullProject(instanceId: string, name: string): NRProject | undefined {
  const list = projects[instanceId] ?? [];
  const project = list.find((p) => p.name === name);
  if (!project) return undefined;

  // Determine new commit — from availableCommits or generate one
  const newCommit = project.availableCommits?.[0] ?? {
    hash: randomUUID().slice(0, 7),
    message: 'chore: synced from remote',
    author: 'system',
    date: new Date().toISOString(),
  };

  // Save current commit to previousCommits (prepend)
  if (project.commitHash) {
    const prev: CommitInfo = {
      hash: project.commitHash,
      message: project.commitMessage ?? 'previous commit',
      author: 'system',
      date: new Date().toISOString(),
    };
    project.previousCommits = [prev, ...(project.previousCommits ?? [])];
  }

  // Apply new commit
  project.commitHash = newCommit.hash;
  project.commitMessage = newCommit.message;
  project.syncStatus = 'up-to-date';
  project.behindBy = 0;
  project.availableCommits = [];

  return project;
}

export function rollbackProject(instanceId: string, name: string, targetCommitHash: string): NRProject | undefined {
  const list = projects[instanceId] ?? [];
  const project = list.find((p) => p.name === name);
  if (!project) return undefined;

  const targetCommit = (project.previousCommits ?? []).find((c) => c.hash === targetCommitHash);
  if (!targetCommit) return undefined;

  // Save current commit to previousCommits (prepend) before rollback
  if (project.commitHash) {
    const current: CommitInfo = {
      hash: project.commitHash,
      message: project.commitMessage ?? 'pre-rollback commit',
      author: 'system',
      date: new Date().toISOString(),
    };
    project.previousCommits = [current, ...(project.previousCommits ?? []).filter((c) => c.hash !== targetCommitHash)];
  }

  project.commitHash = targetCommit.hash;
  project.commitMessage = targetCommit.message;
  project.syncStatus = 'up-to-date';
  project.behindBy = 0;
  project.availableCommits = [];

  return project;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogsQuery {
  instanceId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogsResult {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export function getAuditLogs(query: AuditLogsQuery = {}): AuditLogsResult {
  const { instanceId, action, from, to, limit = 50, offset = 0 } = query;
  const effectiveLimit = Math.min(limit, 200);

  let filtered = auditLogs;

  if (instanceId) {
    filtered = filtered.filter((l) => l.instanceId === instanceId);
  }
  if (action) {
    filtered = filtered.filter((l) => l.action === action);
  }
  if (from) {
    const fromDate = new Date(from).getTime();
    filtered = filtered.filter((l) => new Date(l.createdAt).getTime() >= fromDate);
  }
  if (to) {
    const toDate = new Date(to).getTime();
    filtered = filtered.filter((l) => new Date(l.createdAt).getTime() <= toDate);
  }

  const total = filtered.length;
  const data = filtered.slice(offset, offset + effectiveLimit);

  return { data, total, limit: effectiveLimit, offset };
}

// ─── Workspace Users ──────────────────────────────────────────────────────────

export function getWorkspaceUsers(): WorkspaceUser[] {
  return workspaceUsers;
}

export function getWorkspaceUser(id: string): WorkspaceUser | undefined {
  return workspaceUsers.find((u) => u.id === id);
}

export function findWorkspaceUserByEmail(email: string): WorkspaceUser | undefined {
  return workspaceUsers.find((u) => u.email === email);
}

export function checkWorkspacePassword(email: string, password: string): boolean {
  return workspacePasswords.get(email) === password;
}

export function createWorkspaceUser(data: {
  email: string;
  name: string;
  role: WorkspaceRole;
  password: string;
}): WorkspaceUser {
  const user: WorkspaceUser = {
    id: `wu-${randomUUID().slice(0, 8)}`,
    email: data.email,
    name: data.name,
    role: data.role,
    createdAt: new Date().toISOString(),
  };
  workspaceUsers.push(user);
  workspacePasswords.set(data.email, data.password);
  return user;
}

export function updateWorkspaceUser(
  id: string,
  patch: Partial<Pick<WorkspaceUser, 'name' | 'role'>>,
): WorkspaceUser | undefined {
  const user = workspaceUsers.find((u) => u.id === id);
  if (!user) return undefined;
  if (patch.name !== undefined) user.name = patch.name;
  if (patch.role !== undefined) user.role = patch.role;
  return user;
}

export function deleteWorkspaceUser(id: string): boolean {
  const idx = workspaceUsers.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  const user = workspaceUsers[idx];
  workspacePasswords.delete(user.email);
  workspaceUsers.splice(idx, 1);
  return true;
}

export function changeWorkspacePassword(email: string, newPassword: string): void {
  workspacePasswords.set(email, newPassword);
}

// ─── Workspace Access ─────────────────────────────────────────────────────────

export function getWorkspaceAccess(workspaceId: string): WorkspaceAccess[] {
  return workspaceAccess.filter((a) => a.workspaceId === workspaceId);
}

export function getAllWorkspaceAccess(): WorkspaceAccess[] {
  return workspaceAccess;
}

export function grantWorkspaceAccess(data: {
  workspaceId: string;
  userId: string;
  role: WorkspaceAccessRole;
}): WorkspaceAccess {
  const user = workspaceUsers.find((u) => u.id === data.userId);
  const entry: WorkspaceAccess = {
    id: `wa-${randomUUID().slice(0, 8)}`,
    workspaceId: data.workspaceId,
    userId: data.userId,
    userEmail: user?.email ?? '',
    userName: user?.name ?? '',
    role: data.role,
    grantedAt: new Date().toISOString(),
  };
  workspaceAccess.push(entry);
  return entry;
}

export function updateWorkspaceAccess(id: string, role: WorkspaceAccessRole): WorkspaceAccess | undefined {
  const entry = workspaceAccess.find((a) => a.id === id);
  if (!entry) return undefined;
  entry.role = role;
  return entry;
}

export function revokeWorkspaceAccess(id: string): boolean {
  const idx = workspaceAccess.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  workspaceAccess.splice(idx, 1);
  return true;
}

export function hasWorkspaceAccess(userId: string, workspaceId: string): boolean {
  return workspaceAccess.some((a) => a.userId === userId && a.workspaceId === workspaceId);
}

export function getUserWorkspaceRole(userId: string, workspaceId: string): WorkspaceAccessRole | null {
  const entry = workspaceAccess.find((a) => a.userId === userId && a.workspaceId === workspaceId);
  return entry?.role ?? null;
}

// ─── Audit Logs (append) ──────────────────────────────────────────────────────

export function addAuditLog(
  action: AuditAction,
  performedBy: string,
  details: Record<string, unknown> = {},
  instanceId?: string,
): AuditLog {
  const log: AuditLog = {
    id: `log-${randomUUID().slice(0, 8)}`,
    action,
    instanceId,
    performedBy,
    details,
    createdAt: new Date().toISOString(),
  };
  auditLogs = [log, ...auditLogs];
  return log;
}
