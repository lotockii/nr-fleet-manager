-- ============================================================
-- NodeRed Fleet Manager — PostgreSQL Database Schema
-- Version: 2.0.0
-- Generated from Drizzle ORM schema (apps/workspace/src/db/schema.ts)
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ─── ENUM Types ───────────────────────────────────────────

CREATE TYPE workspace_user_role    AS ENUM ('super_admin', 'operator', 'viewer');
CREATE TYPE workspace_access_role  AS ENUM ('workspace_admin', 'workspace_operator', 'workspace_viewer');
CREATE TYPE instance_status        AS ENUM ('online', 'offline', 'unknown', 'error');
CREATE TYPE sync_status            AS ENUM ('up-to-date', 'behind', 'dirty', 'unknown');

-- ============================================================
-- 1. WORKSPACES
-- Простори для групування інстансів
-- ============================================================

CREATE TABLE workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMP   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. WORKSPACE USERS
-- Глобальні користувачі системи
-- ============================================================

CREATE TABLE workspace_users (
  id                   UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT                  NOT NULL,
  name                 TEXT                  NOT NULL,
  password_hash        TEXT                  NOT NULL,
  role                 workspace_user_role   NOT NULL DEFAULT 'viewer',
  must_change_password BOOLEAN               NOT NULL DEFAULT false,
  is_active            BOOLEAN               NOT NULL DEFAULT true,
  last_login_at        TIMESTAMP,
  updated_at           TIMESTAMP             NOT NULL DEFAULT now(),
  created_at           TIMESTAMP             NOT NULL DEFAULT now(),
  CONSTRAINT workspace_users_email_idx UNIQUE (email)
);

-- ============================================================
-- 3. INSTANCES
-- NodeRed інстанси
-- ============================================================

CREATE TABLE instances (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT             NOT NULL,
  host             TEXT             NOT NULL,
  port             INTEGER          NOT NULL DEFAULT 1880,
  tags             JSONB            DEFAULT '[]'::jsonb,
  status           instance_status  NOT NULL DEFAULT 'unknown',
  node_red_version TEXT,
  node_version     TEXT,
  os_name          TEXT,
  os_version       TEXT,
  os_arch          TEXT,
  local_ip         TEXT,
  public_ip        TEXT,
  uptime_seconds   INTEGER          DEFAULT 0,
  workspace_id     UUID             REFERENCES workspaces(id),
  token_hash       TEXT,
  created_at       TIMESTAMP        NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP        NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. WORKSPACE ACCESS
-- Доступ користувачів до конкретних просторів
-- ============================================================

CREATE TABLE workspace_access (
  id           UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID                   NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID                   NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
  role         workspace_access_role  NOT NULL DEFAULT 'workspace_viewer',
  granted_at   TIMESTAMP              NOT NULL DEFAULT now(),
  granted_by   UUID                   REFERENCES workspace_users(id),
  CONSTRAINT workspace_access_user_workspace_idx UNIQUE (workspace_id, user_id)
);

-- ============================================================
-- 5. AUDIT LOGS
-- Журнал дій
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT      NOT NULL,
  actor       TEXT      NOT NULL,
  target_id   TEXT,
  target_name TEXT,
  details     JSONB     DEFAULT '{}'::jsonb,
  instance_id UUID,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. PROJECTS
-- Git-проекти прив'язані до інстансів
-- ============================================================

CREATE TABLE projects (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id    UUID         NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name           TEXT         NOT NULL,
  branch         TEXT,
  commit_hash    TEXT,
  commit_message TEXT,
  sync_status    sync_status  NOT NULL DEFAULT 'unknown',
  behind_by      INTEGER      DEFAULT 0,
  last_checked_at TIMESTAMP,
  created_at     TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP    NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. UNIVERSAL TOKENS
-- Токени для підключення агентів (= agent_tokens)
-- ============================================================

CREATE TABLE universal_tokens (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT      NOT NULL,
  token_hash   TEXT      NOT NULL UNIQUE,
  token_plain  TEXT,
  workspace_id UUID      REFERENCES workspaces(id),
  created_by   UUID      REFERENCES workspace_users(id),
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  is_active    BOOLEAN   NOT NULL DEFAULT true
);

-- ============================================================
-- 8. INSTANCE METRICS (time-series)
-- Метрики інстансів (= instance_status_history)
-- ============================================================

CREATE TABLE instance_metrics (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID      NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMP NOT NULL DEFAULT now(),
  uptime_seconds  INTEGER   DEFAULT 0,
  memory_mb       INTEGER   DEFAULT 0,
  memory_total_mb INTEGER   DEFAULT 0,
  cpu_percent     INTEGER   DEFAULT 0,
  cpu_load_1m     REAL      DEFAULT 0,
  disk_used_mb    INTEGER   DEFAULT 0,
  disk_total_mb   INTEGER   DEFAULT 0,
  disk_free_mb    INTEGER   DEFAULT 0,
  node_red_version TEXT,
  run_mode        TEXT
);

-- ============================================================
-- 9. INSTANCE USERS CACHE
-- Кеш користувачів NodeRed інстансів (= instance_user_permissions)
-- ============================================================

CREATE TABLE instance_users (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID      NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  username    TEXT      NOT NULL,
  role        TEXT      NOT NULL DEFAULT 'read-only',
  permissions JSONB     DEFAULT '[]'::jsonb,
  synced_at   TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. INSTANCE PROJECTS CACHE
-- Кеш проектів NodeRed інстансів
-- ============================================================

CREATE TABLE instance_projects (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         UUID      NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name                TEXT      NOT NULL,
  has_git             BOOLEAN   NOT NULL DEFAULT false,
  branch              TEXT,
  remote_url          TEXT,
  last_commit_hash    TEXT,
  last_commit_message TEXT,
  last_commit_date    TEXT,
  is_dirty            BOOLEAN   DEFAULT false,
  synced_at           TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTES
-- ============================================================
-- Removed tables (not implemented in Drizzle schema):
--   - agent_tokens         → use universal_tokens
--   - tags, instance_tags  → tags stored as JSONB in instances
--   - instance_status_history → use instance_metrics
--   - instance_user_permissions → use instance_users
--   - project_commit_history   → not implemented
--   - refresh_tokens            → JWT stateless auth, no refresh tokens
--   - system_settings           → not implemented
