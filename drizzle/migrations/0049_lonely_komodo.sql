CREATE TYPE "public"."tipe_pelaksanaan" AS ENUM('online', 'offline', 'hybrid');--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "price_member" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "price_non_member" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tipe_pelaksanaan" "tipe_pelaksanaan";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "waktu_mulai" varchar(5);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "waktu_selesai" varchar(5);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lokasi" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "max_peserta" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_waitlist_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_notes_project_idx" ON "project_notes" USING btree ("project_id");
