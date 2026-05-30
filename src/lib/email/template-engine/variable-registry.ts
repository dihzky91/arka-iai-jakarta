import type { VariableCategory, VariableDefinition } from "./types";

// ─── VARIABLE REGISTRY ────────────────────────────────────────────────────────

const VARIABLE_REGISTRY: VariableDefinition[] = [
  // ── Global ──
  { key: "app.name", label: "Nama aplikasi", category: "global", sampleValue: "ARKA" },
  { key: "app.url", label: "URL aplikasi", category: "global", sampleValue: "https://arka.iai-jakarta.or.id" },
  { key: "app.logo_url", label: "URL logo", category: "global", sampleValue: "https://arka.iai-jakarta.or.id/logo.png" },
  { key: "recipient.nama", label: "Nama penerima", category: "global", sampleValue: "Budi Santoso" },
  { key: "recipient.email", label: "Email penerima", category: "global", sampleValue: "budi@example.com" },
  { key: "current.date", label: "Tanggal hari ini", category: "global", sampleValue: "24 Mei 2026" },
  { key: "current.year", label: "Tahun sekarang", category: "global", sampleValue: "2026" },
  { key: "org.nama", label: "Nama organisasi", category: "global", sampleValue: "IAI Wilayah DKI Jakarta" },

  // ── Persuratan ──
  { key: "surat.perihal", label: "Perihal surat", category: "persuratan", sampleValue: "Undangan Rapat Koordinasi" },
  { key: "surat.nomor", label: "Nomor surat", category: "persuratan", sampleValue: "001/IAI-DKIJKT/SK/V/2026" },
  { key: "surat.tujuan", label: "Tujuan surat", category: "persuratan", sampleValue: "Ketua IAI Pusat" },
  { key: "surat.pengirim", label: "Nama pengirim/pembuat", category: "persuratan", sampleValue: "Ahmad Fauzi" },
  { key: "surat.tanggal", label: "Tanggal surat", category: "persuratan", sampleValue: "20 Mei 2026" },
  { key: "surat.url", label: "Link ke detail surat", category: "persuratan", sampleValue: "https://arka.iai-jakarta.or.id/surat-keluar/xxx" },
  { key: "surat.review_url", label: "Link reviu surat", category: "persuratan", sampleValue: "https://arka.iai-jakarta.or.id/surat-keluar/review/xxx" },
  { key: "pejabat.nama", label: "Nama pejabat", category: "persuratan", sampleValue: "Dr. Hendra Wijaya" },
  { key: "catatan.revisi", label: "Catatan revisi", category: "persuratan", sampleValue: "Mohon perbaiki format penomoran" },

  // ── Disposisi ──
  { key: "disposisi.dari", label: "Pengirim disposisi", category: "disposisi", sampleValue: "Ketua IAI Jakarta" },
  { key: "disposisi.instruksi", label: "Instruksi", category: "disposisi", sampleValue: "Mohon ditindaklanjuti" },
  { key: "disposisi.batas_waktu", label: "Batas waktu", category: "disposisi", sampleValue: "30 Mei 2026" },
  { key: "disposisi.sisa_hari", label: "Sisa hari deadline", category: "disposisi", sampleValue: "5" },
  { key: "disposisi.url", label: "Link inbox disposisi", category: "disposisi", sampleValue: "https://arka.iai-jakarta.or.id/disposisi" },

  // ── Akademik ──
  { key: "kelas.nama", label: "Nama kelas/pelatihan", category: "akademik", sampleValue: "Brevet Pajak AB Batch 12" },
  { key: "kelas.periode", label: "Periode kelas", category: "akademik", sampleValue: "Mei - Juli 2026" },
  { key: "instruktur.nama", label: "Nama instruktur", category: "akademik", sampleValue: "Ir. Siti Rahayu" },
  { key: "jadwal.tanggal", label: "Tanggal jadwal", category: "akademik", sampleValue: "Senin, 26 Mei 2026" },
  { key: "jadwal.waktu", label: "Waktu", category: "akademik", sampleValue: "09:00 - 12:00 WIB" },
  { key: "jadwal.ruangan", label: "Ruangan", category: "akademik", sampleValue: "Ruang 301" },
  { key: "jadwal.materi", label: "Materi", category: "akademik", sampleValue: "PPh Pasal 21" },
  { key: "evaluasi.url", label: "Link kuesioner evaluasi", category: "akademik", sampleValue: "https://arka.iai-jakarta.or.id/evaluasi/xxx" },

  // ── Keuangan ──
  { key: "honorarium.jumlah", label: "Jumlah honorarium", category: "keuangan", sampleValue: "Rp 2.400.000" },
  { key: "honorarium.periode", label: "Periode", category: "keuangan", sampleValue: "Mei 2026" },
  { key: "honorarium.status", label: "Status pembayaran", category: "keuangan", sampleValue: "Sudah Ditransfer" },
  { key: "batch.nama", label: "Nama batch", category: "keuangan", sampleValue: "Batch Mei 2026 - Brevet AB" },
  { key: "keuangan.url", label: "Link detail keuangan", category: "keuangan", sampleValue: "https://arka.iai-jakarta.or.id/keuangan/xxx" },

  // ── Auth ──
  { key: "auth.reset_url", label: "Link reset password", category: "auth", sampleValue: "https://arka.iai-jakarta.or.id/reset/xxx" },
  { key: "auth.invite_url", label: "Link aktivasi akun", category: "auth", sampleValue: "https://arka.iai-jakarta.or.id/activate/xxx" },
  { key: "auth.inviter_name", label: "Nama yang mengundang", category: "auth", sampleValue: "Admin ARKA" },
  { key: "auth.expiry", label: "Masa berlaku link", category: "auth", sampleValue: "1 jam" },

  // ── Sertifikat ──
  { key: "sertifikat.nomor", label: "Nomor sertifikat", category: "sertifikat", sampleValue: "SERT/001/IAI/2026" },
  { key: "sertifikat.program", label: "Nama program", category: "sertifikat", sampleValue: "Brevet Pajak AB" },
  { key: "sertifikat.download_url", label: "Link download", category: "sertifikat", sampleValue: "https://arka.iai-jakarta.or.id/sertifikat/xxx" },
  { key: "sertifikat.tanggal", label: "Tanggal terbit", category: "sertifikat", sampleValue: "24 Mei 2026" },

  // ── PPL ──
  { key: "ppl.kegiatan", label: "Nama kegiatan PPL", category: "ppl", sampleValue: "Workshop PSAK 73" },
  { key: "ppl.tanggal", label: "Tanggal kegiatan", category: "ppl", sampleValue: "28 Mei 2026" },
  { key: "ppl.skp", label: "Jumlah SKP", category: "ppl", sampleValue: "8 SKP" },
  { key: "ppl.lokasi", label: "Lokasi", category: "ppl", sampleValue: "Hotel Mulia, Jakarta" },
  { key: "ppl.narasumber", label: "Nama narasumber", category: "ppl", sampleValue: "Prof. Andi Kusuma" },
];

/**
 * Get all variables for a specific category (includes global).
 */
export function getVariablesByCategory(category: VariableCategory): VariableDefinition[] {
  return VARIABLE_REGISTRY.filter(
    (v) => v.category === category || v.category === "global",
  );
}

/**
 * Get all variables from the registry.
 */
export function getAllVariables(): VariableDefinition[] {
  return VARIABLE_REGISTRY;
}

/**
 * Get sample data for a given category (for preview).
 */
export function getSampleData(category: VariableCategory): Record<string, string> {
  const vars = getVariablesByCategory(category);
  const data: Record<string, string> = {};
  for (const v of vars) {
    data[v.key] = v.sampleValue;
  }
  return data;
}

/**
 * Get all sample data (all categories).
 */
export function getAllSampleData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const v of VARIABLE_REGISTRY) {
    data[v.key] = v.sampleValue;
  }
  return data;
}
