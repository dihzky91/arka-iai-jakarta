-- Phase 5: Drop deprecated surat_keputusan and surat_mou tables
-- Data sudah dimigrasi ke surat_keluar via migration 0061

DROP TABLE IF EXISTS surat_keputusan CASCADE;
DROP TABLE IF EXISTS surat_mou CASCADE;
