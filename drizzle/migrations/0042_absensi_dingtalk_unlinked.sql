-- Absensi: support user DingTalk tanpa akun ARKA
-- userId jadi nullable, tambah dingtalkUserId + dingtalkNama
-- Unique index diganti 2 partial index

ALTER TABLE "absensi_karyawan" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "absensi_karyawan"
  ADD COLUMN "dingtalk_user_id" text,
  ADD COLUMN "dingtalk_nama" varchar(200);

-- Ganti FK onDelete cascade → set null (agar record tetap ada saat user ARKA dihapus)
ALTER TABLE "absensi_karyawan"
  DROP CONSTRAINT IF EXISTS "absensi_karyawan_user_id_users_id_fk";

ALTER TABLE "absensi_karyawan"
  ADD CONSTRAINT "absensi_karyawan_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Drop old unique index
DROP INDEX IF EXISTS "uniq_absensi_user_tanggal_sumber";

-- Partial unique index untuk ARKA-linked records
CREATE UNIQUE INDEX "uniq_absensi_arka_user"
  ON "absensi_karyawan" ("user_id", "tanggal", "sumber")
  WHERE user_id IS NOT NULL;

-- Partial unique index untuk DingTalk-only records
CREATE UNIQUE INDEX "uniq_absensi_dtk_user"
  ON "absensi_karyawan" ("dingtalk_user_id", "tanggal", "sumber")
  WHERE user_id IS NULL;

-- Index tambahan untuk query by DingTalk user ID
CREATE INDEX "idx_absensi_dtk_user_id" ON "absensi_karyawan" ("dingtalk_user_id");
