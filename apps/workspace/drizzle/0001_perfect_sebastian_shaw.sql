CREATE TABLE "instance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"uptime_seconds" integer DEFAULT 0,
	"memory_mb" integer DEFAULT 0,
	"memory_total_mb" integer DEFAULT 0,
	"cpu_percent" integer DEFAULT 0,
	"cpu_load_1m" real DEFAULT 0,
	"disk_used_mb" integer DEFAULT 0,
	"disk_total_mb" integer DEFAULT 0,
	"disk_free_mb" integer DEFAULT 0,
	"node_red_version" text,
	"run_mode" text
);
--> statement-breakpoint
ALTER TABLE "instance_metrics" ADD CONSTRAINT "instance_metrics_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;