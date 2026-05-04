CREATE TYPE "public"."jenis_cuti" AS ENUM('tahunan', 'sakit', 'melahirkan', 'menikah', 'kematian', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."status_absensi" AS ENUM('hadir', 'terlambat', 'alpha', 'cuti', 'dinas_luar', 'izin', 'sakit');--> statement-breakpoint
CREATE TYPE "public"."status_cuti" AS ENUM('draft', 'diajukan', 'disetujui', 'ditolak', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."status_dingtalk_sync" AS ENUM('success', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sumber_absensi" AS ENUM('dingtalk', 'manual');--> statement-breakpoint
CREATE TABLE "absensi_karyawan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tanggal" date NOT NULL,
	"jam_masuk" timestamp with time zone,
	"jam_pulang" timestamp with time zone,
	"status" "status_absensi" DEFAULT 'hadir' NOT NULL,
	"keterlambatan_menit" integer DEFAULT 0,
	"sumber" "sumber_absensi" DEFAULT 'dingtalk' NOT NULL,
	"dingtalk_record_id" text,
	"catatan" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dingtalk_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_key" text NOT NULL,
	"app_secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sync_interval_menit" integer DEFAULT 60 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" "status_dingtalk_sync",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "honorarium_payment_proofs" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_url" varchar(1000) NOT NULL,
	"storage_key" varchar(1000),
	"file_size" integer NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pengajuan_cuti" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"jenis_cuti" "jenis_cuti" NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"jumlah_hari" integer NOT NULL,
	"alasan" text,
	"status" "status_cuti" DEFAULT 'draft' NOT NULL,
	"dingtalk_process_id" text,
	"dingtalk_form_code" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_reason" text,
	"lampiran_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dingtalk_user_id" text;--> statement-breakpoint
ALTER TABLE "absensi_karyawan" ADD CONSTRAINT "absensi_karyawan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarium_payment_proofs" ADD CONSTRAINT "honorarium_payment_proofs_batch_id_honorarium_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."honorarium_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honorarium_payment_proofs" ADD CONSTRAINT "honorarium_payment_proofs_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengajuan_cuti" ADD CONSTRAINT "pengajuan_cuti_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengajuan_cuti" ADD CONSTRAINT "pengajuan_cuti_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_absensi_user_tanggal_sumber" ON "absensi_karyawan" USING btree ("user_id","tanggal","sumber");--> statement-breakpoint
CREATE INDEX "idx_absensi_tanggal" ON "absensi_karyawan" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "idx_absensi_user_id" ON "absensi_karyawan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hpp_batch_idx" ON "honorarium_payment_proofs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "hpp_uploaded_at_idx" ON "honorarium_payment_proofs" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_cuti_user_id" ON "pengajuan_cuti" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cuti_status" ON "pengajuan_cuti" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cuti_tanggal" ON "pengajuan_cuti" USING btree ("tanggal_mulai","tanggal_selesai");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_honorarium_assignment_once" ON "honorarium_items" USING btree ("assignment_id");