// Re-export shared types
export type {
  Instance,
  InstanceStatus,
  NRUser,
  NRUserRole,
  NRProject,
  ProjectSyncStatus,
  Workspace,
  WorkspaceUser,
  WorkspaceRole,
  WorkspaceAccess,
  WorkspaceAccessRole,
  AuditLog,
  AuditAction,
  WSEvent,
  InstanceStatusEvent,
} from '@nr-fleet/shared-types';

// ─── Additional response types ────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}
