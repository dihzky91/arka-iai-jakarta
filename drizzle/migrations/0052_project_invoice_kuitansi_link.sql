ALTER TABLE "invoices" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inv_project_idx" ON "invoices" ("project_id");--> statement-breakpoint
ALTER TABLE "kuitansi" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "kuitansi" ADD CONSTRAINT "kuitansi_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kwt_project_idx" ON "kuitansi" ("project_id");
