import type { ImportPesertaRow, ImportPreviewRow, DuplicateStrategy, Peserta, SesiPelatihan } from "./types";

export const MONTH_LABELS_ID = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];

export const PESERTA_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function normalizeImportKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function cleanImportCell(value: unknown) {
  return String(value ?? "").trim();
}

export function mapImportRecord(record: Record<string, unknown>): ImportPesertaRow {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [
    key.trim().toLowerCase().replace(/\s+/g, "_"),
    value,
  ]);
  const normalized = Object.fromEntries(normalizedEntries);

  return {
    nama: cleanImportCell(normalized.nama ?? normalized.nama_peserta ?? normalized.name),
    nomorPeserta: cleanImportCell(
      normalized.nomor_peserta ?? normalized.no_peserta ?? normalized.nomor ?? normalized.no,
    ),
    email: cleanImportCell(normalized.email),
    telepon: cleanImportCell(normalized.telepon ?? normalized.phone ?? normalized.hp),
    catatan: cleanImportCell(normalized.catatan ?? normalized.keterangan),
  };
}

export function parsePastedRows(text: string): ImportPesertaRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.includes("\t") ? "\t" : ",";
      const [nama, nomorPeserta, email, telepon, catatan] = line.split(separator).map((cell) => cell.trim());
      return { nama: nama ?? "", nomorPeserta, email, telepon, catatan };
    });
}

export function buildImportPreview(
  rows: ImportPesertaRow[],
  existingPeserta: Peserta[],
  duplicateStrategy: DuplicateStrategy,
): ImportPreviewRow[] {
  const existingByNomor = new Set(
    existingPeserta.map((p) => normalizeImportKey(p.nomorPeserta)).filter(Boolean),
  );
  const existingByNama = new Set(existingPeserta.map((p) => normalizeImportKey(p.nama)).filter(Boolean));
  const seen = new Set<string>();

  return rows.map((row, index) => {
    const nama = row.nama.trim();
    const nomorPeserta = row.nomorPeserta?.trim() || undefined;
    const email = row.email?.trim() || undefined;
    const telepon = row.telepon?.trim() || undefined;
    const catatan = row.catatan?.trim() || undefined;
    const issues: string[] = [];
    const nomorKey = normalizeImportKey(nomorPeserta);
    const namaKey = normalizeImportKey(nama);
    const duplicateKey = nomorKey ? `nomor:${nomorKey}` : `nama:${namaKey}`;

    if (!nama) issues.push("Nama wajib diisi.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("Format email tidak valid.");

    const duplicateInFile = duplicateKey !== "nama:" && seen.has(duplicateKey);
    if (duplicateKey !== "nama:") seen.add(duplicateKey);

    const duplicateInClass = (nomorKey && existingByNomor.has(nomorKey)) || existingByNama.has(namaKey);

    let status: ImportPreviewRow["status"] = "valid";
    if (issues.length > 0) {
      status = "error";
    } else if (duplicateInFile || duplicateInClass) {
      if (duplicateStrategy === "update" && duplicateInClass && !duplicateInFile) {
        status = "update";
      } else if (duplicateStrategy === "allow") {
        status = "valid";
      } else {
        status = "duplicate";
        if (duplicateInFile) issues.push("Duplikat di file/paste.");
        if (duplicateInClass) issues.push("Sudah ada di kelas.");
      }
    }

    return { rowNumber: index + 1, nama, nomorPeserta, email, telepon, catatan, status, issues };
  });
}

export function getIsoDateParts(date: string) {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  const day = Number.parseInt(dayText ?? "", 10);

  return {
    year,
    month,
    day,
    isValid: Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day),
  };
}

export function formatSessionDate(date: string) {
  const { year, month, day, isValid } = getIsoDateParts(date);
  if (!isValid) return date;
  return `${day} ${MONTH_LABELS_ID[month - 1] ?? ""} ${year}`;
}

export function buildSessionMonthGroups(sesiList: SesiPelatihan[]) {
  const groups: { key: string; label: string; sessions: SesiPelatihan[] }[] = [];

  for (const sesi of sesiList) {
    const { year, month, isValid } = getIsoDateParts(sesi.scheduledDate);
    const key = isValid ? `${year}-${String(month).padStart(2, "0")}` : sesi.scheduledDate;
    const label = isValid ? `${MONTH_LABELS_ID[month - 1] ?? "BULAN"} ${year}` : sesi.scheduledDate;
    const existing = groups.find((group) => group.key === key);

    if (existing) {
      existing.sessions.push(sesi);
    } else {
      groups.push({ key, label, sessions: [sesi] });
    }
  }

  return groups;
}
