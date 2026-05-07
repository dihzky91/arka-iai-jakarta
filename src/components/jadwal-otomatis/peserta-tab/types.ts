export interface Peserta {
  id: string; nama: string; nomorPeserta: string | null;
  email: string | null; telepon: string | null; catatan: string | null;
  statusEnrollment: string; statusAkhir: string | null;
  alasanStatus: string | null;
}

export interface SesiPelatihan {
  id: string; sessionNumber: number | null; scheduledDate: string;
  materiName: string | null; status: string;
}

export interface SesiUjian {
  id: string; mataPelajaran: string[] | null; tanggalUjian: string;
  jamMulai: string; jamSelesai: string;
}

export interface AbsensiRow {
  pesertaId: string; sessionId: string; hadir: boolean;
}

export interface AbsensiUjianRow {
  pesertaId: string; jadwalUjianId: string; status: string;
}

export interface NilaiRow {
  id: string; pesertaId: string; jadwalUjianId: string;
  mataPelajaran: string; nilai: string; isPerbaikan: boolean;
  perbaikanDariId: string | null;
}

export type DuplicateStrategy = "skip" | "update" | "allow";

export interface ImportPesertaRow {
  nama: string;
  nomorPeserta?: string;
  email?: string;
  telepon?: string;
  catatan?: string;
}

export interface ImportPreviewRow extends ImportPesertaRow {
  rowNumber: number;
  status: "valid" | "update" | "duplicate" | "error";
  issues: string[];
}

export interface KelasOption {
  id: string;
  namaKelas: string;
  programName: string;
  status: string;
}

export interface DeactivateDialogState {
  pesertaIds: string[];
  title: string;
  description: string;
}
