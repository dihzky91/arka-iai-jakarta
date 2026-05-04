CREATE TABLE IF NOT EXISTS "honorarium_payment_proofs" (
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
ALTER TABLE "honorarium_payment_proofs"
  ADD CONSTRAINT "honorarium_payment_proofs_batch_id_honorarium_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."honorarium_batches"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "honorarium_payment_proofs"
  ADD CONSTRAINT "honorarium_payment_proofs_uploaded_by_users_id_fk"
  FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hpp_batch_idx"
  ON "honorarium_payment_proofs" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hpp_uploaded_at_idx"
  ON "honorarium_payment_proofs" USING btree ("uploaded_at");
