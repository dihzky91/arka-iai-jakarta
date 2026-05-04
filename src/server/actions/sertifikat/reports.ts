"use server";

import { and, eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { auditLog, events, participants } from "@/server/db/schema";
import { requirePermission } from "../auth";

type ExportResult =
  | { ok: true; data: { fileName: string; xlsxBase64: string } }
  | { ok: false; error: string };

function formatDate(value: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function exportEventReport(eventId: number): Promise<ExportResult> {
  const session = await requirePermission("sertifikat", "manage");

  try {
    // 1. Get event details
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), sql`${events.deletedAt} IS NULL`))
      .limit(1);

    if (!event) return { ok: false, error: "Kegiatan tidak ditemukan." };

    // 2. Get all participants (including revoked, but excluding soft-deleted)
    const allRows = await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.eventId, eventId),
          sql`${participants.deletedAt} IS NULL`,
        ),
      )
      .orderBy(participants.id);

    // 3. Compute statistics
    const total = allRows.length;
    const aktif = allRows.filter((r) => r.statusPeserta === "aktif").length;
    const dicabut = allRows.filter((r) => r.statusPeserta === "dicabut").length;
    const emailTerkirim = allRows.filter((r) => r.emailSentAt !== null).length;
    const punyaEmail = allRows.filter((r) => r.email !== null && r.email !== "").length;
    const sudahDownload = allRows.filter((r) => r.lastPdfGeneratedAt !== null).length;
    const reissued = allRows.filter((r) => r.replacesParticipantId !== null).length;

    // 4. Build workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan
    const summaryRows: (string | number)[][] = [
      ["LAPORAN KEGIATAN SERTIFIKAT"],
      [""],
      ["Kode Kegiatan", event.kodeEvent],
      ["Nama Kegiatan", event.namaKegiatan],
      ["Kategori", event.kategori],
      ["Status", event.statusEvent],
      ["Tanggal", event.tanggalMulai === event.tanggalSelesai ? event.tanggalMulai : `${event.tanggalMulai} - ${event.tanggalSelesai}`],
      ["Lokasi", event.lokasi ?? "-"],
      ["SKP", event.skp ?? 0],
      [""],
      ["STATISTIK PESERTA"],
      ["Total Peserta (aktif + dicabut)", total],
      ["Aktif", aktif],
      ["Dicabut", dicabut],
      ["Diterbitkan Ulang (reissue)", reissued],
      [""],
      ["STATISTIK SERTIFIKAT"],
      ["Sudah Download PDF", `${sudahDownload} (${total ? Math.round((sudahDownload / total) * 100) : 0}%)`],
      ["Punya Email", `${punyaEmail} (${total ? Math.round((punyaEmail / total) * 100) : 0}%)`],
      ["Email Terkirim", `${emailTerkirim} (${punyaEmail ? Math.round((emailTerkirim / punyaEmail) * 100) : 0}% dari yang punya email)`],
      [""],
      ["Diekspor pada", formatDate(new Date())],
      ["Diekspor oleh", session.user.email ?? session.user.id],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 35 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

    // Sheet 2: Daftar Peserta
    const participantRows = allRows.map((row, idx) => ({
      "No.": idx + 1,
      "No. Sertifikat": row.noSertifikat,
      Nama: row.nama,
      Role: row.role,
      Email: row.email ?? "",
      Status: row.statusPeserta === "aktif" ? "Aktif" : "Dicabut",
      "Alasan Pencabutan": row.revokeReason ?? "",
      "Dicabut pada": formatDate(row.revokedAt),
      "Email Terkirim": formatDate(row.emailSentAt),
      "PDF Terakhir": formatDate(row.lastPdfGeneratedAt),
      "Hash PDF (SHA-256)": row.lastPdfHash ?? "",
      "Re-issue dari ID": row.replacesParticipantId ?? "",
      "Dibuat pada": formatDate(row.createdAt),
    }));

    const participantsSheet = XLSX.utils.json_to_sheet(participantRows);
    participantsSheet["!cols"] = [
      { wch: 5 },   // No.
      { wch: 25 },  // No. Sertifikat
      { wch: 30 },  // Nama
      { wch: 12 },  // Role
      { wch: 30 },  // Email
      { wch: 10 },  // Status
      { wch: 30 },  // Alasan
      { wch: 18 },  // Dicabut pada
      { wch: 18 },  // Email Terkirim
      { wch: 18 },  // PDF Terakhir
      { wch: 30 },  // Hash
      { wch: 15 },  // Re-issue dari ID
      { wch: 18 },  // Dibuat pada
    ];
    XLSX.utils.book_append_sheet(wb, participantsSheet, "Peserta");

    // 5. Convert to base64
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const xlsxBase64 = Buffer.from(buffer).toString("base64");

    // 6. Audit log
    await writeAuditLog({
      userId: session.user.id,
      aksi: "EXPORT_EVENT_REPORT",
      entitasType: "sertifikat_event",
      entitasId: String(eventId),
      detail: { kodeEvent: event.kodeEvent, totalPeserta: total },
    });

    const safeKode = event.kodeEvent.replace(/[^a-zA-Z0-9-_]/g, "_");
    return {
      ok: true,
      data: {
        fileName: `Laporan-${safeKode}.xlsx`,
        xlsxBase64,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengekspor laporan." };
  }
}
