-- Tipe pertanyaan enum
DO $$ BEGIN
  CREATE TYPE "tipe_pertanyaan_tft" AS ENUM ('text', 'textarea', 'radio', 'checkbox', 'select', 'number', 'file');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Pertanyaan custom per periode TFT
CREATE TABLE IF NOT EXISTS "pertanyaan_tft" (
  "id" TEXT PRIMARY KEY,
  "periode_id" TEXT NOT NULL REFERENCES "periode_tft"("id") ON DELETE CASCADE,
  "label" VARCHAR(500) NOT NULL,
  "deskripsi" TEXT,
  "tipe" "tipe_pertanyaan_tft" NOT NULL,
  "wajib" BOOLEAN NOT NULL DEFAULT false,
  "opsi" TEXT[] DEFAULT '{}'::text[],
  "urutan" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pertanyaan_tft_periode" ON "pertanyaan_tft"("periode_id");

-- Jawaban pertanyaan custom per pendaftar
CREATE TABLE IF NOT EXISTS "jawaban_tft" (
  "id" TEXT PRIMARY KEY,
  "pendaftar_id" TEXT NOT NULL REFERENCES "pendaftar_tft"("id") ON DELETE CASCADE,
  "pertanyaan_id" TEXT NOT NULL REFERENCES "pertanyaan_tft"("id") ON DELETE CASCADE,
  "nilai" TEXT,
  "nilai_array" TEXT[] DEFAULT '{}'::text[],
  "file_storage_key" TEXT,
  "file_original_name" VARCHAR(300),
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_jawaban_tft_pendaftar" ON "jawaban_tft"("pendaftar_id");
CREATE INDEX IF NOT EXISTS "idx_jawaban_tft_pertanyaan" ON "jawaban_tft"("pertanyaan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_jawaban_tft" ON "jawaban_tft"("pendaftar_id", "pertanyaan_id");
