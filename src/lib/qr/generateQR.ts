import QRCode from "qrcode";

// Generate QR sebagai data URL (base64 PNG).
// Untuk verifikasi surat: isi = URL publik verifikasi atau data ringkas.
// Untuk QR Contact pegawai: isi = vCard 3.0 string.
export async function generateQRDataURL(
  data: string,
  opts: { size?: number; margin?: number } = {},
): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: "M",
    width: opts.size ?? 256,
    margin: opts.margin ?? 2,
  });
}

// vCard 3.0 untuk QR Contact pegawai.
// Catatan di UI: regenerate manual bila Nama/HP/Email berubah.
export function buildVCard(input: {
  namaLengkap: string;
  noHp?: string | null;
  email: string;
  jabatan?: string | null;
  organisasi?: string;
}): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${input.namaLengkap}`,
    `FN:${input.namaLengkap}`,
    input.jabatan ? `TITLE:${input.jabatan}` : null,
    input.organisasi ? `ORG:${input.organisasi}` : null,
    input.noHp ? `TEL;TYPE=CELL:${input.noHp}` : null,
    `EMAIL:${input.email}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

// Payload QR verifikasi surat — kompak, bisa di-scan dan diarahkan ke URL verifikasi.
// Semua jenis surat (termasuk SK/MOU) menggunakan verifikasi surat-keluar.
export function buildVerifikasiSuratPayload(input: {
  appUrl: string;
  jenis?: "surat-keluar" | "surat-keputusan" | "surat-mou";
  id: string;
  nomor?: string | null;
}): string {
  const base = input.appUrl.replace(/\/$/, "");
  // Unified: semua verifikasi mengarah ke surat-keluar
  const unifiedJenis = "surat-keluar";
  return `${base}/verifikasi/${unifiedJenis}/${input.id}`;
}
