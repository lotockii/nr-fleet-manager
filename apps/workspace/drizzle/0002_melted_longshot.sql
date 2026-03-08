ALTER TABLE "workspace_access" ADD COLUMN "granted_by" uuid;--> statement-breakpoint
ALTER TABLE "workspace_users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD CONSTRAINT "workspace_access_granted_by_workspace_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."workspace_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_access_user_workspace_idx" ON "workspace_access" USING btree ("workspace_id","user_id");
