ALTER TABLE "project_labels" ADD COLUMN "group" varchar(50);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template_source_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_source_id_projects_id_fk" FOREIGN KEY ("template_source_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;