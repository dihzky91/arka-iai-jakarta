-- Dashboard widget preferences per user
CREATE TABLE IF NOT EXISTS "user_dashboard_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "widget_key" varchar(50) NOT NULL,
  "visible" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "user_dashboard_pref_unique" UNIQUE("user_id", "widget_key")
);

CREATE INDEX IF NOT EXISTS "user_dashboard_pref_user_idx" ON "user_dashboard_preferences" ("user_id");
