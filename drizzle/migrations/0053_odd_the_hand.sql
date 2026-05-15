CREATE TYPE "public"."status_penilaian" AS ENUM('draft', 'submitted', 'reviewed', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."status_periode_penilaian" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."tipe_penilaian_template" AS ENUM('tugas', 'perilaku');--> statement-breakpoint
CREATE TABLE "penilaian_kinerja" (
	"id" text PRIMARY KEY NOT NULL,
	"periode_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"penilai_id" text NOT NULL,
	"template_tugas_id" integer,
	"template_perilaku_id" integer,
	"total_nilai_tugas" numeric(5, 2),
	"total_nilai_perilaku" numeric(5, 2),
	"nilai_akhir" numeric(5, 2),
	"status" "status_penilaian" DEFAULT 'draft' NOT NULL,
	"catatan" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "penilaian_kinerja_detail" (
	"id" serial PRIMARY KEY NOT NULL,
	"penilaian_id" text NOT NULL,
	"template_item_id" integer NOT NULL,
	"tipe" "tipe_penilaian_template" NOT NULL,
	"nilai" integer DEFAULT 0 NOT NULL,
	"bobot" numeric(4, 3) NOT NULL,
	"nilai_terbobot" numeric(5, 2) NOT NULL,
	"keterangan" text
);
--> statement-breakpoint
CREATE TABLE "penilaian_periode" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(100) NOT NULL,
	"tahun" integer NOT NULL,
	"kuartal" integer NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"status" "status_periode_penilaian" DEFAULT 'open' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "penilaian_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(200) NOT NULL,
	"tipe" "tipe_penilaian_template" NOT NULL,
	"divisi_id" integer,
	"jabatan" varchar(150),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "penilaian_template_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"nomor" integer NOT NULL,
	"keterangan" text NOT NULL,
	"bobot" numeric(4, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "kuitansi" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja" ADD CONSTRAINT "penilaian_kinerja_periode_id_penilaian_periode_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."penilaian_periode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja" ADD CONSTRAINT "penilaian_kinerja_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja" ADD CONSTRAINT "penilaian_kinerja_penilai_id_users_id_fk" FOREIGN KEY ("penilai_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja" ADD CONSTRAINT "penilaian_kinerja_template_tugas_id_penilaian_template_id_fk" FOREIGN KEY ("template_tugas_id") REFERENCES "public"."penilaian_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja" ADD CONSTRAINT "penilaian_kinerja_template_perilaku_id_penilaian_template_id_fk" FOREIGN KEY ("template_perilaku_id") REFERENCES "public"."penilaian_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja" ADD CONSTRAINT "penilaian_kinerja_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja_detail" ADD CONSTRAINT "penilaian_kinerja_detail_penilaian_id_penilaian_kinerja_id_fk" FOREIGN KEY ("penilaian_id") REFERENCES "public"."penilaian_kinerja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_kinerja_detail" ADD CONSTRAINT "penilaian_kinerja_detail_template_item_id_penilaian_template_item_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."penilaian_template_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_periode" ADD CONSTRAINT "penilaian_periode_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_template" ADD CONSTRAINT "penilaian_template_divisi_id_divisi_id_fk" FOREIGN KEY ("divisi_id") REFERENCES "public"."divisi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_template" ADD CONSTRAINT "penilaian_template_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penilaian_template_item" ADD CONSTRAINT "penilaian_template_item_template_id_penilaian_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."penilaian_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_penilaian_kinerja_periode" ON "penilaian_kinerja" USING btree ("periode_id");--> statement-breakpoint
CREATE INDEX "idx_penilaian_kinerja_user" ON "penilaian_kinerja" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_penilaian_kinerja_status" ON "penilaian_kinerja" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_penilaian_per_user_periode" ON "penilaian_kinerja" USING btree ("user_id","periode_id");--> statement-breakpoint
CREATE INDEX "idx_penilaian_detail_penilaian" ON "penilaian_kinerja_detail" USING btree ("penilaian_id");--> statement-breakpoint
CREATE INDEX "idx_penilaian_detail_tipe" ON "penilaian_kinerja_detail" USING btree ("tipe");--> statement-breakpoint
CREATE INDEX "idx_penilaian_template_tipe" ON "penilaian_template" USING btree ("tipe");--> statement-breakpoint
CREATE INDEX "idx_penilaian_template_divisi" ON "penilaian_template" USING btree ("divisi_id");--> statement-breakpoint
CREATE INDEX "idx_penilaian_template_item_template" ON "penilaian_template_item" USING btree ("template_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kuitansi" ADD CONSTRAINT "kuitansi_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inv_project_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "kwt_project_idx" ON "kuitansi" USING btree ("project_id");