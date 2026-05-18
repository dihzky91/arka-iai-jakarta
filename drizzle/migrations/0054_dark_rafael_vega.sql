CREATE TYPE "public"."kategori_ppl" AS ENUM('Perpajakan', 'Sistem Informasi & Softskill', 'Akuntansi Keuangan', 'Audit', 'Akuntansi Syariah', 'Akuntansi Manajemen', 'Akuntansi Manajemen dan Manajemen Keuangan', 'Akuntansi Perpajakan', 'Manajemen Keuangan', 'Akuntansi Keuangan & Softskill', 'Akuntansi Keuangan dan Manajemen Keuangan', 'Manajemen Strategik', 'SAK & PSAK');--> statement-breakpoint
CREATE TYPE "public"."status_ppl" AS ENUM('aktif', 'archived');--> statement-breakpoint
ALTER TYPE "public"."jenis_cuti" ADD VALUE 'kompensasi' BEFORE 'sakit';--> statement-breakpoint
CREATE TABLE "cuti_bersama" (
	"id" serial PRIMARY KEY NOT NULL,
	"tahun" integer NOT NULL,
	"tanggal" date NOT NULL,
	"keterangan" varchar(200) NOT NULL,
	"memotong_saldo" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "konfigurasi_cuti" (
	"id" serial PRIMARY KEY NOT NULL,
	"tahun" integer NOT NULL,
	"kuota_cuti_tahunan" integer DEFAULT 12 NOT NULL,
	"kuota_cuti_kompensasi" integer DEFAULT 2 NOT NULL,
	"maksimal_potong_cuti_bersama" integer DEFAULT 2 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppl_kegiatan" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama_kegiatan" varchar(255) NOT NULL,
	"kategori_ppl" "kategori_ppl" NOT NULL,
	"tipe_pelaksanaan" "tipe_pelaksanaan" NOT NULL,
	"status_event" "status_ppl" DEFAULT 'aktif' NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"lokasi" varchar(255),
	"skp" integer NOT NULL,
	"pendaftar" integer DEFAULT 0 NOT NULL,
	"realisasi_hadir" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppl_kegiatan_narasumber" (
	"id" serial PRIMARY KEY NOT NULL,
	"kegiatan_id" integer NOT NULL,
	"narasumber_id" integer NOT NULL,
	"topik" varchar(200),
	"total_honorarium" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ppl_kuesioner_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"kegiatan_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"access_token" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp,
	"deactivated_at" timestamp,
	CONSTRAINT "ppl_kuesioner_link_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "ppl_kuesioner_response" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"nama_responden" varchar(200) NOT NULL,
	"email_responden" varchar(150) NOT NULL,
	"answers_json" jsonb NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ppl_kuesioner_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(200) NOT NULL,
	"config_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppl_narasumber" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(200) NOT NULL,
	"email" varchar(150) NOT NULL,
	"no_telepon" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"fee_per_skp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ppl_narasumber_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ppl_narasumber_expertise" (
	"id" serial PRIMARY KEY NOT NULL,
	"narasumber_id" integer NOT NULL,
	"kategori_ppl" "kategori_ppl" NOT NULL,
	"topik" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saldo_cuti_kompensasi" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tahun" integer NOT NULL,
	"kuota" integer DEFAULT 2 NOT NULL,
	"terpakai" integer DEFAULT 0 NOT NULL,
	"sisa" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saldo_cuti_tahunan" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tahun" integer NOT NULL,
	"kuota_awal" integer DEFAULT 12 NOT NULL,
	"cuti_terpakai" integer DEFAULT 0 NOT NULL,
	"cuti_bersama_terpakai" integer DEFAULT 0 NOT NULL,
	"sisa_cuti" integer DEFAULT 12 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"widget_key" varchar(50) NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pengajuan_cuti" ADD COLUMN "approval_code" varchar(20);--> statement-breakpoint
ALTER TABLE "cuti_bersama" ADD CONSTRAINT "cuti_bersama_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "konfigurasi_cuti" ADD CONSTRAINT "konfigurasi_cuti_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_kegiatan" ADD CONSTRAINT "ppl_kegiatan_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_kegiatan_narasumber" ADD CONSTRAINT "ppl_kegiatan_narasumber_kegiatan_id_ppl_kegiatan_id_fk" FOREIGN KEY ("kegiatan_id") REFERENCES "public"."ppl_kegiatan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_kegiatan_narasumber" ADD CONSTRAINT "ppl_kegiatan_narasumber_narasumber_id_ppl_narasumber_id_fk" FOREIGN KEY ("narasumber_id") REFERENCES "public"."ppl_narasumber"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_kuesioner_link" ADD CONSTRAINT "ppl_kuesioner_link_kegiatan_id_ppl_kegiatan_id_fk" FOREIGN KEY ("kegiatan_id") REFERENCES "public"."ppl_kegiatan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_kuesioner_link" ADD CONSTRAINT "ppl_kuesioner_link_template_id_ppl_kuesioner_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ppl_kuesioner_template"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_kuesioner_response" ADD CONSTRAINT "ppl_kuesioner_response_link_id_ppl_kuesioner_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."ppl_kuesioner_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppl_narasumber_expertise" ADD CONSTRAINT "ppl_narasumber_expertise_narasumber_id_ppl_narasumber_id_fk" FOREIGN KEY ("narasumber_id") REFERENCES "public"."ppl_narasumber"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_cuti_kompensasi" ADD CONSTRAINT "saldo_cuti_kompensasi_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_cuti_tahunan" ADD CONSTRAINT "saldo_cuti_tahunan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_preferences" ADD CONSTRAINT "user_dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_cuti_bersama_tanggal" ON "cuti_bersama" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "idx_cuti_bersama_tahun" ON "cuti_bersama" USING btree ("tahun");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_konfigurasi_cuti_tahun" ON "konfigurasi_cuti" USING btree ("tahun");--> statement-breakpoint
CREATE INDEX "ppl_kegiatan_narasumber_kegiatan_idx" ON "ppl_kegiatan_narasumber" USING btree ("kegiatan_id");--> statement-breakpoint
CREATE INDEX "ppl_kegiatan_narasumber_narasumber_idx" ON "ppl_kegiatan_narasumber" USING btree ("narasumber_id");--> statement-breakpoint
CREATE INDEX "ppl_kuesioner_link_kegiatan_idx" ON "ppl_kuesioner_link" USING btree ("kegiatan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ppl_kuesioner_link_token_idx" ON "ppl_kuesioner_link" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "ppl_kuesioner_response_link_idx" ON "ppl_kuesioner_response" USING btree ("link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ppl_kuesioner_response_unique_responden" ON "ppl_kuesioner_response" USING btree ("link_id",lower("nama_responden"),lower("email_responden"));--> statement-breakpoint
CREATE INDEX "ppl_narasumber_expertise_narasumber_idx" ON "ppl_narasumber_expertise" USING btree ("narasumber_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ppl_narasumber_expertise_unique" ON "ppl_narasumber_expertise" USING btree ("narasumber_id","kategori_ppl");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_cuti_kompensasi_user_tahun" ON "saldo_cuti_kompensasi" USING btree ("user_id","tahun");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_saldo_cuti_user_tahun" ON "saldo_cuti_tahunan" USING btree ("user_id","tahun");--> statement-breakpoint
CREATE INDEX "idx_saldo_cuti_tahun" ON "saldo_cuti_tahunan" USING btree ("tahun");--> statement-breakpoint
CREATE INDEX "user_dashboard_pref_user_idx" ON "user_dashboard_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_dashboard_pref_unique" ON "user_dashboard_preferences" USING btree ("user_id","widget_key");