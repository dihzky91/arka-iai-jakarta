CREATE TABLE "people_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"ppl_narasumber_id" integer,
	"instructor_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "people_link" ADD CONSTRAINT "people_link_ppl_narasumber_id_ppl_narasumber_id_fk" FOREIGN KEY ("ppl_narasumber_id") REFERENCES "public"."ppl_narasumber"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_link" ADD CONSTRAINT "people_link_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_link" ADD CONSTRAINT "people_link_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "people_link_ppl_narasumber_idx" ON "people_link" USING btree ("ppl_narasumber_id") WHERE "ppl_narasumber_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "people_link_instructor_idx" ON "people_link" USING btree ("instructor_id") WHERE "instructor_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "people_link_user_idx" ON "people_link" USING btree ("user_id");
