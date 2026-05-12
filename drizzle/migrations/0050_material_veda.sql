CREATE TABLE "project_budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kategori" varchar(100) NOT NULL,
	"deskripsi" text,
	"jumlah_rencana" numeric(15, 2) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kategori" varchar(100) NOT NULL,
	"jumlah" numeric(15, 2) NOT NULL,
	"tanggal" date NOT NULL,
	"keterangan" text,
	"bukti_url" varchar(1000),
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_speakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text,
	"nama" varchar(255) NOT NULL,
	"email" varchar(255),
	"topik" varchar(255),
	"durasi_menit" integer,
	"skp" numeric(5, 2),
	"is_external" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_timesheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_minutes" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_budget_items" ADD CONSTRAINT "project_budget_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_items" ADD CONSTRAINT "project_budget_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_speakers" ADD CONSTRAINT "project_speakers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_speakers" ADD CONSTRAINT "project_speakers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_timesheets" ADD CONSTRAINT "project_timesheets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_timesheets" ADD CONSTRAINT "project_timesheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_budget_items_project_idx" ON "project_budget_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_budget_items_kategori_idx" ON "project_budget_items" USING btree ("kategori");--> statement-breakpoint
CREATE INDEX "project_expenses_project_idx" ON "project_expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_expenses_kategori_idx" ON "project_expenses" USING btree ("kategori");--> statement-breakpoint
CREATE INDEX "project_expenses_tanggal_idx" ON "project_expenses" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "project_speakers_project_idx" ON "project_speakers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_speakers_user_idx" ON "project_speakers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_timesheets_project_idx" ON "project_timesheets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_timesheets_user_idx" ON "project_timesheets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_timesheets_active_timer_idx" ON "project_timesheets" USING btree ("project_id","user_id","end_time");