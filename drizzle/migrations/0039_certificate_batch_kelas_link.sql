ALTER TABLE "certificate_batches" ADD COLUMN "kelas_id" text;--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "angkatan" integer;--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "certificate_class_code" varchar(2);--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "source" varchar(20) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "certificate_notes" text;--> statement-breakpoint
ALTER TABLE "certificate_batches" ADD CONSTRAINT "certificate_batches_kelas_id_kelas_pelatihan_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "public"."kelas_pelatihan"("id") ON DELETE no action ON UPDATE no action;
