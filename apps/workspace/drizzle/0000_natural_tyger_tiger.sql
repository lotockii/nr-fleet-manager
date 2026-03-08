CREATE TYPE "public"."instance_status" AS ENUM('online', 'offline', 'unknown', 'error');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('up-to-date', 'behind', 'dirty', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."workspace_access_role" AS ENUM('workspace_admin', 'workspace_operator', 'workspace_viewer');--> statement-breakpoint
CREATE TYPE "public"."workspace_user_role" AS ENUM('super_admin', 'operator', 'viewer');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"target_id" text,
	"target_name" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"instance_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 1880 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" "instance_status" DEFAULT 'unknown' NOT NULL,
	"node_red_version" text,
	"node_version" text,
	"uptime_seconds" integer DEFAULT 0,
	"workspace_id" uuid,
	"token_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"name" text NOT NULL,
	"branch" text,
	"commit_hash" text,
	"commit_message" text,
	"sync_status" "sync_status" DEFAULT 'unknown' NOT NULL,
	"behind_by" integer DEFAULT 0,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_access_role" DEFAULT 'workspace_viewer' NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "workspace_user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_user_id_workspace_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."workspace_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_users_email_idx" ON "workspace_users" USING btree ("email");