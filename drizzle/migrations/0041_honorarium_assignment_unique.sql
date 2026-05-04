CREATE UNIQUE INDEX IF NOT EXISTS "uniq_honorarium_assignment_once"
  ON "honorarium_items" USING btree ("assignment_id");
