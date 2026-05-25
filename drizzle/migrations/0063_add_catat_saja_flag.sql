-- Add "Catat Saja" flag for logbook-only entries (no workflow processing)
ALTER TABLE surat_keluar
  ADD COLUMN IF NOT EXISTS catat_saja BOOLEAN NOT NULL DEFAULT false;
