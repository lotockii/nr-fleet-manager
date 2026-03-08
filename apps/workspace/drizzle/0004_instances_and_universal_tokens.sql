ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "os_name" text;
--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "os_version" text;
--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "os_arch" text;
--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "local_ip" text;
--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "public_ip" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "universal_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"token_plain" text,
	"workspace_id" uuid REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action,
	"created_by" uuid REFERENCES "public"."workspace_users"("id") ON DELETE no action ON UPDATE no action,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
