import { APP_BRAND_FULL_NAME } from "@/lib/branding";
import type { EmailPayload } from "./types";

// Template: undangan aktivasi akun untuk pegawai baru (set kata sandi pertama).
export function buildInviteEmail(args: {
  namaLengkap: string;
  resetUrl: string;
  inviterName?: string | null;
}): Pick<EmailPayload, "subject" | "htmlBody" | "textBody"> {
  const subject = `Undangan Aktivasi Akun - ${APP_BRAND_FULL_NAME}`;
  const inviterLine = args.inviterName
    ? `<p>Akun Anda dibuat oleh <strong>${args.inviterName}</strong>.</p>`
    : "";
  const htmlBody = `
    <p>Yth. ${args.namaLengkap},</p>
    <p>Selamat datang di ${APP_BRAND_FULL_NAME}.</p>
    ${inviterLine}
    <p>Silakan klik tombol di bawah untuk membuat kata sandi dan mengaktifkan akun Anda. Tautan ini berlaku terbatas (default 1 jam).</p>
    <p><a href="${args.resetUrl}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">Aktivasi Akun</a></p>
    <p>Jika tombol tidak berfungsi, salin URL berikut: <br/><a href="${args.resetUrl}">${args.resetUrl}</a></p>
    <p>Jika Anda tidak meminta akses ini, abaikan email ini.</p>
    <p>- ${APP_BRAND_FULL_NAME}</p>
  `;
  const textBody = [
    `Yth. ${args.namaLengkap},`,
    `Selamat datang di ${APP_BRAND_FULL_NAME}.`,
    args.inviterName ? `Akun Anda dibuat oleh ${args.inviterName}.` : "",
    `Aktivasi akun: ${args.resetUrl}`,
    `Jika Anda tidak meminta akses, abaikan email ini.`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, htmlBody, textBody };
}

// Template: permintaan reset kata sandi (untuk user existing).
export function buildResetPasswordEmail(args: {
  namaLengkap: string;
  resetUrl: string;
}): Pick<EmailPayload, "subject" | "htmlBody" | "textBody"> {
  const subject = `Reset Kata Sandi - ${APP_BRAND_FULL_NAME}`;
  const htmlBody = `
    <p>Yth. ${args.namaLengkap},</p>
    <p>Kami menerima permintaan reset kata sandi untuk akun Anda.</p>
    <p>Klik tombol di bawah untuk mengatur kata sandi baru. Tautan ini berlaku terbatas (default 1 jam).</p>
    <p><a href="${args.resetUrl}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">Reset Kata Sandi</a></p>
    <p>Jika tombol tidak berfungsi, salin URL berikut: <br/><a href="${args.resetUrl}">${args.resetUrl}</a></p>
    <p>Jika Anda tidak meminta reset, abaikan email ini — kata sandi Anda tetap aman.</p>
    <p>- ${APP_BRAND_FULL_NAME}</p>
  `;
  const textBody = [
    `Yth. ${args.namaLengkap},`,
    `Kami menerima permintaan reset kata sandi untuk akun Anda.`,
    `Reset: ${args.resetUrl}`,
    `Jika Anda tidak meminta reset, abaikan email ini.`,
  ].join("\n");
  return { subject, htmlBody, textBody };
}

// Template: notifikasi disposisi baru ke penerima.
export function buildDisposisiEmail(args: {
  penerimaNama: string;
  pengirimNama: string;
  perihalSurat: string;
  instruksi?: string | null;
  batasWaktu?: string | null;
  inboxUrl: string;
}): Pick<EmailPayload, "subject" | "htmlBody" | "textBody"> {
  const subject = `Disposisi Baru: ${args.perihalSurat}`;
  const batasWaktuLine = args.batasWaktu
    ? `<p><strong>Batas waktu:</strong> ${args.batasWaktu}</p>`
    : "";
  const instruksiLine = args.instruksi
    ? `<p><strong>Instruksi:</strong> ${args.instruksi}</p>`
    : "";
  const htmlBody = `
    <p>Yth. ${args.penerimaNama},</p>
    <p>Anda menerima disposisi baru dari <strong>${args.pengirimNama}</strong>.</p>
    <p><strong>Perihal:</strong> ${args.perihalSurat}</p>
    ${instruksiLine}
    ${batasWaktuLine}
    <p><a href="${args.inboxUrl}">Buka Inbox Disposisi</a></p>
    <p>- ${APP_BRAND_FULL_NAME}</p>
  `;
  const textBody = [
    `Yth. ${args.penerimaNama},`,
    `Anda menerima disposisi baru dari ${args.pengirimNama}.`,
    `Perihal: ${args.perihalSurat}`,
    args.instruksi ? `Instruksi: ${args.instruksi}` : "",
    args.batasWaktu ? `Batas waktu: ${args.batasWaktu}` : "",
    `Buka: ${args.inboxUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, htmlBody, textBody };
}
