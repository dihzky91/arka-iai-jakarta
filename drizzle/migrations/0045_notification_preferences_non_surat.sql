ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'honorarium_status' BEFORE 'system';--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_project_invitation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_project_mention" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_project_update" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_honorarium_status" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_system" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_project_invitation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_project_mention" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_project_update" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_honorarium_status" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_system" boolean DEFAULT false NOT NULL;
