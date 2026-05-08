CREATE TYPE "public"."status_invoice" AS ENUM('draft', 'terbit', 'dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."status_kuitansi" AS ENUM('draft', 'terbit', 'dibatalkan');--> statement-breakpoint
ALTER TYPE "public"."jenis_surat" ADD VALUE 'invoice' BEFORE 'lainnya';--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"nomor_surat" varchar(200),
	"tanggal_invoice" date NOT NULL,
	"perihal" varchar(300) NOT NULL,
	"kepada" varchar(300) NOT NULL,
	"kepada_alamat" text,
	"items" jsonb NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"pajak_persen" numeric(5, 2) DEFAULT '0',
	"pajak_amount" numeric(14, 2) DEFAULT '0',
	"total" numeric(14, 2) NOT NULL,
	"catatan" text,
	"status" "status_invoice" DEFAULT 'draft',
	"file_url" text,
	"dibuat_oleh" text,
	"pejabat_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_nomor_surat_unique" UNIQUE("nomor_surat")
);
--> statement-breakpoint
CREATE TABLE "kuitansi" (
	"id" text PRIMARY KEY NOT NULL,
	"nomor_kuitansi" varchar(200),
	"tanggal_kuitansi" date NOT NULL,
	"diterima_dari" varchar(300) NOT NULL,
	"uraian" text NOT NULL,
	"jumlah" numeric(14, 2) NOT NULL,
	"terbilang" text,
	"untuk_pembayaran" varchar(300) NOT NULL,
	"catatan" text,
	"status" "status_kuitansi" DEFAULT 'draft',
	"file_url" text,
	"dibuat_oleh" text,
	"pejabat_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kuitansi_nomor_kuitansi_unique" UNIQUE("nomor_kuitansi")
);
--> statement-breakpoint
CREATE TABLE "kuitansi_counter" (
	"id" serial PRIMARY KEY NOT NULL,
	"tahun" integer NOT NULL,
	"bulan" integer NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"prefix" varchar(80) DEFAULT 'KWT',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pejabat_id_pejabat_penandatangan_id_fk" FOREIGN KEY ("pejabat_id") REFERENCES "public"."pejabat_penandatangan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuitansi" ADD CONSTRAINT "kuitansi_dibuat_oleh_users_id_fk" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuitansi" ADD CONSTRAINT "kuitansi_pejabat_id_pejabat_penandatangan_id_fk" FOREIGN KEY ("pejabat_id") REFERENCES "public"."pejabat_penandatangan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inv_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inv_tanggal_idx" ON "invoices" USING btree ("tanggal_invoice");--> statement-breakpoint
CREATE INDEX "kwt_status_idx" ON "kuitansi" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kwt_tanggal_idx" ON "kuitansi" USING btree ("tanggal_kuitansi");--> statement-breakpoint
CREATE UNIQUE INDEX "kuitansi_counter_period_uniq" ON "kuitansi_counter" USING btree ("tahun","bulan");