-- Refactor Penomoran Surat: Unified Counter per Bulan
-- Creates kode_jenis_surat table, merges counters, adds prefix_organisasi to system_settings

-- 1. Buat tabel kode_jenis_surat
CREATE TABLE IF NOT EXISTS kode_jenis_surat (
  id SERIAL PRIMARY KEY,
  jenis_surat jenis_surat NOT NULL UNIQUE,
  kode VARCHAR(20) NOT NULL,
  keterangan VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default kode jenis surat
INSERT INTO kode_jenis_surat (jenis_surat, kode, keterangan) VALUES
  ('undangan', 'U', 'Undangan'),
  ('permohonan', 'P', 'Permohonan'),
  ('keputusan', 'K', 'Keputusan'),
  ('pemberitahuan', 'PB', 'Pemberitahuan'),
  ('edaran', 'E', 'Edaran'),
  ('balasan', 'B', 'Balasan'),
  ('keterangan', 'KT', 'Keterangan'),
  ('tugas', 'T', 'Tugas'),
  ('mou', 'MOU', 'MOU'),
  ('invoice', 'INV', 'Invoice'),
  ('lainnya', 'L', 'Lainnya')
ON CONFLICT (jenis_surat) DO NOTHING;

-- 2. Tambah prefix_organisasi ke system_settings
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS prefix_organisasi VARCHAR(80) NOT NULL DEFAULT 'IAI-DKIJKT';

-- 3. Merge counter: buat temporary table dengan unified counter per (tahun, bulan)
-- Strategi: SUM counter per (tahun, bulan) dari counter terpisah per jenis
CREATE TEMP TABLE counter_merge AS
SELECT
  tahun,
  bulan,
  SUM(counter) AS counter,
  MAX(updated_at) AS updated_at
FROM nomor_surat_counter
GROUP BY tahun, bulan;

-- Drop old unique index
DROP INDEX IF EXISTS nomor_surat_counter_period_uniq;

-- Hapus kolom jenis_surat dan prefix dari counter
ALTER TABLE nomor_surat_counter DROP COLUMN IF EXISTS jenis_surat;
ALTER TABLE nomor_surat_counter DROP COLUMN IF EXISTS prefix;

-- Truncate dan re-insert dengan merged counters
TRUNCATE nomor_surat_counter;
INSERT INTO nomor_surat_counter (tahun, bulan, counter, updated_at)
SELECT tahun, bulan, counter, updated_at
FROM counter_merge;

-- Buat unique constraint baru
CREATE UNIQUE INDEX IF NOT EXISTS nomor_surat_counter_period_uniq
  ON nomor_surat_counter (tahun, bulan);

-- Cleanup temp table
DROP TABLE IF EXISTS counter_merge;
