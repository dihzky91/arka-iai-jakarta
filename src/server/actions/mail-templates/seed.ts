"use server";

import { db } from "@/server/db";
import { emailTemplates, emailLayouts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { compileBlocksToText } from "@/lib/email/template-engine/text-compiler";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

// ─── DEFAULT LAYOUTS ──────────────────────────────────────────────────────────

const DEFAULT_LAYOUTS = [
  {
    name: "Default",
    description: "Logo ARKA di header, footer dengan alamat + tahun",
    isDefault: true,
    headerHtml: `<tr><td style="padding:24px 32px;border-bottom:2px solid #1d4ed8;"><img src="{{app.logo_url}}" alt="{{app.name}}" width="120" style="display:block;" onerror="this.style.display='none'"/><span style="font-size:20px;font-weight:bold;color:#1d4ed8;">{{app.name}}</span></td></tr>`,
    footerHtml: `<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">&copy; {{current.year}} {{app.name}} &bull; {{org.nama}}</td></tr>`,
  },
  {
    name: "Minimal",
    description: "Tanpa header, footer hanya brand name",
    isDefault: false,
    headerHtml: "",
    footerHtml: `<tr><td style="padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center;">&mdash; {{app.name}}</td></tr>`,
  },
  {
    name: "Formal",
    description: "Header dengan garis biru, footer lengkap dengan kontak",
    isDefault: false,
    headerHtml: `<tr><td style="padding:24px 32px;background:linear-gradient(135deg,#1e3a5f,#1d4ed8);"><span style="font-size:22px;font-weight:bold;color:#ffffff;">{{app.name}}</span><br/><span style="font-size:12px;color:#93c5fd;">{{org.nama}}</span></td></tr>`,
    footerHtml: `<tr><td style="padding:16px 32px;background:#1e293b;font-size:11px;color:#94a3b8;text-align:center;">&copy; {{current.year}} {{org.nama}}<br/>Jl. Sindanglaya No.1, Menteng, Jakarta Pusat 10310</td></tr>`,
  },
];

// ─── DEFAULT TEMPLATES ────────────────────────────────────────────────────────

function makeBlocks(...blocks: TemplateBlock[]): TemplateBlock[] {
  return blocks;
}

function pid(suffix: string): string {
  return `seed-${suffix}`;
}

const DEFAULT_TEMPLATES: Array<{
  templateKey: string;
  templateName: string;
  description: string;
  category: "persuratan" | "akademik" | "keuangan" | "auth" | "sistem" | "ppl" | "custom";
  subject: string;
  bodyBlocks: TemplateBlock[];
}> = [
  {
    templateKey: "auth_invite",
    templateName: "Undangan Aktivasi Akun",
    description: "Email undangan untuk pegawai baru set password",
    category: "auth",
    subject: "Undangan Aktivasi Akun - {{app.name}}",
    bodyBlocks: makeBlocks(
      { id: pid("ai-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("ai-2"), type: "paragraph", content: "Selamat datang di {{app.name}}. Akun Anda telah dibuat oleh {{auth.inviter_name}}." },
      { id: pid("ai-3"), type: "paragraph", content: "Silakan klik tombol di bawah untuk membuat kata sandi dan mengaktifkan akun Anda. Tautan ini berlaku {{auth.expiry}}." },
      { id: pid("ai-4"), type: "button", label: "Aktivasi Akun", url: "{{auth.invite_url}}", color: "#1d4ed8" },
      { id: pid("ai-5"), type: "paragraph", content: "Jika Anda tidak meminta akses ini, abaikan email ini." },
      { id: pid("ai-6"), type: "signature" },
    ),
  },
  {
    templateKey: "auth_reset_password",
    templateName: "Reset Kata Sandi",
    description: "Email reset kata sandi",
    category: "auth",
    subject: "Reset Kata Sandi - {{app.name}}",
    bodyBlocks: makeBlocks(
      { id: pid("rp-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("rp-2"), type: "paragraph", content: "Kami menerima permintaan reset kata sandi untuk akun Anda." },
      { id: pid("rp-3"), type: "paragraph", content: "Klik tombol di bawah untuk mengatur kata sandi baru. Tautan ini berlaku {{auth.expiry}}." },
      { id: pid("rp-4"), type: "button", label: "Reset Kata Sandi", url: "{{auth.reset_url}}", color: "#1d4ed8" },
      { id: pid("rp-5"), type: "paragraph", content: "Jika Anda tidak meminta reset, abaikan email ini — kata sandi Anda tetap aman." },
      { id: pid("rp-6"), type: "signature" },
    ),
  },
  {
    templateKey: "surat_keluar_review",
    templateName: "Reviu Surat Keluar",
    description: "Notifikasi ke pejabat untuk mereviu draft surat keluar",
    category: "persuratan",
    subject: "Reviu Surat Keluar: {{surat.perihal}}",
    bodyBlocks: makeBlocks(
      { id: pid("skr-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("skr-2"), type: "paragraph", content: "Mohon perkenan untuk mereviu draft surat keluar berikut:" },
      { id: pid("skr-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Pembuat", "{{surat.pengirim}}"], ["Perihal", "{{surat.perihal}}"], ["Tujuan", "{{surat.tujuan}}"]], striped: true },
      { id: pid("skr-4"), type: "button", label: "Reviu Surat Keluar", url: "{{surat.review_url}}", color: "#1d4ed8" },
      { id: pid("skr-5"), type: "signature" },
    ),
  },
  {
    templateKey: "surat_keluar_revisi",
    templateName: "Revisi Surat Keluar",
    description: "Notifikasi revisi diperlukan",
    category: "persuratan",
    subject: "Revisi Surat Keluar: {{surat.perihal}}",
    bodyBlocks: makeBlocks(
      { id: pid("skv-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("skv-2"), type: "paragraph", content: "{{pejabat.nama}} meminta revisi untuk surat keluar berikut:" },
      { id: pid("skv-3"), type: "paragraph", content: "Perihal: {{surat.perihal}}", bold: true },
      { id: pid("skv-4"), type: "alert", variant: "warning", content: "Catatan: {{catatan.revisi}}" },
      { id: pid("skv-5"), type: "button", label: "Buka Surat Keluar", url: "{{surat.url}}", color: "#f59e0b" },
      { id: pid("skv-6"), type: "signature" },
    ),
  },
  {
    templateKey: "surat_keluar_selesai",
    templateName: "Surat Keluar Selesai",
    description: "Surat selesai diproses & diarsipkan",
    category: "persuratan",
    subject: "Surat Keluar Selesai: {{surat.perihal}}",
    bodyBlocks: makeBlocks(
      { id: pid("sks-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("sks-2"), type: "paragraph", content: "Surat keluar berikut telah selesai diproses dan diarsipkan:" },
      { id: pid("sks-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Perihal", "{{surat.perihal}}"], ["Nomor Surat", "{{surat.nomor}}"]] },
      { id: pid("sks-4"), type: "button", label: "Buka Arsip Surat", url: "{{surat.url}}", color: "#22c55e" },
      { id: pid("sks-5"), type: "signature" },
    ),
  },
  {
    templateKey: "disposisi_baru",
    templateName: "Disposisi Baru",
    description: "Disposisi baru diterima",
    category: "persuratan",
    subject: "Disposisi Baru: {{surat.perihal}}",
    bodyBlocks: makeBlocks(
      { id: pid("db-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("db-2"), type: "paragraph", content: "Anda menerima disposisi baru dari {{disposisi.dari}}." },
      { id: pid("db-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Perihal", "{{surat.perihal}}"], ["Instruksi", "{{disposisi.instruksi}}"], ["Batas Waktu", "{{disposisi.batas_waktu}}"]] },
      { id: pid("db-4"), type: "button", label: "Buka Inbox Disposisi", url: "{{disposisi.url}}", color: "#1d4ed8" },
      { id: pid("db-5"), type: "signature" },
    ),
  },
  {
    templateKey: "disposisi_deadline",
    templateName: "Reminder Deadline Disposisi",
    description: "Reminder deadline disposisi mendekati",
    category: "persuratan",
    subject: "Reminder: Disposisi mendekati deadline ({{disposisi.sisa_hari}} hari lagi)",
    bodyBlocks: makeBlocks(
      { id: pid("dd-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("dd-2"), type: "alert", variant: "warning", content: "Disposisi dari {{disposisi.dari}} akan jatuh tempo dalam {{disposisi.sisa_hari}} hari." },
      { id: pid("dd-3"), type: "paragraph", content: "Instruksi: {{disposisi.instruksi}}" },
      { id: pid("dd-4"), type: "paragraph", content: "Batas waktu: {{disposisi.batas_waktu}}" },
      { id: pid("dd-5"), type: "button", label: "Buka Disposisi", url: "{{disposisi.url}}", color: "#f59e0b" },
      { id: pid("dd-6"), type: "signature" },
    ),
  },
  {
    templateKey: "jadwal_instruktur",
    templateName: "Notifikasi Jadwal Instruktur",
    description: "Notifikasi jadwal mengajar ke instruktur",
    category: "akademik",
    subject: "Jadwal Mengajar: {{jadwal.materi}} - {{jadwal.tanggal}}",
    bodyBlocks: makeBlocks(
      { id: pid("ji-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("ji-2"), type: "paragraph", content: "Berikut jadwal mengajar Anda:" },
      { id: pid("ji-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Kelas", "{{kelas.nama}}"], ["Materi", "{{jadwal.materi}}"], ["Tanggal", "{{jadwal.tanggal}}"], ["Waktu", "{{jadwal.waktu}}"], ["Ruangan", "{{jadwal.ruangan}}"]], striped: true },
      { id: pid("ji-4"), type: "paragraph", content: "Mohon hadir tepat waktu. Terima kasih." },
      { id: pid("ji-5"), type: "signature" },
    ),
  },
  {
    templateKey: "jadwal_perubahan",
    templateName: "Perubahan Jadwal",
    description: "Notifikasi perubahan jadwal",
    category: "akademik",
    subject: "Perubahan Jadwal: {{kelas.nama}}",
    bodyBlocks: makeBlocks(
      { id: pid("jp-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("jp-2"), type: "alert", variant: "info", content: "Terdapat perubahan jadwal untuk kelas {{kelas.nama}}." },
      { id: pid("jp-3"), type: "paragraph", content: "Jadwal baru: {{jadwal.tanggal}}, {{jadwal.waktu}} di {{jadwal.ruangan}}." },
      { id: pid("jp-4"), type: "paragraph", content: "Mohon maaf atas ketidaknyamanannya." },
      { id: pid("jp-5"), type: "signature" },
    ),
  },
  {
    templateKey: "honorarium_status",
    templateName: "Status Honorarium",
    description: "Update status pembayaran honorarium",
    category: "keuangan",
    subject: "Update Honorarium: {{honorarium.status}}",
    bodyBlocks: makeBlocks(
      { id: pid("hs-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("hs-2"), type: "paragraph", content: "Berikut update status honorarium Anda:" },
      { id: pid("hs-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Jumlah", "{{honorarium.jumlah}}"], ["Periode", "{{honorarium.periode}}"], ["Status", "{{honorarium.status}}"]] },
      { id: pid("hs-4"), type: "button", label: "Lihat Detail", url: "{{keuangan.url}}", color: "#1d4ed8" },
      { id: pid("hs-5"), type: "signature" },
    ),
  },
  {
    templateKey: "honorarium_batch_ready",
    templateName: "Batch Honorarium Siap",
    description: "Batch honorarium siap diproses",
    category: "keuangan",
    subject: "Batch Honorarium Siap: {{batch.nama}}",
    bodyBlocks: makeBlocks(
      { id: pid("hb-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("hb-2"), type: "alert", variant: "success", content: "Batch honorarium {{batch.nama}} siap untuk diproses." },
      { id: pid("hb-3"), type: "button", label: "Proses Batch", url: "{{keuangan.url}}", color: "#22c55e" },
      { id: pid("hb-4"), type: "signature" },
    ),
  },
  {
    templateKey: "sertifikat_ready",
    templateName: "Sertifikat Siap Diunduh",
    description: "Sertifikat siap diunduh",
    category: "akademik",
    subject: "Sertifikat Anda Siap: {{sertifikat.program}}",
    bodyBlocks: makeBlocks(
      { id: pid("sr-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("sr-2"), type: "paragraph", content: "Selamat! Sertifikat Anda untuk program {{sertifikat.program}} telah diterbitkan." },
      { id: pid("sr-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Nomor", "{{sertifikat.nomor}}"], ["Program", "{{sertifikat.program}}"], ["Tanggal Terbit", "{{sertifikat.tanggal}}"]] },
      { id: pid("sr-4"), type: "button", label: "Download Sertifikat", url: "{{sertifikat.download_url}}", color: "#1d4ed8" },
      { id: pid("sr-5"), type: "signature" },
    ),
  },
  {
    templateKey: "evaluasi_link",
    templateName: "Link Evaluasi PPL",
    description: "Link kuesioner evaluasi PPL",
    category: "ppl",
    subject: "Evaluasi Kegiatan: {{ppl.kegiatan}}",
    bodyBlocks: makeBlocks(
      { id: pid("el-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("el-2"), type: "paragraph", content: "Terima kasih telah mengikuti kegiatan {{ppl.kegiatan}}." },
      { id: pid("el-3"), type: "paragraph", content: "Mohon luangkan waktu untuk mengisi kuesioner evaluasi berikut:" },
      { id: pid("el-4"), type: "button", label: "Isi Kuesioner Evaluasi", url: "{{evaluasi.url}}", color: "#1d4ed8" },
      { id: pid("el-5"), type: "paragraph", content: "Masukan Anda sangat berharga untuk peningkatan kualitas kegiatan kami." },
      { id: pid("el-6"), type: "signature" },
    ),
  },
  {
    templateKey: "ppl_reminder",
    templateName: "Reminder Kegiatan PPL",
    description: "Reminder kegiatan PPL mendatang",
    category: "ppl",
    subject: "Reminder: {{ppl.kegiatan}} - {{ppl.tanggal}}",
    bodyBlocks: makeBlocks(
      { id: pid("pr-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("pr-2"), type: "paragraph", content: "Mengingatkan bahwa kegiatan PPL berikut akan segera dilaksanakan:" },
      { id: pid("pr-3"), type: "table", headers: ["Keterangan", "Detail"], rows: [["Kegiatan", "{{ppl.kegiatan}}"], ["Tanggal", "{{ppl.tanggal}}"], ["Lokasi", "{{ppl.lokasi}}"], ["SKP", "{{ppl.skp}}"], ["Narasumber", "{{ppl.narasumber}}"]], striped: true },
      { id: pid("pr-4"), type: "paragraph", content: "Mohon hadir tepat waktu. Terima kasih." },
      { id: pid("pr-5"), type: "signature" },
    ),
  },
  {
    templateKey: "pengumuman_broadcast",
    templateName: "Pengumuman Broadcast",
    description: "Pengumuman umum ke semua user",
    category: "sistem",
    subject: "Pengumuman: {{app.name}}",
    bodyBlocks: makeBlocks(
      { id: pid("pb-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("pb-2"), type: "paragraph", content: "Berikut pengumuman dari {{app.name}}:" },
      { id: pid("pb-3"), type: "divider" },
      { id: pid("pb-4"), type: "paragraph", content: "{{app.name}} — Terima kasih atas perhatiannya." },
      { id: pid("pb-5"), type: "signature" },
    ),
  },
  {
    templateKey: "project_invitation",
    templateName: "Undangan Project",
    description: "Undangan bergabung ke project",
    category: "sistem",
    subject: "Undangan Project: {{app.name}}",
    bodyBlocks: makeBlocks(
      { id: pid("pi-1"), type: "paragraph", content: "Yth. {{recipient.nama}}," },
      { id: pid("pi-2"), type: "paragraph", content: "Anda diundang untuk bergabung ke sebuah project di {{app.name}}." },
      { id: pid("pi-3"), type: "button", label: "Lihat Project", url: "{{app.url}}/projects", color: "#1d4ed8" },
      { id: pid("pi-4"), type: "signature" },
    ),
  },
];

// ─── SEED FUNCTION ────────────────────────────────────────────────────────────

export async function seedMailTemplates() {
  const sampleData = getAllSampleData();

  // Seed layouts
  for (const layout of DEFAULT_LAYOUTS) {
    const existing = await db
      .select({ id: emailLayouts.id })
      .from(emailLayouts)
      .where(eq(emailLayouts.name, layout.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(emailLayouts).values({
        name: layout.name,
        description: layout.description,
        headerHtml: layout.headerHtml,
        footerHtml: layout.footerHtml,
        isDefault: layout.isDefault,
      });
    }
  }

  // Get default layout ID for templates
  const defaultLayout = await db
    .select({ id: emailLayouts.id })
    .from(emailLayouts)
    .where(eq(emailLayouts.isDefault, true))
    .limit(1);
  const defaultLayoutId = defaultLayout[0]?.id ?? null;

  // Seed templates
  for (const tmpl of DEFAULT_TEMPLATES) {
    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.templateKey, tmpl.templateKey))
      .limit(1);

    if (existing.length === 0) {
      const compiledHtml = compileBlocksToHtml(tmpl.bodyBlocks, sampleData);
      const compiledText = compileBlocksToText(tmpl.bodyBlocks, sampleData);

      await db.insert(emailTemplates).values({
        templateKey: tmpl.templateKey,
        templateName: tmpl.templateName,
        description: tmpl.description,
        category: tmpl.category,
        subject: tmpl.subject,
        bodyBlocks: tmpl.bodyBlocks,
        compiledHtml,
        compiledText,
        layoutId: defaultLayoutId,
        isSystem: true,
        isActive: true,
        version: 1,
      });
    }
  }

  return { success: true, message: "Seed completed" };
}
