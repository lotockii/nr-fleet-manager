// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

// ─── Instance ───────────────────────────────────────────────────────────────

export type InstanceStatus = 'online' | 'offline' | 'unknown' | 'error';

export interface Instance {
  id: string;
  name: string;
  host: string;
  port: number;
  tags: string[];
  status: InstanceStatus;
  nodeRedVersion?: string;
  nodeVersion?: string;
  osName?: string;
  osVersion?: string;
  osArch?: string;
  uptimeSeconds?: number;
  memoryMB?: number;
  memoryTotalMB?: number;
  cpuPercent?: number;
  cpuLoad1m?: number;
  diskUsedMB?: number;
  diskTotalMB?: number;
  diskFreeMB?: number;
  runMode?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── NR User ─────────────────────────────────────────────────────────────────

export type NRUserRole = 'admin' | 'editor' | 'read-only';

export interface NRUser {
  username: string;
  role: NRUserRole;
  permissions?: string[];
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectSyncStatus = 'up-to-date' | 'behind' | 'dirty' | 'unknown';

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface NRProject {
  name: string;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  syncStatus: ProjectSyncStatus;
  behindBy?: number;
  lastCheckedAt?: string;
  availableCommits?: CommitInfo[];
  previousCommits?: CommitInfo[];
}

// ─── Workspace User ───────────────────────────────────────────────────────────

export type WorkspaceRole = 'super_admin' | 'operator' | 'viewer';

// ─── Workspace Access ─────────────────────────────────────────────────────────

export type WorkspaceAccessRole = 'workspace_admin' | 'workspace_operator' | 'workspace_viewer';

export interface WorkspaceAccess {
  id: string;
  workspaceId: string;
  userId: string;       // WorkspaceUser.id
  userEmail: string;    // для відображення
  userName: string;     // для відображення
  role: WorkspaceAccessRole;
  grantedAt: string;
}

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export type AuditAction =
  | 'instance.start'
  | 'instance.stop'
  | 'instance.restart'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'project.pull'
  | 'project.rollback'
  | 'auth.login'
  | 'auth.logout';

export interface AuditLog {
  id: string;
  action: AuditAction;
  instanceId?: string;
  performedBy: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export interface WSEvent<T = unknown> {
  type: string;
  payload: T;
}

export interface InstanceStatusEvent {
  instanceId: string;
  status: InstanceStatus;
  timestamp: string;
  // Real-time metrics from agent heartbeat
  uptimeSeconds?: number;
  memoryMB?: number;
  memoryTotalMB?: number;
  cpuPercent?: number;
  cpuLoad1m?: number;
  diskUsedMB?: number;
  diskTotalMB?: number;
  diskFreeMB?: number;
  nodeRedVersion?: string;
  nodeVersion?: string;
  osName?: string;
  osVersion?: string;
  osArch?: string;
  runMode?: string;
}
