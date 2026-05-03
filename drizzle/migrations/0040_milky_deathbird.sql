CREATE TYPE "public"."project_type" AS ENUM('Workshop', 'Seminar', 'Lokakarya', 'Pelatihan', 'Lainnya');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'project_invitation' BEFORE 'system';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'mention' BEFORE 'system';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'project_update' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "project_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"action" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_comment_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"is_read" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"is_edited" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_url" varchar(1000) NOT NULL,
	"storage_key" varchar(1000),
	"file_size" integer NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6B7280' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"added_by" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_to_labels" (
	"project_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "project_to_labels_pk" PRIMARY KEY("project_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "project_type" NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"price" numeric(15, 2),
	"status" varchar(50) DEFAULT 'not_started' NOT NULL,
	"skp_mode" varchar(20) DEFAULT 'auto' NOT NULL,
	"skp" numeric(5, 2),
	"half_day_skp" varchar(5),
	"event_id" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_activity_log" ADD CONSTRAINT "project_activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity_log" ADD CONSTRAINT "project_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comment_mentions" ADD CONSTRAINT "project_comment_mentions_comment_id_project_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."project_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comment_mentions" ADD CONSTRAINT "project_comment_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_parent_id_project_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."project_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_to_labels" ADD CONSTRAINT "project_to_labels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_to_labels" ADD CONSTRAINT "project_to_labels_label_id_project_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."project_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_activity_project_idx" ON "project_activity_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_activity_created_at_idx" ON "project_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mention_unique" ON "project_comment_mentions" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "project_comments_project_idx" ON "project_comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_comments_parent_idx" ON "project_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "project_files_project_idx" ON "project_files" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_member_unique" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_project_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_created_by_idx" ON "projects" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "projects_event_idx" ON "projects" USING btree ("event_id");--> statement-breakpoint
INSERT INTO "role_capabilities" ("role_id", "capability")
SELECT "id", caps.capability
FROM "roles"
CROSS JOIN (
	VALUES
		('staff', 'projects:view'),
		('staff', 'projects:create'),
		('staff', 'projects:edit'),
		('staff', 'projects:delete'),
		('staff', 'projects:comment'),
		('staff', 'projects:upload'),
		('staff', 'projects:manage_members'),
		('pejabat', 'projects:view'),
		('pejabat', 'projects:comment'),
		('pejabat', 'projects:upload'),
		('viewer', 'projects:view')
) AS caps(kode, capability)
WHERE "roles"."kode" = caps.kode
ON CONFLICT DO NOTHING;
