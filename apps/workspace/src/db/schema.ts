import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const workspaceUserRoleEnum = pgEnum('workspace_user_role', ['super_admin', 'operator', 'viewer']);
export const instanceStatusEnum = pgEnum('instance_status', ['online', 'offline', 'unknown', 'error']);
export const workspaceAccessRoleEnum = pgEnum('workspace_access_role', ['workspace_admin', 'workspace_operator', 'workspace_viewer']);
export const syncStatusEnum = pgEnum('sync_status', ['up-to-date', 'behind', 'dirty', 'unknown']);

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#6366f1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Workspace Users ──────────────────────────────────────────────────────────

export const workspaceUsers = pgTable('workspace_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: workspaceUserRoleEnum('role').notNull().default('viewer'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('workspace_users_email_idx').on(table.email),
}));

// ─── Instances ────────────────────────────────────────────────────────────────

export const instances = pgTable('instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(1880),
  tags: jsonb('tags').$type<string[]>().default([]),
  status: instanceStatusEnum('status').notNull().default('unknown'),
  nodeRedVersion: text('node_red_version'),
  nodeVersion: text('node_version'),
  osName:    text('os_name'),
  osVersion: text('os_version'),
  osArch:    text('os_arch'),
  localIp:   text('local_ip'),
  publicIp:  text('public_ip'),
  uptimeSeconds: integer('uptime_seconds').default(0),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  tokenHash: text('token_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Workspace Access ─────────────────────────────────────────────────────────

export const workspaceAccess = pgTable('workspace_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => workspaceUsers.id, { onDelete: 'cascade' }),
  role: workspaceAccessRoleEnum('role').notNull().default('workspace_viewer'),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: uuid('granted_by').references(() => workspaceUsers.id),
}, (table) => ({
  uniqUserWorkspace: uniqueIndex('workspace_access_user_workspace_idx').on(table.workspaceId, table.userId),
}));

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  actor: text('actor').notNull(),
  targetId: text('target_id'),
  targetName: text('target_name'),
  details: jsonb('details').$type<Record<string, unknown>>().default({}),
  instanceId: uuid('instance_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: uuid('instance_id').notNull().references(() => instances.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  branch: text('branch'),
  commitHash: text('commit_hash'),
  commitMessage: text('commit_message'),
  syncStatus: syncStatusEnum('sync_status').notNull().default('unknown'),
  behindBy: integer('behind_by').default(0),
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Universal Tokens ─────────────────────────────────────────────────────────

export const universalTokens = pgTable('universal_tokens', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  tokenHash:   text('token_hash').notNull().unique(),
  tokenPlain:  text('token_plain'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  createdBy:   uuid('created_by').references(() => workspaceUsers.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  isActive:    boolean('is_active').notNull().default(true),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type WorkspaceUser = typeof workspaceUsers.$inferSelect;
export type NewWorkspaceUser = typeof workspaceUsers.$inferInsert;

export type Instance = typeof instances.$inferSelect;
export type NewInstance = typeof instances.$inferInsert;

export type WorkspaceAccess = typeof workspaceAccess.$inferSelect;
export type NewWorkspaceAccess = typeof workspaceAccess.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type UniversalToken = typeof universalTokens.$inferSelect;
export type NewUniversalToken = typeof universalTokens.$inferInsert;

// ─── Instance Metrics (time-series) ──────────────────────────────────────────

export const instanceMetrics = pgTable('instance_metrics', {
  id:            uuid('id').primaryKey().defaultRandom(),
  instanceId:    uuid('instance_id').notNull().references(() => instances.id, { onDelete: 'cascade' }),
  recordedAt:    timestamp('recorded_at').defaultNow().notNull(),
  uptimeSeconds: integer('uptime_seconds').default(0),
  memoryMB:      integer('memory_mb').default(0),
  memoryTotalMB: integer('memory_total_mb').default(0),
  cpuPercent:    integer('cpu_percent').default(0),
  cpuLoad1m:     real('cpu_load_1m').default(0),
  diskUsedMB:    integer('disk_used_mb').default(0),
  diskTotalMB:   integer('disk_total_mb').default(0),
  diskFreeMB:    integer('disk_free_mb').default(0),
  nodeRedVersion: text('node_red_version'),
  runMode:       text('run_mode'),
});

// ─── Instance Users Cache ─────────────────────────────────────────────────────

export const instanceUsers = pgTable('instance_users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  instanceId:  uuid('instance_id').notNull().references(() => instances.id, { onDelete: 'cascade' }),
  username:    text('username').notNull(),
  role:        text('role').notNull().default('read-only'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  syncedAt:    timestamp('synced_at').defaultNow().notNull(),
});

// ─── Instance Projects Cache ──────────────────────────────────────────────────

export const instanceProjects = pgTable('instance_projects', {
  id:                uuid('id').primaryKey().defaultRandom(),
  instanceId:        uuid('instance_id').notNull().references(() => instances.id, { onDelete: 'cascade' }),
  name:              text('name').notNull(),
  hasGit:            boolean('has_git').notNull().default(false),
  branch:            text('branch'),
  remoteUrl:         text('remote_url'),
  lastCommitHash:    text('last_commit_hash'),
  lastCommitMessage: text('last_commit_message'),
  lastCommitDate:    text('last_commit_date'),
  isDirty:           boolean('is_dirty').default(false),
  syncedAt:          timestamp('synced_at').defaultNow().notNull(),
});
