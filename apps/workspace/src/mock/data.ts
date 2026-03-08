import type { Instance, NRUser, NRProject, AuditLog, WorkspaceUser, Workspace, WorkspaceAccess } from '@nr-fleet/shared-types';

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const initialWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Production',
    description: 'Продакшн інстанси',
    color: '#ef4444',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'ws-2',
    name: 'Staging',
    description: 'Стейджинг середовище',
    color: '#f59e0b',
    createdAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'ws-3',
    name: 'Development',
    description: 'Розробка',
    color: '#3b82f6',
    createdAt: '2024-03-01T00:00:00.000Z',
  },
];

// ─── Workspace Users ──────────────────────────────────────────────────────────

export const workspaceUsers: WorkspaceUser[] = [
  {
    id: 'wu-1',
    email: 'admin@admin.com',
    name: 'Admin User',
    role: 'super_admin',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'wu-2',
    email: 'operator@example.com',
    name: 'John Operator',
    role: 'operator',
    createdAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'wu-3',
    email: 'viewer@example.com',
    name: 'Jane Viewer',
    role: 'viewer',
    createdAt: '2024-03-01T00:00:00.000Z',
  },
];

// ─── Workspace Access ─────────────────────────────────────────────────────────
// wu-1 = Admin (super_admin), wu-2 = John Operator (operator), wu-3 = Jane Viewer (viewer)

export const initialWorkspaceAccess: WorkspaceAccess[] = [
  // ws-1 (Production): admin → workspace_admin, operator → workspace_operator
  {
    id: 'wa-1',
    workspaceId: 'ws-1',
    userId: 'wu-1',
    userEmail: 'admin@admin.com',
    userName: 'Admin User',
    role: 'workspace_admin',
    grantedAt: '2024-01-10T10:00:00.000Z',
  },
  {
    id: 'wa-2',
    workspaceId: 'ws-1',
    userId: 'wu-2',
    userEmail: 'operator@example.com',
    userName: 'John Operator',
    role: 'workspace_operator',
    grantedAt: '2024-01-15T12:00:00.000Z',
  },
  // ws-2 (Staging): admin → workspace_admin, operator → workspace_operator
  {
    id: 'wa-3',
    workspaceId: 'ws-2',
    userId: 'wu-1',
    userEmail: 'admin@admin.com',
    userName: 'Admin User',
    role: 'workspace_admin',
    grantedAt: '2024-02-05T09:00:00.000Z',
  },
  {
    id: 'wa-4',
    workspaceId: 'ws-2',
    userId: 'wu-2',
    userEmail: 'operator@example.com',
    userName: 'John Operator',
    role: 'workspace_operator',
    grantedAt: '2024-02-10T11:00:00.000Z',
  },
  // ws-3 (Development): всі троє мають доступ
  {
    id: 'wa-5',
    workspaceId: 'ws-3',
    userId: 'wu-1',
    userEmail: 'admin@admin.com',
    userName: 'Admin User',
    role: 'workspace_admin',
    grantedAt: '2024-03-05T08:00:00.000Z',
  },
  {
    id: 'wa-6',
    workspaceId: 'ws-3',
    userId: 'wu-2',
    userEmail: 'operator@example.com',
    userName: 'John Operator',
    role: 'workspace_operator',
    grantedAt: '2024-03-10T14:00:00.000Z',
  },
  {
    id: 'wa-7',
    workspaceId: 'ws-3',
    userId: 'wu-3',
    userEmail: 'viewer@example.com',
    userName: 'Jane Viewer',
    role: 'workspace_viewer',
    grantedAt: '2024-03-15T16:00:00.000Z',
  },
];

// ─── Instances ────────────────────────────────────────────────────────────────

export const initialInstances: Instance[] = [
  {
    id: 'inst-001',
    name: 'Production EU-West',
    host: '10.0.1.42',
    port: 1880,
    tags: ['production', 'eu-west', 'critical'],
    status: 'online',
    nodeRedVersion: '3.1.9',
    nodeVersion: '20.11.1',
    uptimeSeconds: 1_209_600,
    workspaceId: 'ws-1',
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2025-03-05T12:34:00.000Z',
  },
  {
    id: 'inst-002',
    name: 'Staging EU-Central',
    host: '10.0.2.17',
    port: 1880,
    tags: ['staging', 'eu-central'],
    status: 'offline',
    nodeRedVersion: '3.1.7',
    nodeVersion: '20.10.0',
    uptimeSeconds: 0,
    workspaceId: 'ws-2',
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2025-03-04T09:15:00.000Z',
  },
  {
    id: 'inst-003',
    name: 'Dev Sandbox',
    host: '192.168.100.50',
    port: 1880,
    tags: ['development', 'sandbox'],
    status: 'error',
    nodeRedVersion: '3.2.0',
    nodeVersion: '22.1.0',
    uptimeSeconds: undefined,
    workspaceId: 'ws-3',
    createdAt: '2024-06-20T14:00:00.000Z',
    updatedAt: '2025-03-06T07:02:00.000Z',
  },
];

// ─── Users per instance ───────────────────────────────────────────────────────

export const initialUsers: Record<string, NRUser[]> = {
  'inst-001': [
    { username: 'admin', role: 'admin', permissions: ['*'] },
    { username: 'olena.koval', role: 'editor', permissions: ['read', 'write'] },
    { username: 'mykola.bondar', role: 'read-only', permissions: ['read'] },
  ],
  'inst-002': [
    { username: 'admin', role: 'admin', permissions: ['*'] },
    { username: 'daryna.savchenko', role: 'editor', permissions: ['read', 'write'] },
  ],
  'inst-003': [
    { username: 'dev-admin', role: 'admin', permissions: ['*'] },
    { username: 'ivan.petrenko', role: 'editor', permissions: ['read', 'write'] },
    { username: 'oksana.lysenko', role: 'read-only', permissions: ['read'] },
  ],
};

// ─── Projects per instance ────────────────────────────────────────────────────

export const initialProjects: Record<string, NRProject[]> = {
  'inst-001': [
    {
      name: 'iot-pipeline',
      branch: 'main',
      commitHash: 'a3f7c1d',
      commitMessage: 'feat: add MQTT retry logic',
      syncStatus: 'up-to-date',
      behindBy: 0,
      previousCommits: [
        { hash: 'f1e2d3c', message: 'refactor: clean up MQTT handler', author: 'Olena Koval', date: '2025-03-04T10:00:00.000Z' },
        { hash: 'c4b5a67', message: 'fix: connection pool memory leak', author: 'Admin User', date: '2025-03-03T14:30:00.000Z' },
      ],
    },
    {
      name: 'alerting-flows',
      branch: 'release/v2.4',
      commitHash: 'b8e2f0a',
      commitMessage: 'fix: threshold calculation for sensor temp',
      syncStatus: 'behind',
      behindBy: 3,
      previousCommits: [
        { hash: 'a1b2c3d', message: 'feat: add email alert notifications', author: 'John Operator', date: '2025-03-02T09:00:00.000Z' },
        { hash: 'e4f5a6b', message: 'chore: update alert templates', author: 'Admin User', date: '2025-03-01T11:00:00.000Z' },
      ],
    },
    {
      name: 'smart-home-flows',
      branch: 'main',
      commitHash: 'abc1234',
      commitMessage: 'Fix MQTT connection timeout',
      syncStatus: 'up-to-date',
      behindBy: 0,
      previousCommits: [
        { hash: 'bbb1111', message: 'Previous stable version', author: 'Admin User', date: '2025-03-04T12:00:00.000Z' },
        { hash: 'ccc2222', message: 'Before refactor: old flow structure', author: 'Olena Koval', date: '2025-03-03T08:00:00.000Z' },
      ],
    },
  ],
  'inst-002': [
    {
      name: 'iot-pipeline',
      branch: 'develop',
      commitHash: 'd1c4a9e',
      commitMessage: 'wip: experimental AMQP connector',
      syncStatus: 'dirty',
      behindBy: 0,
      previousCommits: [
        { hash: 'b2c3d4e', message: 'feat: initial AMQP connector draft', author: 'John Operator', date: '2025-03-03T16:00:00.000Z' },
      ],
    },
  ],
  'inst-003': [
    {
      name: 'sandbox-flows',
      branch: 'feature/new-dashboard',
      commitHash: undefined,
      commitMessage: undefined,
      syncStatus: 'unknown',
      behindBy: undefined,
      previousCommits: [],
    },
    {
      name: 'test-utils',
      branch: 'main',
      commitHash: 'f9a0b3c',
      commitMessage: 'chore: update dependencies',
      syncStatus: 'up-to-date',
      behindBy: 0,
      previousCommits: [
        { hash: 'd8e9f0a', message: 'fix: test runner configuration', author: 'dev-admin', date: '2025-03-02T13:00:00.000Z' },
      ],
    },
  ],
};

// ─── Audit logs ───────────────────────────────────────────────────────────────

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-001',
    action: 'auth.login',
    performedBy: 'admin@admin.com',
    details: { ip: '93.184.216.34' },
    createdAt: '2025-03-06T07:00:00.000Z',
  },
  {
    id: 'log-002',
    action: 'instance.restart',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { reason: 'Scheduled maintenance' },
    createdAt: '2025-03-06T07:05:00.000Z',
  },
  {
    id: 'log-003',
    action: 'project.pull',
    instanceId: 'inst-001',
    performedBy: 'olena.koval',
    details: { project: 'iot-pipeline', branch: 'main' },
    createdAt: '2025-03-05T15:30:00.000Z',
  },
  {
    id: 'log-004',
    action: 'instance.stop',
    instanceId: 'inst-002',
    performedBy: 'admin@admin.com',
    details: { reason: 'Nightly shutdown' },
    createdAt: '2025-03-04T23:00:00.000Z',
  },
  {
    id: 'log-005',
    action: 'user.create',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { username: 'mykola.bondar', role: 'read-only' },
    createdAt: '2025-03-03T11:20:00.000Z',
  },
  {
    id: 'log-006',
    action: 'user.update',
    instanceId: 'inst-002',
    performedBy: 'admin@admin.com',
    details: { username: 'daryna.savchenko', changes: { role: 'editor' } },
    createdAt: '2025-03-02T09:45:00.000Z',
  },
  {
    id: 'log-007',
    action: 'instance.start',
    instanceId: 'inst-003',
    performedBy: 'dev-admin',
    details: {},
    createdAt: '2025-03-01T08:00:00.000Z',
  },
  {
    id: 'log-008',
    action: 'auth.login',
    performedBy: 'operator@example.com',
    details: { ip: '185.12.34.56' },
    createdAt: '2025-03-06T06:50:00.000Z',
  },
  {
    id: 'log-009',
    action: 'instance.start',
    instanceId: 'inst-002',
    performedBy: 'operator@example.com',
    details: { reason: 'Morning startup' },
    createdAt: '2025-03-06T08:00:00.000Z',
  },
  {
    id: 'log-010',
    action: 'project.pull',
    instanceId: 'inst-002',
    performedBy: 'operator@example.com',
    details: { project: 'iot-pipeline', branch: 'develop', commitsBehind: 3 },
    createdAt: '2025-03-06T08:15:00.000Z',
  },
  {
    id: 'log-011',
    action: 'user.delete',
    instanceId: 'inst-003',
    performedBy: 'admin@admin.com',
    details: { username: 'old.user', reason: 'Account deactivated' },
    createdAt: '2025-03-05T12:00:00.000Z',
  },
  {
    id: 'log-012',
    action: 'instance.stop',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { reason: 'Emergency patch' },
    createdAt: '2025-03-05T09:30:00.000Z',
  },
  {
    id: 'log-013',
    action: 'instance.start',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { reason: 'Post-patch startup' },
    createdAt: '2025-03-05T09:45:00.000Z',
  },
  {
    id: 'log-014',
    action: 'project.pull',
    instanceId: 'inst-003',
    performedBy: 'dev-admin',
    details: { project: 'sandbox-flows', branch: 'feature/new-dashboard' },
    createdAt: '2025-03-05T14:20:00.000Z',
  },
  {
    id: 'log-015',
    action: 'user.create',
    instanceId: 'inst-002',
    performedBy: 'admin@admin.com',
    details: { username: 'new.operator', role: 'editor' },
    createdAt: '2025-03-04T10:00:00.000Z',
  },
  {
    id: 'log-016',
    action: 'instance.restart',
    instanceId: 'inst-002',
    performedBy: 'operator@example.com',
    details: { reason: 'Memory leak detected' },
    createdAt: '2025-03-04T14:30:00.000Z',
  },
  {
    id: 'log-017',
    action: 'auth.login',
    performedBy: 'viewer@example.com',
    details: { ip: '77.88.99.10' },
    createdAt: '2025-03-04T09:00:00.000Z',
  },
  {
    id: 'log-018',
    action: 'user.update',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { username: 'olena.koval', changes: { permissions: ['read', 'write', 'deploy'] } },
    createdAt: '2025-03-03T16:45:00.000Z',
  },
  {
    id: 'log-019',
    action: 'project.pull',
    instanceId: 'inst-001',
    performedBy: 'olena.koval',
    details: { project: 'alerting-flows', branch: 'release/v2.4', behindBy: 3 },
    createdAt: '2025-03-03T10:00:00.000Z',
  },
  {
    id: 'log-020',
    action: 'instance.stop',
    instanceId: 'inst-003',
    performedBy: 'dev-admin',
    details: { reason: 'End of dev session' },
    createdAt: '2025-03-02T18:00:00.000Z',
  },
  {
    id: 'log-021',
    action: 'instance.start',
    instanceId: 'inst-003',
    performedBy: 'dev-admin',
    details: { reason: 'New dev session' },
    createdAt: '2025-03-02T09:00:00.000Z',
  },
  {
    id: 'log-022',
    action: 'auth.login',
    performedBy: 'admin@admin.com',
    details: { ip: '93.184.216.34' },
    createdAt: '2025-03-01T07:00:00.000Z',
  },
  {
    id: 'log-023',
    action: 'user.delete',
    instanceId: 'inst-002',
    performedBy: 'admin@admin.com',
    details: { username: 'temp.user', reason: 'Contract ended' },
    createdAt: '2025-02-28T15:00:00.000Z',
  },
  {
    id: 'log-024',
    action: 'instance.restart',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { reason: 'Weekly restart schedule' },
    createdAt: '2025-02-28T03:00:00.000Z',
  },
  {
    id: 'log-025',
    action: 'project.pull',
    instanceId: 'inst-001',
    performedBy: 'admin@admin.com',
    details: { project: 'iot-pipeline', branch: 'main', newCommit: 'a3f7c1d' },
    createdAt: '2025-02-27T11:30:00.000Z',
  },
];
