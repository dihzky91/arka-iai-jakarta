import {
  pgTable,
  text,
  timestamp,
  boolean,
  date,
  integer,
  numeric,
  serial,
  pgEnum,
  uuid,
  varchar,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["admin", "staff", "pejabat", "viewer"]);

// Status workflow surat keluar (stepper 5 tahap)
export const statusSuratKeluarEnum = pgEnum("status_surat_keluar", [
  "draft",
  "permohonan_persetujuan",
  "reviu",
  "pengarsipan",
  "selesai",
  "dibatalkan",
]);

export const statusSuratMasukEnum = pgEnum("status_surat_masuk", [
  "diterima",
  "diproses",
  "diarsip",
  "dibatalkan",
]);

export const statusDisposisiEnum = pgEnum("status_disposisi", [
  "belum_dibaca",
  "dibaca",
  "diproses",
  "selesai",
]);

export const jenisSuratEnum = pgEnum("jenis_surat", [
  "undangan",
  "pemberitahuan",
  "permohonan",
  "keputusan",
  "mou",
  "balasan",
  "edaran",
  "keterangan",
  "tugas",
  "invoice",
  "lainnya",
]);

export const statusPernikahanEnum = pgEnum("status_pernikahan", [
  "BM",
  "M",
  "C",
  "D",
  "J",
]);

export const genderEnum = pgEnum("gender", ["Laki-laki", "Perempuan"]);

export const jenisPegawaiEnum = pgEnum("jenis_pegawai", [
  "Tetap",
  "Kontrak",
  "Magang",
  "Paruh Waktu",
]);

export const kategoriKegiatanEnum = pgEnum("kategori_kegiatan", [
  "Workshop",
  "Brevet AB",
  "Brevet C",
  "BFA",
  "Lainnya",
]);

export const statusEventEnum = pgEnum("status_event", [
  "aktif",
  "dibatalkan",
  "ditunda",
  "arsip",
]);

export const projectTypeEnum = pgEnum("project_type", [
  "Workshop",
  "Seminar",
  "Lokakarya",
  "Pelatihan",
  "Lainnya",
  "brevet_ab",
  "brevet_c",
  "bfa",
]);

export const statusPesertaEnum = pgEnum("status_peserta", ["aktif", "dicabut"]);

export const projectTaskStatusEnum = pgEnum("project_task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const tipePelaksanaanEnum = pgEnum("tipe_pelaksanaan", [
  "online",
  "offline",
  "hybrid",
]);

export type TemplateFieldKey =
  | "namaPeserta"
  | "noSertifikat"
  | "namaKegiatan"
  | "kategori"
  | "tanggalKegiatan"
  | "lokasi"
  | "skp"
  | "qrCode"
  | "signature1Nama"
  | "signature1Jabatan"
  | "signature2Nama"
  | "signature2Jabatan"
  | "signature3Nama"
  | "signature3Jabatan";

export type TemplateFieldPosition = {
  enabled: boolean;
  x: number;
  y: number;
  width?: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fontFamily: "Helvetica" | "Times-Roman" | "Courier";
  color: string;
  align: "left" | "center" | "right";
};

export type TemplateFieldMap = Partial<
  Record<TemplateFieldKey, TemplateFieldPosition>
>;

// ─── DIVISI ──────────────────────────────────────────────────────────────────

export const divisi = pgTable("divisi", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 150 }).notNull(),
  kode: varchar("kode", { length: 20 }).unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Dynamic role foundation. `users.role` tetap disimpan sementara sebagai
// compatibility field untuk flow lama dan session Better Auth.
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 150 }).notNull(),
  kode: varchar("kode", { length: 50 }).notNull().unique(),
  isSystem: boolean("is_system").default(false).notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const roleCapabilities = pgTable(
  "role_capabilities",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    capability: varchar("capability", { length: 100 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.roleId, t.capability],
      name: "role_capabilities_pk",
    }),
    capabilityIdx: index("role_capabilities_capability_idx").on(t.capability),
  }),
);

// ─── DASHBOARD PREFERENCES ───────────────────────────────────────────────────

export const userDashboardPreferences = pgTable(
  "user_dashboard_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    widgetKey: varchar("widget_key", { length: 50 }).notNull(),
    visible: boolean("visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("user_dashboard_pref_user_idx").on(t.userId),
    uniq: uniqueIndex("user_dashboard_pref_unique").on(t.userId, t.widgetKey),
  }),
);

// ─── USERS (akun login + data dasar pegawai) ─────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // "name" di Better Auth di-mapping ke kolom ini via user.fields.name
  namaLengkap: varchar("nama_lengkap", { length: 200 }).notNull(),
  email: varchar("email", { length: 150 }).unique().notNull(),
  // Wajib ada untuk Better Auth — kita tidak pakai verifikasi email, default true
  emailVerified: boolean("email_verified").notNull().default(false),
  emailPribadi: varchar("email_pribadi", { length: 150 }),
  noHp: varchar("no_hp", { length: 20 }),
  role: roleEnum("role").default("staff"),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  roleId: integer("role_id").references(() => roles.id),
  divisiId: integer("divisi_id").references(() => divisi.id),
  jabatan: varchar("jabatan", { length: 150 }),
  levelJabatan: varchar("level_jabatan", { length: 50 }),
  jenisPegawai: jenisPegawaiEnum("jenis_pegawai").default("Tetap"),
  tanggalMasuk: date("tanggal_masuk"),
  avatarUrl: text("avatar_url"),
  qrContactUrl: text("qr_contact_url"),
  isActive: boolean("is_active").default(true),
  activatedAt: timestamp("activated_at"),
  dingtalkUserId: text("dingtalk_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── BETTER AUTH tables (sessions, accounts, verification) ───────────────────
// Better Auth menyimpan credentials/session di tabel terpisah dari `users`.
// Tabel `users` di atas adalah data domain (pegawai) — di-link via userId.

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 1: Biodata ────────────────────────────────────────

export const pegawaiBiodata = pgTable("pegawai_biodata", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  noKtp: varchar("no_ktp", { length: 20 }),
  gender: genderEnum("gender"),
  statusPernikahan: statusPernikahanEnum("status_pernikahan"),
  tempatLahir: varchar("tempat_lahir", { length: 100 }),
  tanggalLahir: date("tanggal_lahir"),
  alamatTinggal: text("alamat_tinggal"),
  kodePos: varchar("kode_pos", { length: 10 }),
  provinsi: varchar("provinsi", { length: 100 }),
  kotaKabupaten: varchar("kota_kabupaten", { length: 100 }),
  alamatKtp: text("alamat_ktp"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 2: Kelengkapan Karyawan ───────────────────────────

export const pegawaiKelengkapan = pgTable("pegawai_kelengkapan", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  fotoUrl: text("foto_url"),
  ktpUrl: text("ktp_url"),
  npwpUrl: text("npwp_url"),
  bpjsUrl: text("bpjs_url"),
  ijazahUrl: text("ijazah_url"),
  dokumenLainUrl: text("dokumen_lain_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 3: Data Keluarga ──────────────────────────────────

export const pegawaiKeluarga = pgTable("pegawai_keluarga", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  hubungan: varchar("hubungan", { length: 50 }),
  namaAnggota: varchar("nama_anggota", { length: 200 }).notNull(),
  tempatLahir: varchar("tempat_lahir", { length: 100 }),
  tanggalLahir: date("tanggal_lahir"),
  pekerjaan: varchar("pekerjaan", { length: 150 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 4: Riwayat Pendidikan ─────────────────────────────

export const pegawaiPendidikan = pgTable("pegawai_pendidikan", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  jenjang: varchar("jenjang", { length: 20 }),
  namaInstitusi: varchar("nama_institusi", { length: 200 }),
  jurusan: varchar("jurusan", { length: 150 }),
  tahunMasuk: integer("tahun_masuk"),
  tahunLulus: integer("tahun_lulus"),
  ijazahUrl: text("ijazah_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 5: Riwayat Pekerjaan ──────────────────────────────

export const pegawaiRiwayatPekerjaan = pgTable("pegawai_riwayat_pekerjaan", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  namaPerusahaan: varchar("nama_perusahaan", { length: 200 }),
  jabatan: varchar("jabatan", { length: 150 }),
  tanggalMulai: date("tanggal_mulai"),
  tanggalSelesai: date("tanggal_selesai"),
  keterangan: text("keterangan"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 6: Riwayat Kesehatan ──────────────────────────────

export const pegawaiKesehatan = pgTable("pegawai_kesehatan", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  golonganDarah: varchar("golongan_darah", { length: 5 }),
  tinggiBadan: integer("tinggi_badan"),
  beratBadan: integer("berat_badan"),
  riwayatPenyakit: text("riwayat_penyakit"),
  alergi: text("alergi"),
  catatanKesehatan: text("catatan_kesehatan"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PEGAWAI DETAIL — Tab 7: Pernyataan Integritas ──────────────────────────

export const pegawaiPernyataanIntegritas = pgTable(
  "pegawai_pernyataan_integritas",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    tanggalPernyataan: date("tanggal_pernyataan"),
    fileUrl: text("file_url"),
    statusTandaTangan: boolean("status_tanda_tangan").default(false),
    catatan: text("catatan"),
    createdAt: timestamp("created_at").defaultNow(),
  },
);

// ─── PEJABAT PENANDATANGAN ───────────────────────────────────────────────────

export const pejabatPenandatangan = pgTable("pejabat_penandatangan", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  namaJabatan: varchar("nama_jabatan", { length: 200 }).notNull(),
  wilayah: varchar("wilayah", { length: 100 }),
  ttdUrl: text("ttd_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── NOMOR SURAT COUNTER ─────────────────────────────────────────────────────
// UNIQUE constraint (tahun, bulan, jenis_surat) — atomic increment via transaction

export const nomorSuratCounter = pgTable(
  "nomor_surat_counter",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    bulan: integer("bulan").notNull(),
    jenisSurat: jenisSuratEnum("jenis_surat").notNull(),
    counter: integer("counter").default(0).notNull(),
    prefix: varchar("prefix", { length: 80 }),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("nomor_surat_counter_period_uniq").on(
      t.tahun,
      t.bulan,
      t.jenisSurat,
    ),
  }),
);

// ─── SURAT KELUAR ────────────────────────────────────────────────────────────

export const suratKeluar = pgTable("surat_keluar", {
  id: text("id").primaryKey(),
  nomorSurat: varchar("nomor_surat", { length: 200 }).unique(),
  perihal: text("perihal").notNull(),
  tujuan: varchar("tujuan", { length: 300 }).notNull(),
  tujuanAlamat: text("tujuan_alamat"),
  // BACKDATE: input manual bebas, tanpa validasi range
  tanggalSurat: date("tanggal_surat").notNull(),
  jenisSurat: jenisSuratEnum("jenis_surat").notNull(),
  isiSingkat: text("isi_singkat"),
  status: statusSuratKeluarEnum("status").default("draft"),
  fileDraftUrl: text("file_draft_url"),
  fileFinalUrl: text("file_final_url"),
  lampiranUrl: text("lampiran_url"),
  qrCodeUrl: text("qr_code_url"),
  pejabatId: integer("pejabat_id").references(() => pejabatPenandatangan.id),
  dibuatOleh: text("dibuat_oleh").references(() => users.id),
  divisiId: integer("divisi_id").references(() => divisi.id),
  disetujuiOleh: text("disetujui_oleh").references(() => users.id),
  tanggalDisetujui: timestamp("tanggal_disetujui"),
  catatanReviu: text("catatan_reviu"),
  catatanReviuAt: timestamp("catatan_reviu_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── SURAT MASUK ─────────────────────────────────────────────────────────────

export const suratMasuk = pgTable("surat_masuk", {
  id: text("id").primaryKey(),
  nomorAgenda: varchar("nomor_agenda", { length: 50 }),
  nomorSuratAsal: varchar("nomor_surat_asal", { length: 200 }),
  perihal: text("perihal").notNull(),
  pengirim: varchar("pengirim", { length: 200 }).notNull(),
  pengirimAlamat: text("pengirim_alamat"),
  // BACKDATE: keduanya input manual, tanpa validasi range
  tanggalSurat: date("tanggal_surat").notNull(),
  tanggalDiterima: date("tanggal_diterima").notNull(),
  jenisSurat: jenisSuratEnum("jenis_surat").notNull(),
  status: statusSuratMasukEnum("status").default("diterima"),
  isiSingkat: text("isi_singkat"),
  fileUrl: text("file_url"),
  dicatatOleh: text("dicatat_oleh").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── DISPOSISI ───────────────────────────────────────────────────────────────

export const disposisi = pgTable("disposisi", {
  id: text("id").primaryKey(),
  suratMasukId: text("surat_masuk_id")
    .references(() => suratMasuk.id)
    .notNull(),
  dariUserId: text("dari_user_id")
    .references(() => users.id)
    .notNull(),
  kepadaUserId: text("kepada_user_id")
    .references(() => users.id)
    .notNull(),
  catatan: text("catatan"),
  instruksi: text("instruksi"),
  batasWaktu: date("batas_waktu"),
  status: statusDisposisiEnum("status").default("belum_dibaca"),
  tanggalDisposisi: timestamp("tanggal_disposisi").defaultNow(),
  tanggalDibaca: timestamp("tanggal_dibaca"),
  tanggalSelesai: timestamp("tanggal_selesai"),
  // Self-reference untuk chain disposisi. Tidak pakai .references() agar tidak circular.
  parentDisposisiId: text("parent_disposisi_id"),
});

// ─── SURAT KEPUTUSAN ─────────────────────────────────────────────────────────

export const suratKeputusan = pgTable("surat_keputusan", {
  id: text("id").primaryKey(),
  nomorSK: varchar("nomor_sk", { length: 200 }).unique().notNull(),
  perihal: text("perihal").notNull(),
  tentang: text("tentang").notNull(),
  // BACKDATE: input manual bebas
  tanggalSK: date("tanggal_sk").notNull(),
  tanggalBerlaku: date("tanggal_berlaku"),
  tanggalBerakhir: date("tanggal_berakhir"),
  pejabatId: integer("pejabat_id").references(() => pejabatPenandatangan.id),
  fileUrl: text("file_url"),
  qrCodeUrl: text("qr_code_url"),
  dibuatOleh: text("dibuat_oleh").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── SURAT MOU ───────────────────────────────────────────────────────────────

export const suratMou = pgTable("surat_mou", {
  id: text("id").primaryKey(),
  nomorMOU: varchar("nomor_mou", { length: 200 }).unique().notNull(),
  perihal: text("perihal").notNull(),
  pihakKedua: varchar("pihak_kedua", { length: 200 }).notNull(),
  pihakKeduaAlamat: text("pihak_kedua_alamat"),
  // BACKDATE: input manual bebas
  tanggalMOU: date("tanggal_mou").notNull(),
  tanggalBerlaku: date("tanggal_berlaku"),
  tanggalBerakhir: date("tanggal_berakhir"),
  nilaiKerjasama: text("nilai_kerjasama"),
  fileUrl: text("file_url"),
  qrCodeUrl: text("qr_code_url"),
  pejabatId: integer("pejabat_id").references(() => pejabatPenandatangan.id),
  dibuatOleh: text("dibuat_oleh").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  aksi: varchar("aksi", { length: 100 }),
  entitasType: varchar("entitas_type", { length: 50 }),
  entitasId: varchar("entitas_id", { length: 100 }),
  detail: jsonb("detail"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── EMAIL PROVIDER ────────────────────────────────────────────────────────────

export const emailProviderEnum = pgEnum("email_provider", ["mailjet", "brevo"]);

// ─── SYSTEM SETTINGS ─────────────────────────────────────────────────────────
// Singleton row — aplikasi hanya punya satu baris konfigurasi identitas sistem.

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  namaSistem: varchar("nama_sistem", { length: 200 }).notNull().default("ARKA"),
  singkatan: varchar("singkatan", { length: 20 }),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  financeContactName: varchar("finance_contact_name", { length: 200 }),
  financeWhatsappNumber: varchar("finance_whatsapp_number", { length: 30 }),
  // Non-secret runtime preferences (admin-editable from UI)
  defaultDisposisiDeadlineDays: integer("default_disposisi_deadline_days")
    .default(7)
    .notNull(),
  notificationEmailEnabled: boolean("notification_email_enabled")
    .default(true)
    .notNull(),
  whatsappBotEnabled: boolean("whatsapp_bot_enabled")
    .default(false)
    .notNull(),
  emailProvider: emailProviderEnum("email_provider").default("mailjet").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
});

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "disposisi_baru",
  "disposisi_deadline",
  "surat_keluar_approval",
  "surat_keluar_revisi",
  "surat_keluar_selesai",
  "surat_masuk_baru",
  "project_invitation",
  "mention",
  "project_update",
  "honorarium_status",
  "system",
]);

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  entitasType: varchar("entitas_type", { length: 50 }),
  entitasId: varchar("entitas_id", { length: 100 }),
  isRead: boolean("is_read").default(false).notNull(),
  isEmailSent: boolean("is_email_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

// ─── NOTIFICATION PREFERENCES ──────────────────────────────────────────────────
// Per-user toggle: untuk tiap tipe notifikasi, user bisa enable/disable in-app & email.

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  // In-app notification toggles
  inAppDisposisiBaru: boolean("in_app_disposisi_baru").default(true).notNull(),
  inAppDisposisiDeadline: boolean("in_app_disposisi_deadline")
    .default(true)
    .notNull(),
  inAppSuratKeluarApproval: boolean("in_app_surat_keluar_approval")
    .default(true)
    .notNull(),
  inAppSuratKeluarRevisi: boolean("in_app_surat_keluar_revisi")
    .default(true)
    .notNull(),
  inAppSuratKeluarSelesai: boolean("in_app_surat_keluar_selesai")
    .default(true)
    .notNull(),
  inAppSuratMasukBaru: boolean("in_app_surat_masuk_baru")
    .default(true)
    .notNull(),
  inAppProjectInvitation: boolean("in_app_project_invitation")
    .default(true)
    .notNull(),
  inAppProjectMention: boolean("in_app_project_mention")
    .default(true)
    .notNull(),
  inAppProjectUpdate: boolean("in_app_project_update")
    .default(true)
    .notNull(),
  inAppHonorariumStatus: boolean("in_app_honorarium_status")
    .default(true)
    .notNull(),
  inAppSystem: boolean("in_app_system").default(true).notNull(),
  // Email notification toggles
  emailDisposisiBaru: boolean("email_disposisi_baru").default(true).notNull(),
  emailDisposisiDeadline: boolean("email_disposisi_deadline")
    .default(true)
    .notNull(),
  emailSuratKeluarApproval: boolean("email_surat_keluar_approval")
    .default(false)
    .notNull(),
  emailSuratKeluarRevisi: boolean("email_surat_keluar_revisi")
    .default(false)
    .notNull(),
  emailSuratKeluarSelesai: boolean("email_surat_keluar_selesai")
    .default(false)
    .notNull(),
  emailSuratMasukBaru: boolean("email_surat_masuk_baru")
    .default(false)
    .notNull(),
  emailProjectInvitation: boolean("email_project_invitation")
    .default(false)
    .notNull(),
  emailProjectMention: boolean("email_project_mention")
    .default(false)
    .notNull(),
  emailProjectUpdate: boolean("email_project_update")
    .default(false)
    .notNull(),
  emailHonorariumStatus: boolean("email_honorarium_status")
    .default(false)
    .notNull(),
  emailSystem: boolean("email_system").default(false).notNull(),
  // Reminder threshold (hari sebelum deadline)
  deadlineReminderDays: integer("deadline_reminder_days").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── CALENDAR EVENTS ───────────────────────────────────────────────────────────

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "surat_deadline",
  "disposisi_deadline",
  "rapat",
  "reminder",
  "other",
  "ujian",
  "ujian_pengawas",
  "admin_jaga",
]);

export const calendarEvents = pgTable("calendar_events", {
  id: text("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  eventType: calendarEventTypeEnum("event_type").notNull(),
  entitasType: varchar("entitas_type", { length: 50 }),
  entitasId: varchar("entitas_id", { length: 100 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").default(false).notNull(),
  userId: text("user_id").references(() => users.id),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── SERTIFIKAT & KEGIATAN ───────────────────────────────────────────────────

export const certificateTemplates = pgTable(
  "certificate_templates",
  {
    id: serial("id").primaryKey(),
    nama: varchar("nama", { length: 200 }).notNull(),
    kategori: kategoriKegiatanEnum("kategori").notNull(),
    imageUrl: text("image_url").notNull(),
    imageWidth: integer("image_width").notNull(),
    imageHeight: integer("image_height").notNull(),
    fieldPositions: jsonb("field_positions")
      .notNull()
      .$type<TemplateFieldMap>()
      .default({}),
    isDefault: boolean("is_default").default(false),
    isActive: boolean("is_active").default(true),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    kategoriIdx: index("certificate_templates_kategori_idx").on(t.kategori),
  }),
);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  kodeEvent: varchar("kode_event", { length: 30 }).unique().notNull(),
  namaKegiatan: varchar("nama_kegiatan", { length: 255 }).notNull(),
  kategori: kategoriKegiatanEnum("kategori").default("Workshop").notNull(),
  statusEvent: statusEventEnum("status_event").default("aktif").notNull(),
  tanggalMulai: date("tanggal_mulai").notNull(),
  tanggalSelesai: date("tanggal_selesai").notNull(),
  lokasi: varchar("lokasi", { length: 255 }),
  skp: varchar("skp", { length: 50 }),
  keterangan: text("keterangan"),
  certificateTemplateId: integer("certificate_template_id").references(
    () => certificateTemplates.id,
    { onDelete: "set null" },
  ),
  createdBy: text("created_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventCertificateCounters = pgTable("event_certificate_counters", {
  eventId: integer("event_id")
    .primaryKey()
    .references(() => events.id, { onDelete: "cascade" }),
  lastCounter: integer("last_counter").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signatories = pgTable("signatories", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 255 }).notNull(),
  jabatan: varchar("jabatan", { length: 255 }),
  pejabatId: integer("pejabat_id").references(() => pejabatPenandatangan.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventSignatories = pgTable(
  "event_signatories",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    signatoryId: integer("signatory_id")
      .notNull()
      .references(() => signatories.id, { onDelete: "cascade" }),
    urutan: integer("urutan").notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.signatoryId] }),
  }),
);

// Project collaboration workspace: planning, discussion, files, and members.
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    type: projectTypeEnum("type").notNull(),
    description: text("description"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    price: numeric("price", { precision: 15, scale: 2 }),
    priceMember: numeric("price_member", { precision: 15, scale: 2 }),
    priceNonMember: numeric("price_non_member", { precision: 15, scale: 2 }),
    tipePelaksanaan: tipePelaksanaanEnum("tipe_pelaksanaan"),
    waktuMulai: varchar("waktu_mulai", { length: 5 }),
    waktuSelesai: varchar("waktu_selesai", { length: 5 }),
    lokasi: varchar("lokasi", { length: 255 }),
    maxPeserta: integer("max_peserta"),
    isWaitlistEnabled: boolean("is_waitlist_enabled").notNull().default(false),
    status: varchar("status", { length: 50 }).notNull().default("not_started"),
    skpMode: varchar("skp_mode", { length: 20 }).notNull().default("auto"),
    skp: numeric("skp", { precision: 5, scale: 2 }),
    halfDaySkp: varchar("half_day_skp", { length: 5 }),
    eventId: integer("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    kelasUjianId: text("kelas_ujian_id").references(() => kelasUjian.id, {
      onDelete: "set null",
    }),
    progress: integer("progress").notNull().default(0),
    isTemplate: boolean("is_template").notNull().default(false),
    templateSourceId: uuid("template_source_id").references((): AnyPgColumn => projects.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("projects_status_idx").on(t.status),
    createdByIdx: index("projects_created_by_idx").on(t.createdBy),
    eventIdx: index("projects_event_idx").on(t.eventId),
    kelasUjianIdx: index("projects_kelas_ujian_idx").on(t.kelasUjianId),
    kelasUjianUniq: uniqueIndex("projects_kelas_ujian_unique_idx")
      .on(t.kelasUjianId)
      .where(sql`kelas_ujian_id IS NOT NULL`),
  }),
);

export const projectLabels = pgTable("project_labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6B7280"),
  group: varchar("group", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectToLabels = pgTable(
  "project_to_labels",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => projectLabels.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.projectId, t.labelId],
      name: "project_to_labels_pk",
    }),
  }),
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"),
    addedBy: text("added_by")
      .notNull()
      .references(() => users.id),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex("project_member_unique").on(t.projectId, t.userId),
    projectIdx: index("project_members_project_idx").on(t.projectId),
    userIdx: index("project_members_user_idx").on(t.userId),
  }),
);

export const projectComments = pgTable(
  "project_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => projectComments.id,
      { onDelete: "cascade" },
    ),
    content: text("content").notNull(),
    isInternal: boolean("is_internal").default(false),
    isEdited: boolean("is_edited").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_comments_project_idx").on(t.projectId),
    parentIdx: index("project_comments_parent_idx").on(t.parentId),
  }),
);

export const projectCommentMentions = pgTable(
  "project_comment_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => projectComments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    isRead: boolean("is_read").default(false),
  },
  (t) => ({
    unq: uniqueIndex("mention_unique").on(t.commentId, t.userId),
  }),
);

export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    commentId: uuid("comment_id").references(() => projectComments.id, {
      onDelete: "set null",
    }),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileUrl: varchar("file_url", { length: 1000 }).notNull(),
    storageKey: varchar("storage_key", { length: 1000 }),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_files_project_idx").on(t.projectId),
    commentIdx: index("project_files_comment_idx").on(t.commentId),
  }),
);

export const projectActivityLog = pgTable(
  "project_activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_activity_project_idx").on(t.projectId),
    createdAtIdx: index("project_activity_created_at_idx").on(t.createdAt),
  }),
);

export const projectMilestones = pgTable(
  "project_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    targetDate: date("target_date"),
    isCompleted: boolean("is_completed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_milestones_project_idx").on(t.projectId),
  }),
);

export const projectNotes = pgTable(
  "project_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_notes_project_idx").on(t.projectId),
  }),
);

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: projectTaskStatusEnum("status").notNull().default("todo"),
    dueDate: date("due_date"),
    milestoneId: uuid("milestone_id").references(() => projectMilestones.id, {
      onDelete: "set null",
    }),
    relatedEntityType: varchar("related_entity_type", { length: 50 }),
    relatedEntityId: varchar("related_entity_id", { length: 100 }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_tasks_project_idx").on(t.projectId),
    assigneeIdx: index("project_tasks_assignee_idx").on(t.assigneeId),
    statusIdx: index("project_tasks_status_idx").on(t.status),
    milestoneIdx: index("project_tasks_milestone_idx").on(t.milestoneId),
  }),
);

export const projectSpeakers = pgTable(
  "project_speakers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    nama: varchar("nama", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    topik: varchar("topik", { length: 255 }),
    durasiMenit: integer("durasi_menit"),
    skp: numeric("skp", { precision: 5, scale: 2 }),
    isExternal: boolean("is_external").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_speakers_project_idx").on(t.projectId),
    userIdx: index("project_speakers_user_idx").on(t.userId),
  }),
);

export const projectBudgetItems = pgTable(
  "project_budget_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kategori: varchar("kategori", { length: 100 }).notNull(),
    deskripsi: text(),
    jumlahRencana: numeric("jumlah_rencana", {
      precision: 15,
      scale: 2,
    }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_budget_items_project_idx").on(t.projectId),
    kategoriIdx: index("project_budget_items_kategori_idx").on(t.kategori),
  }),
);

export const projectExpenses = pgTable(
  "project_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kategori: varchar("kategori", { length: 100 }).notNull(),
    jumlah: numeric("jumlah", { precision: 15, scale: 2 }).notNull(),
    tanggal: date("tanggal").notNull(),
    keterangan: text(),
    buktiUrl: varchar("bukti_url", { length: 1000 }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_expenses_project_idx").on(t.projectId),
    kategoriIdx: index("project_expenses_kategori_idx").on(t.kategori),
    tanggalIdx: index("project_expenses_tanggal_idx").on(t.tanggal),
  }),
);

export const projectTimesheets = pgTable(
  "project_timesheets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    durationMinutes: integer("duration_minutes"),
    description: text(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectIdx: index("project_timesheets_project_idx").on(t.projectId),
    userIdx: index("project_timesheets_user_idx").on(t.userId),
    activeTimerIdx: index("project_timesheets_active_timer_idx").on(
      t.projectId,
      t.userId,
      t.endTime,
    ),
  }),
);

export const participants = pgTable(
  "participants",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    noSertifikat: varchar("no_sertifikat", { length: 100 }).notNull(),
    nama: varchar("nama", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).default("Peserta").notNull(),
    email: varchar("email", { length: 150 }),
    emailSentAt: timestamp("email_sent_at"),
    statusPeserta: statusPesertaEnum("status_peserta")
      .default("aktif")
      .notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedBy: text("revoked_by").references(() => users.id),
    revokeReason: text("revoke_reason"),
    deletedAt: timestamp("deleted_at"),
    lastPdfHash: varchar("last_pdf_hash", { length: 64 }),
    lastPdfGeneratedAt: timestamp("last_pdf_generated_at"),
    replacesParticipantId: integer("replaces_participant_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    eventIdIdx: index("participants_event_id_idx").on(t.eventId),
    statusIdx: index("participants_status_idx").on(t.statusPeserta),
    replacesIdx: index("participants_replaces_idx").on(t.replacesParticipantId),
  }),
);

export const participantRevisions = pgTable(
  "participant_revisions",
  {
    id: serial("id").primaryKey(),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").references(() => users.id),
    changeType: varchar("change_type", { length: 30 }).notNull(), // create, update, revoke, reactivate, soft_delete, restore, reissue
    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    participantIdx: index("participant_revisions_participant_idx").on(
      t.participantId,
    ),
  }),
);

// ─── JADWAL UJIAN ────────────────────────────────────────────────────────────

// Nilai lookup (program, tipe, mode) dikelola admin dari UI — tidak pakai enum
export const jadwalUjianConfig = pgTable(
  "jadwal_ujian_config",
  {
    id: text("id").primaryKey(),
    jenis: varchar("jenis", { length: 20 }).notNull(), // "program" | "tipe" | "mode"
    nilai: varchar("nilai", { length: 100 }).notNull(),
    urutan: integer("urutan").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uniq_config_jenis_nilai").on(t.jenis, t.nilai)],
);

export const pengawas = pgTable("pengawas", {
  id: text("id").primaryKey(),
  nama: varchar("nama", { length: 200 }).notNull(),
  catatan: text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kelasUjian = pgTable("kelas_ujian", {
  id: text("id").primaryKey(),
  namaKelas: varchar("nama_kelas", { length: 200 }).notNull(),
  program: varchar("program", { length: 100 }).notNull(),
  tipe: varchar("tipe", { length: 100 }).notNull(),
  mode: varchar("mode", { length: 50 }).notNull(),
  lokasi: varchar("lokasi", { length: 300 }),
  catatan: text("catatan"),
  kelasPelatihanId: text("kelas_pelatihan_id").references(
    () => kelasPelatihan.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const materiUjian = pgTable("materi_ujian", {
  id: text("id").primaryKey(),
  nama: varchar("nama", { length: 200 }).notNull(),
  program: varchar("program", { length: 100 }).notNull(),
  urutan: integer("urutan").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const jadwalUjian = pgTable("jadwal_ujian", {
  id: text("id").primaryKey(),
  kelasId: text("kelas_id")
    .notNull()
    .references(() => kelasUjian.id, { onDelete: "cascade" }),
  mataPelajaran: text("mata_pelajaran").array().notNull(),
  tanggalUjian: date("tanggal_ujian").notNull(),
  jamMulai: varchar("jam_mulai", { length: 5 }).notNull(),
  jamSelesai: varchar("jam_selesai", { length: 5 }).notNull(),
  catatan: text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const penugasanPengawas = pgTable(
  "penugasan_pengawas",
  {
    id: text("id").primaryKey(),
    ujianId: text("ujian_id")
      .notNull()
      .references(() => jadwalUjian.id, { onDelete: "cascade" }),
    pengawasId: text("pengawas_id")
      .notNull()
      .references(() => pengawas.id, { onDelete: "cascade" }),
    konflik: boolean("konflik").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uniq_ujian_pengawas").on(t.ujianId, t.pengawasId)],
);

export const adminJaga = pgTable(
  "admin_jaga",
  {
    id: text("id").primaryKey(),
    ujianId: text("ujian_id")
      .notNull()
      .references(() => jadwalUjian.id, { onDelete: "cascade" }),
    pengawasId: text("pengawas_id")
      .notNull()
      .references(() => pengawas.id, { onDelete: "cascade" }),
    catatan: text("catatan"),
    konflik: boolean("konflik").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_admin_jaga_ujian_pengawas").on(t.ujianId, t.pengawasId),
  ],
);

export const jadwalAdminJaga = pgTable("jadwal_admin_jaga", {
  id: text("id").primaryKey(),
  kelasId: text("kelas_id")
    .notNull()
    .references(() => kelasUjian.id, { onDelete: "cascade" }),
  tanggal: date("tanggal").notNull(),
  jamMulai: varchar("jam_mulai", { length: 5 }).default("17:15").notNull(),
  jamSelesai: varchar("jam_selesai", { length: 5 }).default("21:30").notNull(),
  materi: varchar("materi", { length: 300 }).notNull(),
  pengawasId: text("pengawas_id")
    .notNull()
    .references(() => pengawas.id, { onDelete: "cascade" }),
  catatan: text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AnnouncementAudience = {
  all: boolean;
  roles: Array<"admin" | "staff" | "pejabat" | "viewer">;
  divisiIds: number[];
};

export type AnnouncementAttachment = {
  fileName: string;
  url: string;
  contentType?: string;
  size?: number;
};

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey(),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  audience: jsonb("audience").$type<AnnouncementAudience>().notNull(),
  attachments: jsonb("attachments")
    .$type<AnnouncementAttachment[]>()
    .notNull()
    .default([]),
  isPinned: boolean("is_pinned").default(false).notNull(),
  requiresAck: boolean("requires_ack").default(false).notNull(),
  status: text("status", { enum: ["draft", "published"] })
    .default("published")
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: text("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at"),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.announcementId, t.userId],
      name: "announcement_reads_pk",
    }),
    announcementIdx: index("announcement_reads_announcement_idx").on(
      t.announcementId,
    ),
    userIdx: index("announcement_reads_user_idx").on(t.userId),
  }),
);

// ─── USER INVITATIONS ────────────────────────────────────────────────────────
// Fase 2 — Invitation lifecycle: invite → aktivasi → login.
// Token dikirim via email, berlaku 24 jam. Setelah user set password, usedAt diisi.

export const userInvitationStatusEnum = pgEnum("user_invitation_status", [
  "pending",
  "accepted",
  "expired",
  "cancelled",
]);

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: varchar("email", { length: 150 }).notNull(),
    namaLengkap: varchar("nama_lengkap", { length: 200 }).notNull(),
    role: roleEnum("role").default("staff").notNull(),
    roleId: integer("role_id").references(() => roles.id),
    divisiId: integer("divisi_id").references(() => divisi.id),
    jabatan: varchar("jabatan", { length: 150 }),
    token: text("token").notNull().unique(),
    status: userInvitationStatusEnum("status").default("pending").notNull(),
    expiredAt: timestamp("expired_at").notNull(),
    usedAt: timestamp("used_at"),
    invitedBy: text("invited_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("user_invitations_email_idx").on(t.email),
    tokenIdx: index("user_invitations_token_idx").on(t.token),
    statusIdx: index("user_invitations_status_idx").on(t.status),
  }),
);

// ─── INVOICE ─────────────────────────────────────────────────────────────────
// Nomor invoice = nomor surat (dialokasikan via allocateNomorSurat, jenisSurat="invoice")

export const statusInvoiceEnum = pgEnum("status_invoice", [
  "draft",
  "terbit",
  "dibatalkan",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    nomorSurat: varchar("nomor_surat", { length: 200 }).unique(),
    tanggalInvoice: date("tanggal_invoice").notNull(),
    perihal: varchar("perihal", { length: 300 }).notNull(),
    kepada: varchar("kepada", { length: 300 }).notNull(),
    kepadaAlamat: text("kepada_alamat"),
    items: jsonb("items").notNull(), // [{deskripsi, kuantitas, satuan, hargaSatuan, total}]
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    pajakPersen: numeric("pajak_persen", { precision: 5, scale: 2 }).default("0"),
    pajakAmount: numeric("pajak_amount", { precision: 14, scale: 2 }).default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    catatan: text("catatan"),
    status: statusInvoiceEnum("status").default("draft"),
    fileUrl: text("file_url"),
    dibuatOleh: text("dibuat_oleh").references(() => users.id),
    pejabatId: integer("pejabat_id").references(() => pejabatPenandatangan.id),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("inv_status_idx").on(t.status),
    index("inv_tanggal_idx").on(t.tanggalInvoice),
    index("inv_project_idx").on(t.projectId),
  ],
);

// ─── KUITANSI ──────────────────────────────────────────────────────────────────
// Penomoran berdiri sendiri, terpisah dari sistem nomor surat.

export const kuitansiCounter = pgTable(
  "kuitansi_counter",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    bulan: integer("bulan").notNull(),
    counter: integer("counter").default(0).notNull(),
    prefix: varchar("prefix", { length: 80 }).default("KWT"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("kuitansi_counter_period_uniq").on(
      t.tahun,
      t.bulan,
    ),
  }),
);

export const statusKuitansiEnum = pgEnum("status_kuitansi", [
  "draft",
  "terbit",
  "dibatalkan",
]);

export const kuitansi = pgTable(
  "kuitansi",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    nomorKuitansi: varchar("nomor_kuitansi", { length: 200 }).unique(),
    tanggalKuitansi: date("tanggal_kuitansi").notNull(),
    diterimaDari: varchar("diterima_dari", { length: 300 }).notNull(),
    uraian: text("uraian").notNull(),
    jumlah: numeric("jumlah", { precision: 14, scale: 2 }).notNull(),
    terbilang: text("terbilang"),
    untukPembayaran: varchar("untuk_pembayaran", { length: 300 }).notNull(),
    catatan: text("catatan"),
    status: statusKuitansiEnum("status").default("draft"),
    fileUrl: text("file_url"),
    dibuatOleh: text("dibuat_oleh").references(() => users.id),
    pejabatId: integer("pejabat_id").references(() => pejabatPenandatangan.id),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("kwt_status_idx").on(t.status),
    index("kwt_tanggal_idx").on(t.tanggalKuitansi),
    index("kwt_project_idx").on(t.projectId),
  ],
);

// ─── TYPE EXPORTS ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Divisi = typeof divisi.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RoleCapability = typeof roleCapabilities.$inferSelect;
export type NewRoleCapability = typeof roleCapabilities.$inferInsert;
export type SuratKeluar = typeof suratKeluar.$inferSelect;
export type NewSuratKeluar = typeof suratKeluar.$inferInsert;
export type SuratMasuk = typeof suratMasuk.$inferSelect;
export type NewSuratMasuk = typeof suratMasuk.$inferInsert;
export type Disposisi = typeof disposisi.$inferSelect;
export type NewDisposisi = typeof disposisi.$inferInsert;
export type SuratKeputusan = typeof suratKeputusan.$inferSelect;
export type SuratMou = typeof suratMou.$inferSelect;
export type NomorSuratCounter = typeof nomorSuratCounter.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type NotificationPreferences =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences =
  typeof notificationPreferences.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type NewCertificateTemplate = typeof certificateTemplates.$inferInsert;
export type EventCertificateCounter =
  typeof eventCertificateCounters.$inferSelect;
export type NewEventCertificateCounter =
  typeof eventCertificateCounters.$inferInsert;
export type Signatory = typeof signatories.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectLabel = typeof projectLabels.$inferSelect;
export type NewProjectLabel = typeof projectLabels.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectComment = typeof projectComments.$inferSelect;
export type NewProjectComment = typeof projectComments.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type ProjectActivityLog = typeof projectActivityLog.$inferSelect;
export type NewProjectActivityLog = typeof projectActivityLog.$inferInsert;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type NewProjectMilestone = typeof projectMilestones.$inferInsert;
export type ProjectNote = typeof projectNotes.$inferSelect;
export type NewProjectNote = typeof projectNotes.$inferInsert;
export type ProjectSpeaker = typeof projectSpeakers.$inferSelect;
export type NewProjectSpeaker = typeof projectSpeakers.$inferInsert;
export type ProjectBudgetItem = typeof projectBudgetItems.$inferSelect;
export type NewProjectBudgetItem = typeof projectBudgetItems.$inferInsert;
export type ProjectExpense = typeof projectExpenses.$inferSelect;
export type NewProjectExpense = typeof projectExpenses.$inferInsert;
export type ProjectTimesheet = typeof projectTimesheets.$inferSelect;
export type NewProjectTimesheet = typeof projectTimesheets.$inferInsert;
export type NewSignatory = typeof signatories.$inferInsert;
export type EventSignatory = typeof eventSignatories.$inferSelect;
export type NewEventSignatory = typeof eventSignatories.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Pengawas = typeof pengawas.$inferSelect;
export type NewPengawas = typeof pengawas.$inferInsert;
export type MateriUjian = typeof materiUjian.$inferSelect;
export type NewMateriUjian = typeof materiUjian.$inferInsert;
export type KelasUjian = typeof kelasUjian.$inferSelect;
export type NewKelasUjian = typeof kelasUjian.$inferInsert;
export type JadwalUjian = typeof jadwalUjian.$inferSelect;
export type NewJadwalUjian = typeof jadwalUjian.$inferInsert;
export type PenugasanPengawas = typeof penugasanPengawas.$inferSelect;
export type NewPenugasanPengawas = typeof penugasanPengawas.$inferInsert;
export type JadwalUjianConfig = typeof jadwalUjianConfig.$inferSelect;
export type NewJadwalUjianConfig = typeof jadwalUjianConfig.$inferInsert;
export type AdminJaga = typeof adminJaga.$inferSelect;
export type NewAdminJaga = typeof adminJaga.$inferInsert;
export type JadwalAdminJaga = typeof jadwalAdminJaga.$inferSelect;
export type NewJadwalAdminJaga = typeof jadwalAdminJaga.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type NewAnnouncementRead = typeof announcementReads.$inferInsert;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type NewUserInvitation = typeof userInvitations.$inferInsert;

// ─── PENOMORAN SERTIFIKAT (Certificate Hub) ──────────────────────────────────
// Sub-modul terpisah dari modul sertifikat kegiatan/event.
// Fokus: penomoran batch formal (Brevet AB, Brevet C, BFA, dll.)
// dengan sistem serial counter global yang berkesinambungan antar batch.

export const certificatePrograms = pgTable("certificate_programs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 200 }).notNull().unique(),
  code: varchar("code", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateClassTypes = pgTable("certificate_class_types", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 2 }).notNull().unique(), // "01", "02", "03"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Singleton config — hanya 1 baris: { key: 'last_serial_number', value: '0' }
export const certificateSerialConfig = pgTable("certificate_serial_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateBatchStatusEnum = pgEnum("certificate_batch_status", [
  "active",
  "revised",
  "cancelled",
]);

export const certificateBatches = pgTable(
  "certificate_batches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    programId: text("program_id")
      .notNull()
      .references(() => certificatePrograms.id),
    classTypeId: text("class_type_id")
      .notNull()
      .references(() => certificateClassTypes.id),
    kelasId: text("kelas_id").references(() => kelasPelatihan.id),
    angkatan: integer("angkatan").notNull(), // contoh: 223
    quantityRequested: integer("quantity_requested").notNull(),
    firstCertificateNumber: varchar("first_certificate_number", {
      length: 50,
    }).notNull(),
    lastCertificateNumber: varchar("last_certificate_number", {
      length: 50,
    }).notNull(),
    status: certificateBatchStatusEnum("status").default("active").notNull(),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("cert_batches_program_idx").on(t.programId),
    index("cert_batches_angkatan_idx").on(t.angkatan),
    index("cert_batches_status_idx").on(t.status),
  ],
);

export const certificateItemStatusEnum = pgEnum("certificate_item_status", [
  "active",
  "cancelled",
]);

export const certificateItems = pgTable(
  "certificate_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => certificateBatches.id, { onDelete: "cascade" }),
    fullNumber: varchar("full_number", { length: 50 }).notNull().unique(), // "22301.3386"
    angkatan: integer("angkatan").notNull(),
    classTypeCode: varchar("class_type_code", { length: 2 }).notNull(),
    serialNumber: integer("serial_number").notNull(),
    status: certificateItemStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("cert_items_batch_idx").on(t.batchId),
    index("cert_items_serial_idx").on(t.serialNumber),
    index("cert_items_status_idx").on(t.status),
  ],
);

// ─── JADWAL OTOMATIS BREVET ──────────────────────────────────────────────────

// Enum untuk status sesi kelas (Phase 3)
export const classSessionStatusEnum = pgEnum("class_session_status", [
  "scheduled",
  "cancelled",
  "makeup",
  "completed",
]);

export const programs = pgTable("programs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  financeContactName: varchar("finance_contact_name", { length: 200 }),
  financeWhatsappNumber: varchar("finance_whatsapp_number", { length: 30 }),
  totalSessions: integer("total_sessions").notNull(),
  totalMeetings: integer("total_meetings").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tipe kelas yang tersedia: weekend_pagi, weekend_siang, weekday_selasa_kamis, weekday_senin_rabu_jumat
export const classTypes = pgTable("class_types", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: varchar("code", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  activeDays: varchar("active_days", { length: 100 }).notNull(), // "Sat,Sun" | "Tue,Thu" | "Mon,Wed,Fri"
  slot1Start: varchar("slot1_start", { length: 5 }).notNull(),
  slot1End: varchar("slot1_end", { length: 5 }).notNull(),
  slot2Start: varchar("slot2_start", { length: 5 }).notNull(),
  slot2End: varchar("slot2_end", { length: 5 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Template kurikulum per program (seed data)
export const curriculumTemplate = pgTable(
  "curriculum_template",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    sessionNumber: integer("session_number").notNull(),
    materiBlock: varchar("materi_block", { length: 100 }).notNull(),
    materiName: varchar("materi_name", { length: 200 }).notNull(),
    slot: integer("slot").notNull(), // 1 atau 2
  },
  (t) => [index("ct_program_session").on(t.programId, t.sessionNumber)],
);

// Definisi titik ujian per program
export const curriculumExamPoints = pgTable(
  "curriculum_exam_points",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    afterSessionNumber: integer("after_session_number").notNull(),
    isMixedDay: boolean("is_mixed_day").default(false).notNull(),
    examSlotCount: integer("exam_slot_count").notNull(), // 1 atau 2
    examSubjects: text("exam_subjects").array().notNull(),
    hasExam: boolean("has_exam").default(true).notNull(),
  },
  (t) => [index("cep_program_session").on(t.programId, t.afterSessionNumber)],
);

// Libur nasional
export const nationalHolidays = pgTable(
  "national_holidays",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    date: date("date").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    year: integer("year").notNull(),
  },
  (t) => [
    uniqueIndex("uniq_holiday_date").on(t.date),
    index("holiday_year_idx").on(t.year),
  ],
);

// Kelas pelatihan (bukan kelas ujian dari jadwal_ujian module)
export const kelasPelatihan = pgTable("kelas_pelatihan", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  namaKelas: varchar("nama_kelas", { length: 200 }).notNull(),
  programId: text("program_id")
    .notNull()
    .references(() => programs.id),
  classTypeId: text("class_type_id")
    .notNull()
    .references(() => classTypes.id),
  mode: varchar("mode", { length: 10 }).notNull().default("offline"), // offline | online
  angkatan: integer("angkatan"),
  certificateClassCode: varchar("certificate_class_code", { length: 2 }),
  source: varchar("source", { length: 20 }).default("system").notNull(),
  certificateNotes: text("certificate_notes"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  lokasi: varchar("lokasi", { length: 300 }),
  financeContactNameOverride: varchar("finance_contact_name_override", {
    length: 200,
  }),
  financeWhatsappNumberOverride: varchar("finance_whatsapp_number_override", {
    length: 30,
  }),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active | completed | cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tanggal eksklusi per kelas
export const classExcludedDates = pgTable(
  "class_excluded_dates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => kelasPelatihan.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 200 }),
  },
  (t) => [uniqueIndex("uniq_kelas_excluded_date").on(t.kelasId, t.date)],
);

// Sesi kelas yang di-generate
export const classSessions = pgTable(
  "class_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => kelasPelatihan.id, { onDelete: "cascade" }),
    sessionNumber: integer("session_number"), // null untuk hari ujian
    isExamDay: boolean("is_exam_day").default(false).notNull(),
    examSubjects: text("exam_subjects").array(),
    scheduledDate: date("scheduled_date").notNull(),
    timeSlotStart: varchar("time_slot_start", { length: 5 }).notNull(),
    timeSlotEnd: varchar("time_slot_end", { length: 5 }).notNull(),
    materiName: varchar("materi_name", { length: 200 }),
    status: classSessionStatusEnum("status").default("scheduled").notNull(),
    // Phase 3: Force Majeure fields
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => users.id),
    cancellationReason: varchar("cancellation_reason", { length: 300 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("cs_kelas_date").on(t.kelasId, t.scheduledDate),
    index("cs_status_idx").on(t.status),
  ],
);

// Sesi makeup (pengganti) - Phase 3
export const makeupSessions = pgTable(
  "makeup_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    originalSessionId: text("original_session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => kelasPelatihan.id, { onDelete: "cascade" }),
    // Data dari sesi asli (untuk referensi)
    sessionNumber: integer("session_number"),
    isExamDay: boolean("is_exam_day").default(false).notNull(),
    examSubjects: text("exam_subjects").array(),
    materiName: varchar("materi_name", { length: 200 }),
    // Tanggal dan waktu makeup
    scheduledDate: date("scheduled_date").notNull(),
    timeSlotStart: varchar("time_slot_start", { length: 5 }).notNull(),
    timeSlotEnd: varchar("time_slot_end", { length: 5 }).notNull(),
    status: classSessionStatusEnum("status").default("scheduled").notNull(),
    // Tracking
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("ms_kelas_date").on(t.kelasId, t.scheduledDate),
    index("ms_original_session").on(t.originalSessionId),
    index("ms_status_idx").on(t.status),
  ],
);

// ─── INSTRUKTUR (Phase 2) ─────────────────────────────────────────────────────

export const instructors = pgTable("instructors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 150 }),
  phone: varchar("phone", { length: 30 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Keahlian per instruktur (many-to-many)
export const instructorExpertise = pgTable(
  "instructor_expertise",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => instructors.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    materiBlock: varchar("materi_block", { length: 100 }).notNull(),
    level: varchar("level", { length: 20 }).default("middle").notNull(),
  },
  (t) => [
    uniqueIndex("uniq_instructor_expertise").on(
      t.instructorId,
      t.programId,
      t.materiBlock,
    ),
    index("ie_program_block").on(t.programId, t.materiBlock),
  ],
);

// Ketidaktersediaan instruktur
export const instructorUnavailability = pgTable(
  "instructor_unavailability",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => instructors.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 200 }),
  },
  (t) => [
    uniqueIndex("uniq_instructor_unavail").on(t.instructorId, t.date),
    index("iu_date_idx").on(t.date),
  ],
);

// Assignment instruktur per sesi
export const sessionAssignments = pgTable(
  "session_assignments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    plannedInstructorId: text("planned_instructor_id")
      .notNull()
      .references(() => instructors.id),
    actualInstructorId: text("actual_instructor_id").references(
      () => instructors.id,
    ),
    substitutionReason: varchar("substitution_reason", { length: 300 }),
    availabilityStatus: varchar("availability_status", { length: 30 })
      .default("pending_wa_confirmation")
      .notNull(),
    availabilityCheckedAt: timestamp("availability_checked_at"),
    availabilityNote: varchar("availability_note", { length: 300 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_session_instructor").on(
      t.sessionId,
      t.plannedInstructorId,
    ),
    index("sa_instructor_idx").on(t.plannedInstructorId),
    index("sa_actual_instructor_idx").on(t.actualInstructorId),
  ],
);

// Rate honorarium instruktur per program & materi block (Phase 4)
export const instructorRates = pgTable(
  "instructor_rates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => instructors.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    materiBlock: varchar("materi_block", { length: 100 }).notNull(),
    mode: varchar("mode", { length: 10 }).notNull().default("offline"), // offline | online
    rateAmount: numeric("rate_amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_instructor_rate").on(
      t.instructorId,
      t.programId,
      t.materiBlock,
      t.mode,
    ),
    index("ir_instructor_idx").on(t.instructorId),
    index("ir_program_idx").on(t.programId),
  ],
);

// Master tarif honorarium standar (program + level + mode + periode berlaku)
export const honorariumRateRules = pgTable(
  "honorarium_rate_rules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 20 }).notNull(), // basic | middle | senior
    mode: varchar("mode", { length: 10 }).notNull(), // online | offline
    honorPerSession: numeric("honor_per_session", {
      precision: 12,
      scale: 2,
    }).notNull(),
    transportAmount: numeric("transport_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    locationScope: varchar("location_scope", { length: 200 })
      .default("")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: varchar("notes", { length: 300 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_honorarium_rate_rule").on(
      t.programId,
      t.level,
      t.mode,
      t.effectiveFrom,
      t.locationScope,
    ),
    index("hrr_program_idx").on(t.programId),
    index("hrr_effective_idx").on(t.effectiveFrom, t.effectiveTo),
    index("hrr_active_idx").on(t.isActive),
  ],
);

// Batch honorarium internal (workflow operasional -> supervisor -> keuangan)
export const honorariumBatches = pgTable(
  "honorarium_batches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentNumber: varchar("document_number", { length: 80 })
      .notNull()
      .unique(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: varchar("status", { length: 40 }).default("draft").notNull(),
    generatedBy: text("generated_by").references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),
    paidBy: text("paid_by").references(() => users.id),
    submittedAt: timestamp("submitted_at"),
    approvedAt: timestamp("approved_at"),
    paidAt: timestamp("paid_at"),
    lockedAt: timestamp("locked_at"),
    internalNotes: text("internal_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("hb_period_idx").on(t.periodStart, t.periodEnd),
    index("hb_status_idx").on(t.status),
  ],
);

// Detail honorarium per sesi (snapshot immutable per batch)
export const honorariumItems = pgTable(
  "honorarium_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => honorariumBatches.id, { onDelete: "cascade" }),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => sessionAssignments.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => classSessions.id),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => kelasPelatihan.id),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id),
    scheduledDate: date("scheduled_date").notNull(),
    paidInstructorId: text("paid_instructor_id")
      .notNull()
      .references(() => instructors.id),
    paidInstructorName: varchar("paid_instructor_name", {
      length: 200,
    }).notNull(),
    source: varchar("source", { length: 20 }).notNull(), // planned | actual
    materiBlock: varchar("materi_block", { length: 100 }).notNull(),
    expertiseLevelSnapshot: varchar("expertise_level_snapshot", { length: 20 })
      .default("middle")
      .notNull(),
    rateSnapshot: numeric("rate_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_honorarium_assignment_once").on(t.assignmentId),
    uniqueIndex("uniq_honorarium_batch_assignment").on(
      t.batchId,
      t.assignmentId,
    ),
    index("hi_batch_idx").on(t.batchId),
    index("hi_instructor_idx").on(t.paidInstructorId),
    index("hi_date_idx").on(t.scheduledDate),
  ],
);

// Potongan/pajak per instruktur dalam batch honorarium
export const honorariumDeductions = pgTable(
  "honorarium_deductions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => honorariumBatches.id, { onDelete: "cascade" }),
    instructorId: text("instructor_id")
      .notNull()
      .references(() => instructors.id),
    deductionType: varchar("deduction_type", { length: 40 }).notNull(), // pph21, pph23, other
    description: varchar("description", { length: 200 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("hd_batch_idx").on(t.batchId),
    index("hd_instructor_idx").on(t.instructorId),
  ],
);

// Audit log perubahan honorarium
export const honorariumAuditLogs = pgTable(
  "honorarium_audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => honorariumBatches.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id),
    action: varchar("action", { length: 60 }).notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("hal_batch_idx").on(t.batchId),
    index("hal_action_idx").on(t.action),
  ],
);

// Bukti pembayaran transfer per batch honorarium
export const honorariumPaymentProofs = pgTable(
  "honorarium_payment_proofs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => honorariumBatches.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileUrl: varchar("file_url", { length: 1000 }).notNull(),
    storageKey: varchar("storage_key", { length: 1000 }),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (t) => [
    index("hpp_batch_idx").on(t.batchId),
    index("hpp_uploaded_at_idx").on(t.uploadedAt),
  ],
);

// Template pesan WhatsApp operasional (jadwal/honorarium)
export const whatsappMessageTemplates = pgTable(
  "whatsapp_message_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateKey: varchar("template_key", { length: 80 }).notNull().unique(),
    templateName: varchar("template_name", { length: 200 }).notNull(),
    description: varchar("description", { length: 300 }),
    content: text("content").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("wmt_active_idx").on(t.isActive)],
);

// Riwayat draft/kirim pesan WhatsApp per kelas
export const whatsappMessageLogs = pgTable(
  "whatsapp_message_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => kelasPelatihan.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => classSessions.id, {
      onDelete: "set null",
    }),
    assignmentId: text("assignment_id").references(() => sessionAssignments.id, {
      onDelete: "set null",
    }),
    templateKey: varchar("template_key", { length: 80 }).notNull(),
    recipientRole: varchar("recipient_role", { length: 40 }).notNull(), // instructor | finance
    recipientName: varchar("recipient_name", { length: 200 }),
    recipientWhatsappNumber: varchar("recipient_whatsapp_number", { length: 30 }),
    messageContent: text("message_content").notNull(),
    metadata: jsonb("metadata"),
    sentBy: text("sent_by").references(() => users.id),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (t) => [
    index("wml_kelas_sent_idx").on(t.kelasId, t.sentAt),
    index("wml_template_idx").on(t.templateKey),
    index("wml_role_idx").on(t.recipientRole),
  ],
);

// ─── TABEL PESERTA KELAS (Peserta & Nilai — Program Pelatihan) ──────────────

// 1. Enrollment peserta per kelas pelatihan + cached status
export const pesertaKelas = pgTable(
  "peserta_kelas",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => kelasPelatihan.id, { onDelete: "cascade" }),
    nama: varchar("nama", { length: 200 }).notNull(),
    nomorPeserta: varchar("nomor_peserta", { length: 50 }),
    email: varchar("email", { length: 150 }),
    telepon: varchar("telepon", { length: 30 }),
    catatan: text("catatan"),
    statusEnrollment: varchar("status_enrollment", { length: 20 })
      .default("aktif")
      .notNull(),
    statusAkhir: varchar("status_akhir", { length: 30 }),
    alasanStatus: varchar("alasan_status", { length: 50 }),
    statusComputedAt: timestamp("status_computed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("pk_kelas_idx").on(t.kelasId),
    index("pk_status_akhir_idx").on(t.statusAkhir),
  ],
);

// 2. Absensi kehadiran pelatihan per sesi per peserta
export const absensiPelatihan = pgTable(
  "absensi_pelatihan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    hadir: boolean("hadir").notNull(),
    catatan: text("catatan"),
    inputBy: text("input_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_absensi_peserta_session").on(t.pesertaId, t.sessionId),
    index("absensi_pelatihan_peserta_idx").on(t.pesertaId),
  ],
);

// 3. Absensi kehadiran ujian per jadwal ujian per peserta
export const absensiUjian = pgTable(
  "absensi_ujian",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    jadwalUjianId: text("jadwal_ujian_id")
      .notNull()
      .references(() => jadwalUjian.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("hadir"),
    catatan: text("catatan"),
    inputBy: text("input_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_absensi_ujian_peserta").on(t.pesertaId, t.jadwalUjianId),
    index("absensi_ujian_peserta_idx").on(t.pesertaId),
  ],
);

// 4. Nilai ujian per mata pelajaran per peserta
export const nilaiUjian = pgTable(
  "nilai_ujian",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    jadwalUjianId: text("jadwal_ujian_id")
      .notNull()
      .references(() => jadwalUjian.id, { onDelete: "cascade" }),
    mataPelajaran: varchar("mata_pelajaran", { length: 100 }).notNull(),
    nilai: varchar("nilai", { length: 2 }).notNull(),
    isPerbaikan: boolean("is_perbaikan").default(false).notNull(),
    perbaikanDariId: text("perbaikan_dari_id"),
    inputBy: text("input_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_nilai_peserta_ujian_mapel").on(
      t.pesertaId,
      t.jadwalUjianId,
      t.mataPelajaran,
      t.isPerbaikan,
    ),
    index("nilai_ujian_peserta_idx").on(t.pesertaId),
    index("nilai_ujian_jadwal_idx").on(t.jadwalUjianId),
  ],
);

// 5. Ujian susulan peserta
export const ujianSusulanPeserta = pgTable(
  "ujian_susulan_peserta",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    jadwalUjianOriginalId: text("jadwal_ujian_original_id")
      .notNull()
      .references(() => jadwalUjian.id),
    tanggalUsulan: date("tanggal_usulan"),
    tanggalDisepakati: date("tanggal_disepakati"),
    jamMulai: varchar("jam_mulai", { length: 5 }),
    jamSelesai: varchar("jam_selesai", { length: 5 }),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    alasanPermohonan: text("alasan_permohonan"),
    catatanAdmin: text("catatan_admin"),
    approvedBy: text("approved_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("usp_peserta_idx").on(t.pesertaId),
    index("usp_original_jadwal_idx").on(t.jadwalUjianOriginalId),
    index("usp_status_idx").on(t.status),
  ],
);

// ─── TYPE EXPORTS (Peserta & Nilai) ──────────────────────────────────────────

export type PesertaKelas = typeof pesertaKelas.$inferSelect;
export type NewPesertaKelas = typeof pesertaKelas.$inferInsert;
export type AbsensiPelatihan = typeof absensiPelatihan.$inferSelect;
export type NewAbsensiPelatihan = typeof absensiPelatihan.$inferInsert;
export type AbsensiUjian = typeof absensiUjian.$inferSelect;
export type NewAbsensiUjian = typeof absensiUjian.$inferInsert;
export type NilaiUjian = typeof nilaiUjian.$inferSelect;
export type NewNilaiUjian = typeof nilaiUjian.$inferInsert;
export type UjianSusulanPeserta = typeof ujianSusulanPeserta.$inferSelect;
export type NewUjianSusulanPeserta = typeof ujianSusulanPeserta.$inferInsert;

// ─── TYPE EXPORTS (Jadwal Otomatis Brevet) ────────────────────────────────────

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type ClassType = typeof classTypes.$inferSelect;
export type NewClassType = typeof classTypes.$inferInsert;
export type CurriculumTemplate = typeof curriculumTemplate.$inferSelect;
export type NewCurriculumTemplate = typeof curriculumTemplate.$inferInsert;
export type CurriculumExamPoint = typeof curriculumExamPoints.$inferSelect;
export type NewCurriculumExamPoint = typeof curriculumExamPoints.$inferInsert;
export type NationalHoliday = typeof nationalHolidays.$inferSelect;
export type NewNationalHoliday = typeof nationalHolidays.$inferInsert;
export type KelasPelatihan = typeof kelasPelatihan.$inferSelect;
export type NewKelasPelatihan = typeof kelasPelatihan.$inferInsert;
export type ClassExcludedDate = typeof classExcludedDates.$inferSelect;
export type NewClassExcludedDate = typeof classExcludedDates.$inferInsert;
export type ClassSession = typeof classSessions.$inferSelect;
export type NewClassSession = typeof classSessions.$inferInsert;
export type MakeupSession = typeof makeupSessions.$inferSelect;
export type NewMakeupSession = typeof makeupSessions.$inferInsert;
export type Instructor = typeof instructors.$inferSelect;
export type NewInstructor = typeof instructors.$inferInsert;
export type InstructorExpertise = typeof instructorExpertise.$inferSelect;
export type NewInstructorExpertise = typeof instructorExpertise.$inferInsert;
export type InstructorUnavailability =
  typeof instructorUnavailability.$inferSelect;
export type NewInstructorUnavailability =
  typeof instructorUnavailability.$inferInsert;
export type SessionAssignment = typeof sessionAssignments.$inferSelect;
export type NewSessionAssignment = typeof sessionAssignments.$inferInsert;
export type InstructorRate = typeof instructorRates.$inferSelect;
export type NewInstructorRate = typeof instructorRates.$inferInsert;
export type HonorariumRateRule = typeof honorariumRateRules.$inferSelect;
export type NewHonorariumRateRule = typeof honorariumRateRules.$inferInsert;
export type HonorariumBatch = typeof honorariumBatches.$inferSelect;
export type NewHonorariumBatch = typeof honorariumBatches.$inferInsert;
export type HonorariumItem = typeof honorariumItems.$inferSelect;
export type NewHonorariumItem = typeof honorariumItems.$inferInsert;
export type HonorariumDeduction = typeof honorariumDeductions.$inferSelect;
export type NewHonorariumDeduction = typeof honorariumDeductions.$inferInsert;
export type HonorariumAuditLog = typeof honorariumAuditLogs.$inferSelect;
export type NewHonorariumAuditLog = typeof honorariumAuditLogs.$inferInsert;
export type WhatsappMessageTemplate = typeof whatsappMessageTemplates.$inferSelect;
export type NewWhatsappMessageTemplate = typeof whatsappMessageTemplates.$inferInsert;
export type WhatsappMessageLog = typeof whatsappMessageLogs.$inferSelect;
export type NewWhatsappMessageLog = typeof whatsappMessageLogs.$inferInsert;

// ─── DINGTALK INTEGRATION ────────────────────────────────────────────────────

export const statusAbsensiEnum = pgEnum("status_absensi", [
  "hadir",
  "terlambat",
  "alpha",
  "cuti",
  "dinas_luar",
  "izin",
  "sakit",
]);

export const sumberAbsensiEnum = pgEnum("sumber_absensi", ["dingtalk", "manual"]);

export const jenisCutiEnum = pgEnum("jenis_cuti", [
  "tahunan",
  "kompensasi",
  "sakit",
  "melahirkan",
  "menikah",
  "kematian",
  "lainnya",
]);

export const statusCutiEnum = pgEnum("status_cuti", [
  "draft",
  "diajukan",
  "disetujui",
  "ditolak",
  "dibatalkan",
]);

export const statusDingtalkSyncEnum = pgEnum("status_dingtalk_sync", [
  "success",
  "partial",
  "failed",
]);

export const absensiKaryawan = pgTable(
  "absensi_karyawan",
  {
    id: text("id").primaryKey(),
    // nullable — null berarti user belum punya akun ARKA (hanya DingTalk)
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    // diisi saat userId null (user DingTalk tanpa akun ARKA)
    dingtalkUserId: text("dingtalk_user_id"),
    dingtalkNama: varchar("dingtalk_nama", { length: 200 }),
    tanggal: date("tanggal").notNull(),
    jamMasuk: timestamp("jam_masuk", { withTimezone: true }),
    jamPulang: timestamp("jam_pulang", { withTimezone: true }),
    status: statusAbsensiEnum("status").notNull().default("hadir"),
    keterlambatanMenit: integer("keterlambatan_menit").default(0),
    sumber: sumberAbsensiEnum("sumber").notNull().default("dingtalk"),
    dingtalkRecordId: text("dingtalk_record_id"),
    catatan: text("catatan"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Partial unique index: untuk record yang ter-link ke ARKA user
    uniqArkaAbsensi: uniqueIndex("uniq_absensi_arka_user")
      .on(t.userId, t.tanggal, t.sumber)
      .where(sql`user_id IS NOT NULL`),
    // Partial unique index: untuk record DingTalk-only (belum ada akun ARKA)
    uniqDtkAbsensi: uniqueIndex("uniq_absensi_dtk_user")
      .on(t.dingtalkUserId, t.tanggal, t.sumber)
      .where(sql`user_id IS NULL`),
    idxTanggal: index("idx_absensi_tanggal").on(t.tanggal),
    idxUserId: index("idx_absensi_user_id").on(t.userId),
    idxDtkUserId: index("idx_absensi_dtk_user_id").on(t.dingtalkUserId),
  }),
);

export const pengajuanCuti = pgTable(
  "pengajuan_cuti",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jenisCuti: jenisCutiEnum("jenis_cuti").notNull(),
    tanggalMulai: date("tanggal_mulai").notNull(),
    tanggalSelesai: date("tanggal_selesai").notNull(),
    jumlahHari: integer("jumlah_hari").notNull(),
    alasan: text("alasan"),
    status: statusCutiEnum("status").notNull().default("draft"),
    approvalCode: varchar("approval_code", { length: 20 }),
    dingtalkProcessId: text("dingtalk_process_id"),
    dingtalkFormCode: text("dingtalk_form_code"),
    approvedBy: text("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
    lampiranUrl: text("lampiran_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxCutiUserId: index("idx_cuti_user_id").on(t.userId),
    idxCutiStatus: index("idx_cuti_status").on(t.status),
    idxCutiTanggal: index("idx_cuti_tanggal").on(t.tanggalMulai, t.tanggalSelesai),
  }),
);

export const dingtalkConfig = pgTable("dingtalk_config", {
  id: serial("id").primaryKey(),
  appKey: text("app_key").notNull(),
  appSecret: text("app_secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  syncIntervalMenit: integer("sync_interval_menit").notNull().default(60),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: statusDingtalkSyncEnum("last_sync_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── SALDO CUTI KARYAWAN ──────────────────────────────────────────────────────

export const saldoCutiTahunan = pgTable(
  "saldo_cuti_tahunan",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tahun: integer("tahun").notNull(),
    kuotaAwal: integer("kuota_awal").notNull().default(12),
    cutiTerpakai: integer("cuti_terpakai").notNull().default(0),
    cutiBersamaTerpakai: integer("cuti_bersama_terpakai").notNull().default(0),
    sisaCuti: integer("sisa_cuti").notNull().default(12),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqUserTahun: uniqueIndex("uniq_saldo_cuti_user_tahun").on(t.userId, t.tahun),
    idxSaldoCutiTahun: index("idx_saldo_cuti_tahun").on(t.tahun),
  }),
);

export const saldoCutiKompensasi = pgTable(
  "saldo_cuti_kompensasi",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tahun: integer("tahun").notNull(),
    kuota: integer("kuota").notNull().default(2),
    terpakai: integer("terpakai").notNull().default(0),
    sisa: integer("sisa").notNull().default(2),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqUserTahun: uniqueIndex("uniq_cuti_kompensasi_user_tahun").on(t.userId, t.tahun),
  }),
);

export const cutiBersama = pgTable(
  "cuti_bersama",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    tanggal: date("tanggal").notNull(),
    keterangan: varchar("keterangan", { length: 200 }).notNull(),
    memotongSaldo: boolean("memotong_saldo").notNull().default(true),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqTanggal: uniqueIndex("uniq_cuti_bersama_tanggal").on(t.tanggal),
    idxCutiBersamaTahun: index("idx_cuti_bersama_tahun").on(t.tahun),
  }),
);

export const konfigurasiCuti = pgTable(
  "konfigurasi_cuti",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    kuotaCutiTahunan: integer("kuota_cuti_tahunan").notNull().default(12),
    kuotaCutiKompensasi: integer("kuota_cuti_kompensasi").notNull().default(2),
    maksimalPotongCutiBersama: integer("maksimal_potong_cuti_bersama").notNull().default(2),
    updatedBy: text("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqTahun: uniqueIndex("uniq_konfigurasi_cuti_tahun").on(t.tahun),
  }),
);

// ─── PENILAIAN KINERJA KARYAWAN ───────────────────────────────────────────────

export const statusPenilaianEnum = pgEnum("status_penilaian", [
  "draft",
  "submitted",
  "reviewed",
  "finalized",
]);

export const tipePenilaianTemplateEnum = pgEnum("tipe_penilaian_template", [
  "tugas",
  "perilaku",
]);

export const statusPeriodePenilaianEnum = pgEnum("status_periode_penilaian", [
  "open",
  "closed",
]);

export const penilaianPeriode = pgTable("penilaian_periode", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 100 }).notNull(),
  tahun: integer("tahun").notNull(),
  kuartal: integer("kuartal").notNull(), // 1-4
  tanggalMulai: date("tanggal_mulai").notNull(),
  tanggalSelesai: date("tanggal_selesai").notNull(),
  status: statusPeriodePenilaianEnum("status").notNull().default("open"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const penilaianTemplate = pgTable(
  "penilaian_template",
  {
    id: serial("id").primaryKey(),
    nama: varchar("nama", { length: 200 }).notNull(),
    tipe: tipePenilaianTemplateEnum("tipe").notNull(),
    divisiId: integer("divisi_id").references(() => divisi.id),
    jabatan: varchar("jabatan", { length: 150 }),
    isDefault: boolean("is_default").default(false).notNull(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxTemplateTipe: index("idx_penilaian_template_tipe").on(t.tipe),
    idxTemplateDivisi: index("idx_penilaian_template_divisi").on(t.divisiId),
  }),
);

export const penilaianTemplateItem = pgTable(
  "penilaian_template_item",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id")
      .notNull()
      .references(() => penilaianTemplate.id, { onDelete: "cascade" }),
    nomor: integer("nomor").notNull(),
    keterangan: text("keterangan").notNull(),
    bobot: numeric("bobot", { precision: 4, scale: 3 }).notNull(), // e.g. 0.100
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxItemTemplate: index("idx_penilaian_template_item_template").on(
      t.templateId,
    ),
  }),
);

export const penilaianKinerja = pgTable(
  "penilaian_kinerja",
  {
    id: text("id").primaryKey(), // uuid
    periodeId: integer("periode_id")
      .notNull()
      .references(() => penilaianPeriode.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    penilaiId: text("penilai_id")
      .notNull()
      .references(() => users.id),
    templateTugasId: integer("template_tugas_id").references(
      () => penilaianTemplate.id,
    ),
    templatePerilakuId: integer("template_perilaku_id").references(
      () => penilaianTemplate.id,
    ),
    totalNilaiTugas: numeric("total_nilai_tugas", { precision: 5, scale: 2 }),
    totalNilaiPerilaku: numeric("total_nilai_perilaku", {
      precision: 5,
      scale: 2,
    }),
    nilaiAkhir: numeric("nilai_akhir", { precision: 5, scale: 2 }),
    status: statusPenilaianEnum("status").notNull().default("draft"),
    catatan: text("catatan"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxPenilaianPeriode: index("idx_penilaian_kinerja_periode").on(t.periodeId),
    idxPenilaianUser: index("idx_penilaian_kinerja_user").on(t.userId),
    idxPenilaianStatus: index("idx_penilaian_kinerja_status").on(t.status),
    uniqPenilaianPerUser: uniqueIndex("uniq_penilaian_per_user_periode").on(
      t.userId,
      t.periodeId,
    ),
  }),
);

export const penilaianKinerjaDetail = pgTable(
  "penilaian_kinerja_detail",
  {
    id: serial("id").primaryKey(),
    penilaianId: text("penilaian_id")
      .notNull()
      .references(() => penilaianKinerja.id, { onDelete: "cascade" }),
    templateItemId: integer("template_item_id")
      .notNull()
      .references(() => penilaianTemplateItem.id),
    tipe: tipePenilaianTemplateEnum("tipe").notNull(),
    nilai: integer("nilai").notNull().default(0), // 0-100
    bobot: numeric("bobot", { precision: 4, scale: 3 }).notNull(), // snapshot bobot
    nilaiTerbobot: numeric("nilai_terbobot", { precision: 5, scale: 2 }).notNull(),
    keterangan: text("keterangan"),
  },
  (t) => ({
    idxDetailPenilaian: index("idx_penilaian_detail_penilaian").on(
      t.penilaianId,
    ),
    idxDetailTipe: index("idx_penilaian_detail_tipe").on(t.tipe),
  }),
);

// ─── TYPE EXPORTS (Penilaian Kinerja) ────────────────────────────────────────

export type PenilaianPeriode = typeof penilaianPeriode.$inferSelect;
export type NewPenilaianPeriode = typeof penilaianPeriode.$inferInsert;
export type PenilaianTemplate = typeof penilaianTemplate.$inferSelect;
export type NewPenilaianTemplate = typeof penilaianTemplate.$inferInsert;
export type PenilaianTemplateItem = typeof penilaianTemplateItem.$inferSelect;
export type NewPenilaianTemplateItem = typeof penilaianTemplateItem.$inferInsert;
export type PenilaianKinerja = typeof penilaianKinerja.$inferSelect;
export type NewPenilaianKinerja = typeof penilaianKinerja.$inferInsert;
export type PenilaianKinerjaDetail = typeof penilaianKinerjaDetail.$inferSelect;
export type NewPenilaianKinerjaDetail = typeof penilaianKinerjaDetail.$inferInsert;

// ─── TYPE EXPORTS (DingTalk) ──────────────────────────────────────────────────

export type AbsensiKaryawan = typeof absensiKaryawan.$inferSelect;
export type NewAbsensiKaryawan = typeof absensiKaryawan.$inferInsert;
export type PengajuanCuti = typeof pengajuanCuti.$inferSelect;
export type NewPengajuanCuti = typeof pengajuanCuti.$inferInsert;
export type DingtalkConfig = typeof dingtalkConfig.$inferSelect;
export type NewDingtalkConfig = typeof dingtalkConfig.$inferInsert;

// ─── TYPE EXPORTS (Saldo Cuti) ────────────────────────────────────────────────

export type SaldoCutiTahunan = typeof saldoCutiTahunan.$inferSelect;
export type NewSaldoCutiTahunan = typeof saldoCutiTahunan.$inferInsert;
export type SaldoCutiKompensasi = typeof saldoCutiKompensasi.$inferSelect;
export type NewSaldoCutiKompensasi = typeof saldoCutiKompensasi.$inferInsert;
export type CutiBersama = typeof cutiBersama.$inferSelect;
export type NewCutiBersama = typeof cutiBersama.$inferInsert;
export type KonfigurasiCuti = typeof konfigurasiCuti.$inferSelect;
export type NewKonfigurasiCuti = typeof konfigurasiCuti.$inferInsert;

// ─── TYPE EXPORTS (Penomoran Sertifikat) ─────────────────────────────────────

export type CertificateProgram = typeof certificatePrograms.$inferSelect;
export type NewCertificateProgram = typeof certificatePrograms.$inferInsert;
export type CertificateClassType = typeof certificateClassTypes.$inferSelect;
export type NewCertificateClassType = typeof certificateClassTypes.$inferInsert;
export type CertificateBatch = typeof certificateBatches.$inferSelect;
export type NewCertificateBatch = typeof certificateBatches.$inferInsert;
export type CertificateItem = typeof certificateItems.$inferSelect;
export type NewCertificateItem = typeof certificateItems.$inferInsert;

// ─── TYPE EXPORTS (Invoice & Kuitansi) ────────────────────────────────────────

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type KuitansiCounter = typeof kuitansiCounter.$inferSelect;
export type Kuitansi = typeof kuitansi.$inferSelect;
export type NewKuitansi = typeof kuitansi.$inferInsert;


// ─── PPL EVALUASI ENUMS ──────────────────────────────────────────────────────

export const kategoriPplEnum = pgEnum("kategori_ppl", [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan",
  "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik",
  "SAK & PSAK",
]);

export const statusPplEnum = pgEnum("status_ppl", [
  "aktif",
  "archived",
]);

// ─── PPL KEGIATAN ────────────────────────────────────────────────────────────

export const pplKegiatan = pgTable("ppl_kegiatan", {
  id: serial("id").primaryKey(),
  namaKegiatan: varchar("nama_kegiatan", { length: 255 }).notNull(),
  kategoriPpl: kategoriPplEnum("kategori_ppl").notNull(),
  tipePelaksanaan: tipePelaksanaanEnum("tipe_pelaksanaan").notNull(),
  statusEvent: statusPplEnum("status_event").default("aktif").notNull(),
  tanggalMulai: date("tanggal_mulai").notNull(),
  tanggalSelesai: date("tanggal_selesai").notNull(),
  lokasi: varchar("lokasi", { length: 255 }),
  skp: integer("skp").notNull(),
  pendaftar: integer("pendaftar").default(0).notNull(),
  realisasiHadir: integer("realisasi_hadir").default(0).notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PPL NARASUMBER ──────────────────────────────────────────────────────────

export const pplNarasumber = pgTable("ppl_narasumber", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 200 }).notNull(),
  email: varchar("email", { length: 150 }).unique().notNull(),
  noTelepon: varchar("no_telepon", { length: 30 }),
  isActive: boolean("is_active").default(true).notNull(),
  feePerSkp: integer("fee_per_skp").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pplNarasumberExpertise = pgTable("ppl_narasumber_expertise", {
  id: serial("id").primaryKey(),
  narasumberId: integer("narasumber_id")
    .notNull()
    .references(() => pplNarasumber.id, { onDelete: "cascade" }),
  kategoriPpl: kategoriPplEnum("kategori_ppl").notNull(),
  topik: jsonb("topik").$type<string[]>().default([]).notNull(),
}, (t) => ({
  narasumberIdx: index("ppl_narasumber_expertise_narasumber_idx").on(t.narasumberId),
  uniqueNarasumberKategori: uniqueIndex("ppl_narasumber_expertise_unique").on(t.narasumberId, t.kategoriPpl),
}));

// ─── PPL KEGIATAN-NARASUMBER ASSIGNMENT ──────────────────────────────────────

export const pplKegiatanNarasumber = pgTable("ppl_kegiatan_narasumber", {
  id: serial("id").primaryKey(),
  kegiatanId: integer("kegiatan_id")
    .notNull()
    .references(() => pplKegiatan.id, { onDelete: "cascade" }),
  narasumberId: integer("narasumber_id")
    .notNull()
    .references(() => pplNarasumber.id, { onDelete: "restrict" }),
  topik: varchar("topik", { length: 200 }),
  totalHonorarium: integer("total_honorarium").default(0).notNull(),
}, (t) => ({
  kegiatanIdx: index("ppl_kegiatan_narasumber_kegiatan_idx").on(t.kegiatanId),
  narasumberIdx: index("ppl_kegiatan_narasumber_narasumber_idx").on(t.narasumberId),
}));

// ─── PPL KUESIONER TEMPLATE ──────────────────────────────────────────────────

export const pplKuesionerTemplate = pgTable("ppl_kuesioner_template", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 200 }).notNull(),
  configJson: jsonb("config_json").$type<FormField[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── PPL KUESIONER LINK (kegiatan <-> template) ─────────────────────────────

export const pplKuesionerLink = pgTable("ppl_kuesioner_link", {
  id: serial("id").primaryKey(),
  kegiatanId: integer("kegiatan_id")
    .notNull()
    .references(() => pplKegiatan.id, { onDelete: "cascade" }),
  templateId: integer("template_id")
    .notNull()
    .references(() => pplKuesionerTemplate.id, { onDelete: "restrict" }),
  accessToken: varchar("access_token", { length: 64 }).unique().notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  activatedAt: timestamp("activated_at"),
  deactivatedAt: timestamp("deactivated_at"),
}, (t) => ({
  kegiatanIdx: index("ppl_kuesioner_link_kegiatan_idx").on(t.kegiatanId),
  tokenIdx: uniqueIndex("ppl_kuesioner_link_token_idx").on(t.accessToken),
}));

// ─── PPL KUESIONER RESPONSE ─────────────────────────────────────────────────

export const pplKuesionerResponse = pgTable("ppl_kuesioner_response", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id")
    .notNull()
    .references(() => pplKuesionerLink.id, { onDelete: "cascade" }),
  namaResponden: varchar("nama_responden", { length: 200 }).notNull(),
  emailResponden: varchar("email_responden", { length: 150 }).notNull(),
  answersJson: jsonb("answers_json").$type<Record<string, unknown>>().notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (t) => ({
  linkIdx: index("ppl_kuesioner_response_link_idx").on(t.linkId),
  uniqueResponden: uniqueIndex("ppl_kuesioner_response_unique_responden").on(
    t.linkId,
    sql`lower(${t.namaResponden})`,
    sql`lower(${t.emailResponden})`,
  ),
}));

// ─── TYPE EXPORTS (PPL Evaluasi) ─────────────────────────────────────────────

export type PplKegiatan = typeof pplKegiatan.$inferSelect;
export type NewPplKegiatan = typeof pplKegiatan.$inferInsert;
export type PplNarasumber = typeof pplNarasumber.$inferSelect;
export type NewPplNarasumber = typeof pplNarasumber.$inferInsert;
export type PplNarasumberExpertise = typeof pplNarasumberExpertise.$inferSelect;
export type NewPplNarasumberExpertise = typeof pplNarasumberExpertise.$inferInsert;
export type PplKegiatanNarasumber = typeof pplKegiatanNarasumber.$inferSelect;
export type NewPplKegiatanNarasumber = typeof pplKegiatanNarasumber.$inferInsert;
export type PplKuesionerTemplate = typeof pplKuesionerTemplate.$inferSelect;
export type NewPplKuesionerTemplate = typeof pplKuesionerTemplate.$inferInsert;
export type PplKuesionerLink = typeof pplKuesionerLink.$inferSelect;
export type NewPplKuesionerLink = typeof pplKuesionerLink.$inferInsert;
export type PplKuesionerResponse = typeof pplKuesionerResponse.$inferSelect;
export type NewPplKuesionerResponse = typeof pplKuesionerResponse.$inferInsert;
