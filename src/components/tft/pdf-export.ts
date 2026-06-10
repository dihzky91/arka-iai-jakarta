import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { KriteriaTftRow, PenilaiTftRow } from "@/server/actions/tft/penilaian";
import type { PendaftarTftRow } from "@/server/actions/tft/pendaftar";
import type { PeriodeTftRow } from "@/server/actions/tft/periode";

/**
 * Cetak Form Penilaian (untuk diisi penilai secara manual di kertas).
 * Satu PDF per penilai berisi tabel peserta × kriteria.
 */
export async function exportFormPenilaianPdf(opts: {
  periode: PeriodeTftRow;
  penilai: PenilaiTftRow;
  pendaftar: PendaftarTftRow[];
  kriteria: KriteriaTftRow[];
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
}) {
  const { periode, penilai, pendaftar, kriteria, systemIdentity } = opts;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  let currentY = 12;

  // Header
  doc.setFontSize(14);
  doc.setTextColor(29, 78, 216);
  doc.text("FORM PENILAIAN", pageWidth / 2, currentY, { align: "center" });
  currentY += 7;

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(periode.judul, pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const infoLine = [
    `Tanggal: ${periode.tanggalMulai}${periode.tanggalSelesai !== periode.tanggalMulai ? ` s/d ${periode.tanggalSelesai}` : ""}`,
    periode.lokasi ? `Lokasi: ${periode.lokasi}` : "",
  ]
    .filter(Boolean)
    .join("  •  ");
  doc.text(infoLine, pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  // Penilai info
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Penilai: ${penilai.nama}`, marginX, currentY);
  if (penilai.jabatan || penilai.instansi) {
    currentY += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [penilai.jabatan, penilai.instansi].filter(Boolean).join(" — "),
      marginX,
      currentY,
    );
  }
  currentY += 8;

  // Build table
  const headerRow = ["No", "Nama Peserta", ...kriteria.map((k) => `${k.nama}\n(${k.bobot}%)`), "Catatan"];
  const bodyRows = pendaftar
    .filter((p) => p.bersediaHadir && p.status !== "ditolak")
    .map((p, i) => [
      String(i + 1),
      p.namaLengkap,
      ...kriteria.map(() => ""), // empty cells for manual fill
      "", // catatan
    ]);

  autoTable(doc, {
    startY: currentY,
    head: [headerRow],
    body: bodyRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, minCellHeight: 10 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 50 },
    },
    margin: { left: marginX, right: marginX },
  });

  // Signature area at bottom
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Tanda Tangan Penilai:", marginX, finalY);
  doc.text("(                                    )", marginX, finalY + 20);
  doc.text(penilai.nama, marginX, finalY + 25);
  doc.text(`Tanggal: ____________________`, pageWidth - marginX - 60, finalY);

  doc.save(`form-penilaian-${penilai.nama.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

/**
 * Cetak Form Penilaian untuk SEMUA penilai sekaligus.
 * Satu PDF dengan page breaks antar penilai.
 */
export async function exportFormPenilaianAllPdf(opts: {
  periode: PeriodeTftRow;
  penilaiList: PenilaiTftRow[];
  pendaftar: PendaftarTftRow[];
  kriteria: KriteriaTftRow[];
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
}) {
  const { periode, penilaiList, pendaftar, kriteria } = opts;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;

  for (let i = 0; i < penilaiList.length; i++) {
    const penilai = penilaiList[i]!;
    if (i > 0) doc.addPage();

    let currentY = 12;

    // Header
    doc.setFontSize(14);
    doc.setTextColor(29, 78, 216);
    doc.text("FORM PENILAIAN", pageWidth / 2, currentY, { align: "center" });
    currentY += 7;

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(periode.judul, pageWidth / 2, currentY, { align: "center" });
    currentY += 6;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const infoLine = [
      `Tanggal: ${periode.tanggalMulai}${periode.tanggalSelesai !== periode.tanggalMulai ? ` s/d ${periode.tanggalSelesai}` : ""}`,
      periode.lokasi ? `Lokasi: ${periode.lokasi}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");
    doc.text(infoLine, pageWidth / 2, currentY, { align: "center" });
    currentY += 10;

    // Penilai info
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Penilai: ${penilai.nama}`, marginX, currentY);
    if (penilai.jabatan || penilai.instansi) {
      currentY += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        [penilai.jabatan, penilai.instansi].filter(Boolean).join(" — "),
        marginX,
        currentY,
      );
    }
    currentY += 8;

    // Build table
    const headerRow = ["No", "Nama Peserta", ...kriteria.map((k) => `${k.nama}\n(${k.bobot}%)`), "Catatan"];
    const bodyRows = pendaftar
      .filter((p) => p.bersediaHadir && p.status !== "ditolak")
      .map((p, j) => [
        String(j + 1),
        p.namaLengkap,
        ...kriteria.map(() => ""),
        "",
      ]);

    autoTable(doc, {
      startY: currentY,
      head: [headerRow],
      body: bodyRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, minCellHeight: 10 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 50 },
      },
      margin: { left: marginX, right: marginX },
    });

    // Signature area at bottom
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("Tanda Tangan Penilai:", marginX, finalY);
    doc.text("(                                    )", marginX, finalY + 20);
    doc.text(penilai.nama, marginX, finalY + 25);
    doc.text(`Tanggal: ____________________`, pageWidth - marginX - 60, finalY);
  }

  doc.save(`form-penilaian-all-${periode.slug}.pdf`);
}

/**
 * Cetak Rekap Hasil Penilaian — ranking peserta dengan skor akhir.
 */
export async function exportRekapHasilPdf(opts: {
  periode: PeriodeTftRow;
  pendaftar: PendaftarTftRow[];
  kriteria: KriteriaTftRow[];
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
}) {
  const { periode, pendaftar, kriteria, systemIdentity } = opts;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  let currentY = 12;

  // Header
  doc.setFontSize(14);
  doc.setTextColor(29, 78, 216);
  doc.text("REKAP HASIL PENILAIAN", pageWidth / 2, currentY, { align: "center" });
  currentY += 7;

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(periode.judul, pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Dicetak: ${format(new Date(), "dd MMMM yyyy, HH:mm", { locale: localeId })}`,
    pageWidth / 2,
    currentY,
    { align: "center" },
  );
  currentY += 10;

  // Threshold info
  if (periode.skorMinimum) {
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Threshold Kelulusan: ${periode.skorMinimum}`, marginX, currentY);
    currentY += 7;
  }

  // Ranked table
  const ranked = pendaftar
    .filter((p) => p.skorAkhir)
    .sort((a, b) => Number(b.skorAkhir) - Number(a.skorAkhir));

  const headerRow = ["#", "Nama", "Skor Akhir", "Status", "Keterangan"];
  const bodyRows = ranked.map((p, i) => {
    const lulus = periode.skorMinimum
      ? Number(p.skorAkhir) >= Number(periode.skorMinimum)
      : null;
    return [
      String(i + 1),
      p.namaLengkap,
      p.skorAkhir ?? "—",
      p.status === "diterima" ? "DITERIMA" : p.status === "ditolak" ? "DITOLAK" : "—",
      lulus === true ? "LULUS" : lulus === false ? "TIDAK LULUS" : "—",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [headerRow],
    body: bodyRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 30, halign: "center" },
      4: { cellWidth: 30, halign: "center" },
    },
    margin: { left: marginX, right: marginX },
  });

  // Summary
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total peserta dinilai: ${ranked.length}`, marginX, finalY);
  if (periode.skorMinimum) {
    const lulusCount = ranked.filter((p) => Number(p.skorAkhir) >= Number(periode.skorMinimum)).length;
    doc.text(`Lulus: ${lulusCount}  •  Tidak Lulus: ${ranked.length - lulusCount}`, marginX, finalY + 5);
  }

  doc.save(`rekap-tft-${periode.slug}.pdf`);
}
