-- Migration: Merge SK/MOU fields into surat_keluar
-- Phase 1: Add new columns for SK/MOU fields

ALTER TABLE "surat_keluar"
ADD COLUMN IF NOT EXISTS "tentang" text,
ADD COLUMN IF NOT EXISTS "tanggal_berlaku" date,
ADD COLUMN IF NOT EXISTS "tanggal_berakhir" date,
ADD COLUMN IF NOT EXISTS "pihak_kedua" varchar(200),
ADD COLUMN IF NOT EXISTS "pihak_kedua_alamat" text,
ADD COLUMN IF NOT EXISTS "nilai_kerjasama" text;

-- Phase 2: Migrate data from surat_keputusan to surat_keluar
INSERT INTO surat_keluar (
  id, nomor_surat, perihal, tujuan, tanggal_surat, jenis_surat,
  tentang, tanggal_berlaku, tanggal_berakhir,
  pejabat_id, file_draft_url, qr_code_url, dibuat_oleh,
  status, created_at, updated_at
)
SELECT
  id,
  nomor_sk,
  perihal,
  '(Surat Keputusan)' AS tujuan,
  tanggal_sk,
  'keputusan'::jenis_surat,
  tentang,
  tanggal_berlaku,
  tanggal_berakhir,
  pejabat_id,
  file_url,
  qr_code_url,
  dibuat_oleh,
  'selesai'::status_surat_keluar,
  created_at,
  updated_at
FROM surat_keputusan
ON CONFLICT (id) DO NOTHING;

-- Phase 3: Migrate data from surat_mou to surat_keluar
INSERT INTO surat_keluar (
  id, nomor_surat, perihal, tujuan, tanggal_surat, jenis_surat,
  pihak_kedua, pihak_kedua_alamat, tanggal_berlaku, tanggal_berakhir, nilai_kerjasama,
  pejabat_id, file_draft_url, qr_code_url, dibuat_oleh,
  status, created_at, updated_at
)
SELECT
  id,
  nomor_mou,
  perihal,
  pihak_kedua AS tujuan,
  tanggal_mou,
  'mou'::jenis_surat,
  pihak_kedua,
  pihak_kedua_alamat,
  tanggal_berlaku,
  tanggal_berakhir,
  nilai_kerjasama,
  pejabat_id,
  file_url,
  qr_code_url,
  dibuat_oleh,
  'selesai'::status_surat_keluar,
  created_at,
  updated_at
FROM surat_mou
ON CONFLICT (id) DO NOTHING;
