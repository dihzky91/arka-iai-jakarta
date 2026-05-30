CREATE TYPE "public"."email_send_status" AS ENUM('sent', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."email_template_category" AS ENUM('persuratan', 'akademik', 'keuangan', 'auth', 'sistem', 'ppl', 'custom');--> statement-breakpoint
CREATE TABLE "email_layouts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"header_html" text,
	"footer_html" text,
	"css_inline" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"template_key" varchar(100),
	"recipient_email" varchar(300) NOT NULL,
	"recipient_name" varchar(200),
	"subject" varchar(500) NOT NULL,
	"status" "email_send_status" NOT NULL,
	"provider" "email_provider" NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body_blocks" jsonb NOT NULL,
	"compiled_html" text NOT NULL,
	"compiled_text" text,
	"changed_by" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"change_note" text
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"template_name" varchar(300) NOT NULL,
	"description" text,
	"category" "email_template_category" NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body_blocks" jsonb NOT NULL,
	"compiled_html" text NOT NULL,
	"compiled_text" text,
	"layout_id" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
DROP TABLE "surat_keputusan" CASCADE;--> statement-breakpoint
DROP TABLE "surat_mou" CASCADE;--> statement-breakpoint
ALTER TABLE "surat_keluar" ADD COLUMN "catat_saja" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_layouts" ADD CONSTRAINT "email_layouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_layout_id_email_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."email_layouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "esl_template_idx" ON "email_send_logs" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "esl_status_idx" ON "email_send_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "esl_sent_at_idx" ON "email_send_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "etv_template_version_idx" ON "email_template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "et_category_idx" ON "email_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "et_active_idx" ON "email_templates" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "price";