CREATE TYPE "public"."tipe_evaluasi" AS ENUM('evaluasi_umum', 'evaluasi_materi', 'evaluasi_narasumber', 'evaluasi_logistik');--> statement-breakpoint
ALTER TABLE "ppl_kuesioner_template" ADD COLUMN "tipe_evaluasi" "tipe_evaluasi" DEFAULT 'evaluasi_umum' NOT NULL;--> statement-breakpoint
ALTER TABLE "ppl_kuesioner_link" ADD COLUMN "tipe_evaluasi" "tipe_evaluasi" DEFAULT 'evaluasi_umum' NOT NULL;
