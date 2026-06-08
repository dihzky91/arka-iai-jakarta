-- TFT (Training for Trainers) Module
-- Modul rekrutmen dan penilaian calon instruktur

DO $$ BEGIN
  CREATE TYPE "status_periode_tft" AS ENUM ('draft', 'buka', 'tutup', 'penilaian', 'selesai');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "status_pendaftar_tft" AS ENUM ('baru', 'review', 'diterima', 'ditolak');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "program_tft" AS ENUM ('brevet_ab', 'brevet_c', 'all');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "periode_tft" (
  "id" text PRIMARY KEY NOT NULL,
  "judul" varchar(300) NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "deskripsi" text,
  "tanggal_mulai" date NOT NULL,
  "tanggal_selesai" date NOT NULL,
  "waktu_mulai" varchar(5),
  "waktu_selesai" varchar(5),
  "lokasi" varchar(300),
  "batas_pendaftaran" timestamp,
  "status" "status_periode_tft" NOT NULL DEFAULT 'draft',
  "program" "program_tft" NOT NULL,
  "max_peserta" integer,
  "skor_minimum" numeric(5, 2),
  "catatan_internal" text,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pendaftar_tft" (
  "id" text PRIMARY KEY NOT NULL,
  "periode_id" text NOT NULL REFERENCES "periode_tft"("id") ON DELETE CASCADE,
  "nama_lengkap" varchar(200) NOT NULL,
  "email" varchar(150) NOT NULL,
  "no_hp" varchar(30) NOT NULL,
  "pekerjaan" text,
  "alamat_pekerjaan" text,
  "alamat_domisili" text,
  "materi_brevet_ab" text[] NOT NULL DEFAULT '{}'::text[],
  "materi_brevet_c" text[] NOT NULL DEFAULT '{}'::text[],
  "bersedia_hadir" boolean NOT NULL DEFAULT true,
  "cv_storage_key" text,
  "cv_original_name" varchar(300),
  "status" "status_pendaftar_tft" NOT NULL DEFAULT 'baru',
  "skor_akhir" numeric(5, 2),
  "catatan_admin" text,
  "reviewed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "instructor_id" text REFERENCES "instructors"("id") ON DELETE SET NULL,
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kriteria_penilaian_tft" (
  "id" text PRIMARY KEY NOT NULL,
  "periode_id" text NOT NULL REFERENCES "periode_tft"("id") ON DELETE CASCADE,
  "nama" varchar(200) NOT NULL,
  "deskripsi" text,
  "bobot" numeric(5, 2) NOT NULL,
  "skor_min" numeric(5, 2) NOT NULL DEFAULT 0,
  "skor_max" numeric(5, 2) NOT NULL DEFAULT 100,
  "urutan" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "penilai_tft" (
  "id" text PRIMARY KEY NOT NULL,
  "periode_id" text NOT NULL REFERENCES "periode_tft"("id") ON DELETE CASCADE,
  "nama" varchar(200) NOT NULL,
  "jabatan" varchar(200),
  "instansi" varchar(200),
  "catatan" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "nilai_tft" (
  "id" text PRIMARY KEY NOT NULL,
  "periode_id" text NOT NULL REFERENCES "periode_tft"("id") ON DELETE CASCADE,
  "pendaftar_id" text NOT NULL REFERENCES "pendaftar_tft"("id") ON DELETE CASCADE,
  "penilai_id" text NOT NULL REFERENCES "penilai_tft"("id") ON DELETE CASCADE,
  "kriteria_id" text NOT NULL REFERENCES "kriteria_penilaian_tft"("id") ON DELETE CASCADE,
  "skor" numeric(5, 2) NOT NULL,
  "catatan" text,
  "input_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_pendaftar_tft_periode" ON "pendaftar_tft" ("periode_id");
CREATE INDEX IF NOT EXISTS "idx_pendaftar_tft_email" ON "pendaftar_tft" ("email");
CREATE INDEX IF NOT EXISTS "idx_pendaftar_tft_status" ON "pendaftar_tft" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_pendaftar_tft_periode_email" ON "pendaftar_tft" ("periode_id", "email");

CREATE INDEX IF NOT EXISTS "idx_kriteria_tft_periode" ON "kriteria_penilaian_tft" ("periode_id");
CREATE INDEX IF NOT EXISTS "idx_penilai_tft_periode" ON "penilai_tft" ("periode_id");

CREATE INDEX IF NOT EXISTS "idx_nilai_tft_periode" ON "nilai_tft" ("periode_id");
CREATE INDEX IF NOT EXISTS "idx_nilai_tft_pendaftar" ON "nilai_tft" ("pendaftar_id");
CREATE INDEX IF NOT EXISTS "idx_nilai_tft_penilai" ON "nilai_tft" ("penilai_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_nilai_tft" ON "nilai_tft" ("pendaftar_id", "penilai_id", "kriteria_id");
