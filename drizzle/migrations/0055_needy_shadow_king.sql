ALTER TABLE "projects" ADD COLUMN "ppl_kegiatan_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_ppl_kegiatan_id_ppl_kegiatan_id_fk" FOREIGN KEY ("ppl_kegiatan_id") REFERENCES "public"."ppl_kegiatan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_ppl_kegiatan_idx" ON "projects" USING btree ("ppl_kegiatan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_ppl_kegiatan_unique_idx" ON "projects" USING btree ("ppl_kegiatan_id") WHERE ppl_kegiatan_id IS NOT NULL;