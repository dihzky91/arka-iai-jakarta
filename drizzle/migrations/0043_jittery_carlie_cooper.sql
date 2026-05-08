CREATE TYPE "public"."email_provider" AS ENUM('mailjet', 'brevo');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'honorarium_status' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "whatsapp_message_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"kelas_id" text NOT NULL,
	"session_id" text,
	"assignment_id" text,
	"template_key" varchar(80) NOT NULL,
	"recipient_role" varchar(40) NOT NULL,
	"recipient_name" varchar(200),
	"recipient_whatsapp_number" varchar(30),
	"message_content" text NOT NULL,
	"metadata" jsonb,
	"sent_by" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_key" varchar(80) NOT NULL,
	"template_name" varchar(200) NOT NULL,
	"description" varchar(300),
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_message_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
ALTER TABLE "absensi_karyawan" DROP CONSTRAINT "absensi_karyawan_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "uniq_absensi_user_tanggal_sumber";--> statement-breakpoint
ALTER TABLE "absensi_karyawan" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "absensi_karyawan" ADD COLUMN "dingtalk_user_id" text;--> statement-breakpoint
ALTER TABLE "absensi_karyawan" ADD COLUMN "dingtalk_nama" varchar(200);--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "finance_contact_name_override" varchar(200);--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "finance_whatsapp_number_override" varchar(30);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_project_invitation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_project_mention" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_project_update" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_honorarium_status" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_system" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_project_invitation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_project_mention" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_project_update" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_honorarium_status" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "finance_contact_name" varchar(200);--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "finance_whatsapp_number" varchar(30);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "finance_contact_name" varchar(200);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "finance_whatsapp_number" varchar(30);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "whatsapp_bot_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "email_provider" "email_provider" DEFAULT 'mailjet' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_kelas_id_kelas_pelatihan_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "public"."kelas_pelatihan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_assignment_id_session_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."session_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wml_kelas_sent_idx" ON "whatsapp_message_logs" USING btree ("kelas_id","sent_at");--> statement-breakpoint
CREATE INDEX "wml_template_idx" ON "whatsapp_message_logs" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "wml_role_idx" ON "whatsapp_message_logs" USING btree ("recipient_role");--> statement-breakpoint
CREATE INDEX "wmt_active_idx" ON "whatsapp_message_templates" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "absensi_karyawan" ADD CONSTRAINT "absensi_karyawan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_absensi_arka_user" ON "absensi_karyawan" USING btree ("user_id","tanggal","sumber") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_absensi_dtk_user" ON "absensi_karyawan" USING btree ("dingtalk_user_id","tanggal","sumber") WHERE user_id IS NULL;--> statement-breakpoint
CREATE INDEX "idx_absensi_dtk_user_id" ON "absensi_karyawan" USING btree ("dingtalk_user_id");