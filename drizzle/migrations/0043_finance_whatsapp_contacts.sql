ALTER TABLE "system_settings" ADD COLUMN "finance_contact_name" varchar(200);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "finance_whatsapp_number" varchar(30);--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "finance_contact_name" varchar(200);--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "finance_whatsapp_number" varchar(30);--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "finance_contact_name_override" varchar(200);--> statement-breakpoint
ALTER TABLE "kelas_pelatihan" ADD COLUMN "finance_whatsapp_number_override" varchar(30);
