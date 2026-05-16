import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { getDataSuratCuti } from "@/server/actions/suratCuti";

export const dynamic = "force-dynamic";

function formatTanggalIndo(isoDate: string): string {
  const date = new Date(isoDate + (isoDate.includes("T") ? "" : "T00:00:00"));
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTanggalWaktuIndo(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) + ", " + date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

function getNamaBulan(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const res = await getDataSuratCuti(id);
    if (!res.ok || !res.data) {
      return NextResponse.json(
        { error: res.error ?? "Data tidak ditemukan." },
        { status: 404 },
      );
    }

    const data = res.data;

    if (data.status !== "disetujui") {
      return NextResponse.json(
        { error: "Hanya cuti yang sudah disetujui yang bisa dicetak." },
        { status: 400 },
      );
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 20;
    const marginRight = 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    let y = 20;

    // Helper
    const addText = (text: string, x: number, yPos: number, options?: { font?: string; size?: number; align?: "left" | "center" | "right"; maxWidth?: number }) => {
      doc.setFontSize(options?.size ?? 11);
      if (options?.font === "bold") {
        doc.setFont("helvetica", "bold");
      } else if (options?.font === "italic") {
        doc.setFont("helvetica", "italic");
      } else {
        doc.setFont("helvetica", "normal");
      }
      if (options?.maxWidth) {
        doc.text(text, x, yPos, { maxWidth: options.maxWidth, align: options?.align });
      } else {
        doc.text(text, x, yPos, { align: options?.align });
      }
    };

    // Tempat & Tanggal
    addText(`Jakarta, ${formatTanggalIndo(data.tanggalPengajuan)}`, pageWidth - marginRight, y, { align: "right" });
    y += 12;

    // Tujuan
    addText("Kepada Yth.", marginLeft, y);
    y += 5;
    addText(data.namaApprover ?? "[Approver]", marginLeft, y, { font: "bold" });
    y += 5;
    addText(data.jabatanApprover ?? "Direktur Eksekutif", marginLeft, y, { font: "italic" });
    y += 5;
    addText("Ikatan Akuntan Indonesia", marginLeft, y, { font: "bold" });
    y += 5;
    addText("Wilayah DKI Jakarta", marginLeft, y, { font: "bold" });
    y += 5;
    addText("Di Tempat", marginLeft, y);
    y += 12;

    // Pembuka
    addText("Dengan hormat,", marginLeft, y);
    y += 5;
    addText("Saya yang bertanda tangan dibawah ini :", marginLeft, y);
    y += 10;

    // Data Pemohon
    const labelX = marginLeft;
    const colonX = marginLeft + 40;
    const valueX = marginLeft + 44;

    addText("Nama", labelX, y);
    addText(":", colonX, y);
    addText(data.namaPemohon, valueX, y);
    y += 6;

    addText("Dept.", labelX, y);
    addText(":", colonX, y);
    addText(data.divisiPemohon, valueX, y);
    y += 6;

    addText("Tahun Bergabung", labelX, y);
    addText(":", colonX, y);
    addText(data.tahunBergabung, valueX, y);
    y += 10;

    // Isi Pengajuan
    let isiText = `Mengajukan cuti tanggal ${formatTanggalIndo(data.tanggalMulai)}`;
    if (data.tanggalMulai !== data.tanggalSelesai) {
      isiText += ` s/d ${formatTanggalIndo(data.tanggalSelesai)}`;
    }
    isiText += ` untuk keperluan ${data.alasan}`;
    addText(isiText, marginLeft, y, { maxWidth: contentWidth });
    // Estimate lines for wrapping
    const lines = doc.splitTextToSize(isiText, contentWidth);
    y += lines.length * 5 + 8;

    // Rangkuman Saldo
    addText("Berikut rangkuman cuti saya :", marginLeft, y);
    y += 8;

    const saldoLabelX = marginLeft;
    const saldoColonX = marginLeft + 75;
    const saldoValueX = marginLeft + 79;

    const saldoItems = [
      [`Cuti tahun ${data.tahunCuti}`, `${data.kuotaAwal} hari`],
      [`Cuti bersama tahun ${data.tahunCuti}`, `${data.cutiBersamaTerpakai} hari`],
      [`Cuti yg sudah diambil tahun ${data.tahunCuti}`, `${data.cutiSudahDiambil} hari`],
      [`Cuti yg diambil bulan ${getNamaBulan(data.tanggalMulai)}`, `${data.cutiDiambilSekarang} hari`],
      [`Sisa cuti tahun ${data.tahunCuti}`, `${data.sisaCuti} hari`],
    ];

    for (let i = 0; i < saldoItems.length; i++) {
      const isLast = i === saldoItems.length - 1;
      if (isLast) doc.setFont("helvetica", "bold");
      addText(saldoItems[i]![0]!, saldoLabelX, y);
      addText(":", saldoColonX, y);
      addText(saldoItems[i]![1]!, saldoValueX, y);
      if (isLast) doc.setFont("helvetica", "normal");
      y += 6;
    }

    y += 8;

    // Penutup
    addText("Demikian saya sampaikan, atas perhatiannya saya ucapkan terima kasih.", marginLeft, y, { maxWidth: contentWidth });
    y += 16;

    // Tanda Tangan
    const ttdY = y;
    addText("Hormat saya,", marginLeft, ttdY);
    addText("Menyetujui,", pageWidth - marginRight, ttdY, { align: "right" });

    const namaY = ttdY + 25;
    addText(`( ${data.namaPemohon} )`, marginLeft, namaY);
    addText(`( ${data.namaApprover ?? "________________"} )`, pageWidth - marginRight, namaY, { align: "right" });

    if (data.jabatanApprover) {
      addText(data.jabatanApprover, pageWidth - marginRight, namaY + 5, { align: "right", size: 9 });
    }

    // Stempel digital
    if (data.approvalCode && data.approvedAt) {
      const stempelY = namaY + (data.jabatanApprover ? 12 : 7);
      doc.setDrawColor(150, 150, 150);
      doc.line(pageWidth - marginRight - 60, stempelY, pageWidth - marginRight, stempelY);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Disetujui digital via ARKA", pageWidth - marginRight, stempelY + 4, { align: "right" });
      doc.text(
        `${formatTanggalWaktuIndo(data.approvedAt)} · ${data.approvalCode}`,
        pageWidth - marginRight,
        stempelY + 8,
        { align: "right" },
      );
      doc.setTextColor(0, 0, 0);
    }

    // Catatan
    const catatanY = 260;
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, catatanY, pageWidth - marginRight, catatanY);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Catatan :", marginLeft, catatanY + 5);
    doc.text(
      `No. Telepon yang dapat dihubungi selama cuti : ${data.noHpPemohon}`,
      marginLeft,
      catatanY + 10,
    );

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Surat_Cuti_${data.namaPemohon.replace(/\s+/g, "_")}_${data.tanggalMulai}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal generate PDF." },
      { status: 500 },
    );
  }
}
