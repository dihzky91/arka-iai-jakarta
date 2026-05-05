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
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_kelas_id_kelas_pelatihan_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "public"."kelas_pelatihan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_assignment_id_session_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."session_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wmt_active_idx" ON "whatsapp_message_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "wml_kelas_sent_idx" ON "whatsapp_message_logs" USING btree ("kelas_id","sent_at");--> statement-breakpoint
CREATE INDEX "wml_template_idx" ON "whatsapp_message_logs" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "wml_role_idx" ON "whatsapp_message_logs" USING btree ("recipient_role");
