ALTER TYPE "public"."project_type" ADD VALUE 'brevet_ab';--> statement-breakpoint
ALTER TYPE "public"."project_type" ADD VALUE 'brevet_c';--> statement-breakpoint
ALTER TYPE "public"."project_type" ADD VALUE 'bfa';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "kelas_ujian_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_kelas_ujian_id_kelas_ujian_id_fk" FOREIGN KEY ("kelas_ujian_id") REFERENCES "public"."kelas_ujian"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_kelas_ujian_idx" ON "projects" USING btree ("kelas_ujian_id");