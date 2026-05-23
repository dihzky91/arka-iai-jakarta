ALTER TABLE "surat_keluar"
ADD COLUMN IF NOT EXISTS "proses_via_simpeg" boolean DEFAULT false NOT NULL;
