CREATE TABLE "ppl_tema_bank" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama_tema" varchar(255) NOT NULL,
	"kategori_ppl" "kategori_ppl" NOT NULL,
	"latar_belakang" text,
	"susunan_materi" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefit" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_peserta" text,
	"durasi_hari" integer DEFAULT 1 NOT NULL,
	"tipe_pelaksanaan_default" "tipe_pelaksanaan",
	"rekomendasi_narasumber_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_template_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"source_kegiatan_id" integer,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "ppl_tema_bank" ADD CONSTRAINT "ppl_tema_bank_source_kegiatan_id_ppl_kegiatan_id_fk" FOREIGN KEY ("source_kegiatan_id") REFERENCES "public"."ppl_kegiatan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_tema_bank" ADD CONSTRAINT "ppl_tema_bank_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ppl_tema_bank_nama_idx" ON "ppl_tema_bank" USING btree ("nama_tema");--> statement-breakpoint
CREATE INDEX "ppl_tema_bank_kategori_idx" ON "ppl_tema_bank" USING btree ("kategori_ppl");--> statement-breakpoint
CREATE INDEX "ppl_tema_bank_tags_idx" ON "ppl_tema_bank" USING gin ("tags");
