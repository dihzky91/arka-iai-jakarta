ALTER TABLE "project_files" ADD COLUMN "comment_id" uuid REFERENCES "project_comments"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX "project_files_comment_idx" ON "project_files" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_kelas_ujian_unique_idx" ON "projects" ("kelas_ujian_id") WHERE kelas_ujian_id IS NOT NULL;
