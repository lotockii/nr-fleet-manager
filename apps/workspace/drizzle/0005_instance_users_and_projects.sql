-- instance_users: cache of users synced from each Node-RED instance
CREATE TABLE IF NOT EXISTS "instance_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action,
	"username" text NOT NULL,
	"role" text DEFAULT 'read-only' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "instance_users_instance_username_idx" ON "instance_users" USING btree ("instance_id","username");

--> statement-breakpoint
-- instance_projects: cache of projects/flows synced from each instance
CREATE TABLE IF NOT EXISTS "instance_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action,
	"name" text NOT NULL,
	"has_git" boolean DEFAULT false NOT NULL,
	"branch" text,
	"remote_url" text,
	"last_commit_hash" text,
	"last_commit_message" text,
	"last_commit_date" text,
	"is_dirty" boolean DEFAULT false,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
