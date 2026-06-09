"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, UserPlus, Check, X, AlertTriangle, Pencil, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateStatusPeriodeTft,
  updatePeriodeTft,
  type PeriodeTftRow,
} from "@/server/actions/tft/periode";
import {
  reviewPendaftar,
  convertToInstructor,
  type PendaftarTftRow,
} from "@/server/actions/tft/pendaftar";
import {
  createKriteria,
  updateKriteria,
  deleteKriteria,
  copyKriteriaFromPeriode,
  createPenilai,
  updatePenilai,
  deletePenilai,
  type KriteriaTftRow,
  type PenilaiTftRow,
  type NilaiTftRow,
} from "@/server/actions/tft/penilaian";
import { exportFormPenilaianPdf, exportRekapHasilPdf } from "@/components/tft/pdf-export";
import {
  createPertanyaan,
  updatePertanyaan,
  deletePertanyaan,
  type PertanyaanTftRow,
} from "@/server/actions/tft/pertanyaan";

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    baru: { label: "Baru", className: "bg-gray-100 text-gray-700 border-gray-200" },
    review: { label: "Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    diterima: { label: "Diterima", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    ditolak: { label: "Ditolak", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const cfg = map[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

interface TftDetailViewProps {
  periode: PeriodeTftRow;
  pendaftar: PendaftarTftRow[];
  kriteria: KriteriaTftRow[];
  penilai: PenilaiTftRow[];
  nilai: NilaiTftRow[];
  pertanyaan: PertanyaanTftRow[];
  periodeOptions: PeriodeTftRow[];
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tft";
}

function fileUrlFromStorageKey(key: string) {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function TftDetailView({
  periode,
  pendaftar,
  kriteria,
  penilai,
  nilai,
  pertanyaan,
  periodeOptions,
}: TftDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reviewTarget, setReviewTarget] = useState<PendaftarTftRow | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"diterima" | "ditolak">("diterima");
  const [reviewCatatan, setReviewCatatan] = useState("");

  // ─── EDIT PERIODE STATE ──────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editJudul, setEditJudul] = useState(periode.judul);
  const [editSlug, setEditSlug] = useState(periode.slug);
  const [editTanggalMulai, setEditTanggalMulai] = useState(periode.tanggalMulai);
  const [editTanggalSelesai, setEditTanggalSelesai] = useState(periode.tanggalSelesai);
  const [editWaktuMulai, setEditWaktuMulai] = useState(periode.waktuMulai ?? "");
  const [editWaktuSelesai, setEditWaktuSelesai] = useState(periode.waktuSelesai ?? "");
  const [editLokasi, setEditLokasi] = useState(periode.lokasi ?? "");
  const [editProgram, setEditProgram] = useState<"brevet_ab" | "brevet_c" | "all">(periode.program);
  const [editBatasPendaftaran, setEditBatasPendaftaran] = useState(
    periode.batasPendaftaran ? new Date(periode.batasPendaftaran).toISOString().slice(0, 16) : ""
  );
  const [editMaxPeserta, setEditMaxPeserta] = useState(periode.maxPeserta?.toString() ?? "");
  const [editSkorMinimum, setEditSkorMinimum] = useState(periode.skorMinimum ?? "");
  const [editCatatan, setEditCatatan] = useState(periode.catatanInternal ?? "");
  const [editDeskripsi, setEditDeskripsi] = useState(periode.deskripsi ?? "");

  // ─── KRITERIA STATE ──────────────────────────────────────────────────────
  const [kriteriaDialogOpen, setKriteriaDialogOpen] = useState(false);
  const [kriteriaEditTarget, setKriteriaEditTarget] = useState<KriteriaTftRow | null>(null);
  const [kriteriaNama, setKriteriaNama] = useState("");
  const [kriteriaDeskripsi, setKriteriaDeskripsi] = useState("");
  const [kriteriaBobot, setKriteriaBobot] = useState("");
  const [kriteriaSkorMin, setKriteriaSkorMin] = useState("0");
  const [kriteriaSkorMax, setKriteriaSkorMax] = useState("100");
  const [kriteriaUrutan, setKriteriaUrutan] = useState("0");
  const [copySourcePeriodeId, setCopySourcePeriodeId] = useState("");

  // ─── PENILAI STATE ───────────────────────────────────────────────────────
  const [penilaiDialogOpen, setPenilaiDialogOpen] = useState(false);
  const [penilaiEditTarget, setPenilaiEditTarget] = useState<PenilaiTftRow | null>(null);
  const [penilaiNama, setPenilaiNama] = useState("");
  const [penilaiJabatan, setPenilaiJabatan] = useState("");
  const [penilaiInstansi, setPenilaiInstansi] = useState("");
  const [penilaiCatatan, setPenilaiCatatan] = useState("");

  // ─── PERTANYAAN STATE ────────────────────────────────────────────────────
  const [pertanyaanDialogOpen, setPertanyaanDialogOpen] = useState(false);
  const [pertanyaanEditTarget, setPertanyaanEditTarget] = useState<PertanyaanTftRow | null>(null);
  const [pertanyaanLabel, setPertanyaanLabel] = useState("");
  const [pertanyaanDeskripsi, setPertanyaanDeskripsi] = useState("");
  const [pertanyaanTipe, setPertanyaanTipe] = useState<PertanyaanTftRow["tipe"]>("text");
  const [pertanyaanWajib, setPertanyaanWajib] = useState(false);
  const [pertanyaanOpsi, setPertanyaanOpsi] = useState("");
  const [pertanyaanUrutan, setPertanyaanUrutan] = useState("0");

  function handleStatusChange(newStatus: "buka" | "tutup" | "penilaian" | "selesai") {
    startTransition(async () => {
      const res = await updateStatusPeriodeTft(periode.id, newStatus);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Status diubah ke "${newStatus}".`);
      router.refresh();
    });
  }

  function handleReview() {
    if (!reviewTarget) return;
    startTransition(async () => {
      const res = await reviewPendaftar({
        id: reviewTarget.id,
        status: reviewStatus,
        catatanAdmin: reviewCatatan,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${reviewTarget.namaLengkap} ditandai ${reviewStatus}.`);
      setReviewTarget(null);
      setReviewCatatan("");
      router.refresh();
    });
  }

  function handleConvert(p: PendaftarTftRow) {
    startTransition(async () => {
      const res = await convertToInstructor(p.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${p.namaLengkap} berhasil ditambahkan sebagai instruktur.`);
      router.refresh();
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/daftar/tft/${periode.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link pendaftaran disalin.");
  }

  // ─── EDIT PERIODE HANDLER ────────────────────────────────────────────────
  function openEditDialog() {
    setEditJudul(periode.judul);
    setEditSlug(periode.slug);
    setEditTanggalMulai(periode.tanggalMulai);
    setEditTanggalSelesai(periode.tanggalSelesai);
    setEditWaktuMulai(periode.waktuMulai ?? "");
    setEditWaktuSelesai(periode.waktuSelesai ?? "");
    setEditLokasi(periode.lokasi ?? "");
    setEditProgram(periode.program);
    setEditBatasPendaftaran(
      periode.batasPendaftaran ? new Date(periode.batasPendaftaran).toISOString().slice(0, 16) : ""
    );
    setEditMaxPeserta(periode.maxPeserta?.toString() ?? "");
    setEditSkorMinimum(periode.skorMinimum ?? "");
    setEditCatatan(periode.catatanInternal ?? "");
    setEditDeskripsi(periode.deskripsi ?? "");
    setEditOpen(true);
  }

  function handleEditSave() {
    if (!editJudul.trim() || !editSlug.trim() || !editTanggalMulai || !editTanggalSelesai) {
      toast.error("Lengkapi field wajib.");
      return;
    }
    startTransition(async () => {
      const res = await updatePeriodeTft({
        id: periode.id,
        judul: editJudul,
        slug: editSlug,
        tanggalMulai: editTanggalMulai,
        tanggalSelesai: editTanggalSelesai,
        waktuMulai: editWaktuMulai || undefined,
        waktuSelesai: editWaktuSelesai || undefined,
        lokasi: editLokasi || undefined,
        program: editProgram,
        batasPendaftaran: editBatasPendaftaran || undefined,
        maxPeserta: editMaxPeserta ? parseInt(editMaxPeserta) : undefined,
        skorMinimum: editSkorMinimum ? parseFloat(editSkorMinimum) : undefined,
        catatanInternal: editCatatan || undefined,
        deskripsi: editDeskripsi || undefined,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Periode berhasil diperbarui.");
      setEditOpen(false);
      router.refresh();
    });
  }

  // ─── KRITERIA HANDLERS ───────────────────────────────────────────────────
  function openKriteriaCreate() {
    setKriteriaEditTarget(null);
    setKriteriaNama("");
    setKriteriaDeskripsi("");
    setKriteriaBobot("");
    setKriteriaSkorMin("0");
    setKriteriaSkorMax("100");
    setKriteriaUrutan(String(kriteria.length));
    setKriteriaDialogOpen(true);
  }

  function openKriteriaEdit(k: KriteriaTftRow) {
    setKriteriaEditTarget(k);
    setKriteriaNama(k.nama);
    setKriteriaDeskripsi(k.deskripsi ?? "");
    setKriteriaBobot(k.bobot);
    setKriteriaSkorMin(k.skorMin);
    setKriteriaSkorMax(k.skorMax);
    setKriteriaUrutan(String(k.urutan));
    setKriteriaDialogOpen(true);
  }

  function handleKriteriaSave() {
    if (!kriteriaNama.trim() || !kriteriaBobot) {
      toast.error("Nama dan bobot wajib diisi.");
      return;
    }
    startTransition(async () => {
      if (kriteriaEditTarget) {
        const res = await updateKriteria({
          id: kriteriaEditTarget.id,
          periodeId: periode.id,
          nama: kriteriaNama,
          deskripsi: kriteriaDeskripsi || undefined,
          bobot: Number(kriteriaBobot),
          skorMin: Number(kriteriaSkorMin),
          skorMax: Number(kriteriaSkorMax),
          urutan: Number(kriteriaUrutan),
        });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("Kriteria diperbarui.");
      } else {
        const res = await createKriteria({
          periodeId: periode.id,
          nama: kriteriaNama,
          deskripsi: kriteriaDeskripsi || undefined,
          bobot: Number(kriteriaBobot),
          skorMin: Number(kriteriaSkorMin),
          skorMax: Number(kriteriaSkorMax),
          urutan: Number(kriteriaUrutan),
        });
        if (!res.ok) { toast.error("Gagal membuat kriteria."); return; }
        toast.success("Kriteria ditambahkan.");
      }
      setKriteriaDialogOpen(false);
      router.refresh();
    });
  }

  function handleKriteriaDelete(k: KriteriaTftRow) {
    if (!confirm(`Hapus kriteria "${k.nama}"?`)) return;
    startTransition(async () => {
      const res = await deleteKriteria(k.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Kriteria dihapus.");
      router.refresh();
    });
  }

  function handleCopyKriteria() {
    if (!copySourcePeriodeId) {
      toast.error("Pilih periode sumber terlebih dahulu.");
      return;
    }
    if (kriteria.length > 0 && !confirm("Kriteria yang disalin akan ditambahkan ke daftar saat ini. Lanjutkan?")) {
      return;
    }
    startTransition(async () => {
      const res = await copyKriteriaFromPeriode(copySourcePeriodeId, periode.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.count} kriteria berhasil disalin.`);
      setCopySourcePeriodeId("");
      router.refresh();
    });
  }

  // ─── PENILAI HANDLERS ────────────────────────────────────────────────────
  function openPenilaiCreate() {
    setPenilaiEditTarget(null);
    setPenilaiNama("");
    setPenilaiJabatan("");
    setPenilaiInstansi("");
    setPenilaiCatatan("");
    setPenilaiDialogOpen(true);
  }

  function openPenilaiEdit(pn: PenilaiTftRow) {
    setPenilaiEditTarget(pn);
    setPenilaiNama(pn.nama);
    setPenilaiJabatan(pn.jabatan ?? "");
    setPenilaiInstansi(pn.instansi ?? "");
    setPenilaiCatatan(pn.catatan ?? "");
    setPenilaiDialogOpen(true);
  }

  function handlePenilaiSave() {
    if (!penilaiNama.trim()) {
      toast.error("Nama penilai wajib diisi.");
      return;
    }
    startTransition(async () => {
      if (penilaiEditTarget) {
        const res = await updatePenilai({
          id: penilaiEditTarget.id,
          periodeId: periode.id,
          nama: penilaiNama,
          jabatan: penilaiJabatan || undefined,
          instansi: penilaiInstansi || undefined,
          catatan: penilaiCatatan || undefined,
        });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("Penilai diperbarui.");
      } else {
        const res = await createPenilai({
          periodeId: periode.id,
          nama: penilaiNama,
          jabatan: penilaiJabatan || undefined,
          instansi: penilaiInstansi || undefined,
          catatan: penilaiCatatan || undefined,
        });
        if (!res.ok) { toast.error("Gagal menambah penilai."); return; }
        toast.success("Penilai ditambahkan.");
      }
      setPenilaiDialogOpen(false);
      router.refresh();
    });
  }

  function handlePenilaiDelete(pn: PenilaiTftRow) {
    if (!confirm(`Hapus penilai "${pn.nama}"?`)) return;
    startTransition(async () => {
      const res = await deletePenilai(pn.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Penilai dihapus.");
      router.refresh();
    });
  }

  // ─── PERTANYAAN HANDLERS ─────────────────────────────────────────────────
  function openPertanyaanCreate() {
    setPertanyaanEditTarget(null);
    setPertanyaanLabel("");
    setPertanyaanDeskripsi("");
    setPertanyaanTipe("text");
    setPertanyaanWajib(false);
    setPertanyaanOpsi("");
    setPertanyaanUrutan(String(pertanyaan.length));
    setPertanyaanDialogOpen(true);
  }

  function openPertanyaanEdit(p: PertanyaanTftRow) {
    setPertanyaanEditTarget(p);
    setPertanyaanLabel(p.label);
    setPertanyaanDeskripsi(p.deskripsi ?? "");
    setPertanyaanTipe(p.tipe);
    setPertanyaanWajib(p.wajib);
    setPertanyaanOpsi(p.opsi.join("\n"));
    setPertanyaanUrutan(String(p.urutan));
    setPertanyaanDialogOpen(true);
  }

  function handlePertanyaanSave() {
    if (!pertanyaanLabel.trim()) {
      toast.error("Label pertanyaan wajib diisi.");
      return;
    }
    const needsOpsi = ["radio", "checkbox", "select"].includes(pertanyaanTipe);
    const opsiArr = pertanyaanOpsi.split("\n").map((o) => o.trim()).filter(Boolean);
    if (needsOpsi && opsiArr.length < 2) {
      toast.error("Tipe ini memerlukan minimal 2 pilihan (satu per baris).");
      return;
    }

    startTransition(async () => {
      if (pertanyaanEditTarget) {
        const res = await updatePertanyaan({
          id: pertanyaanEditTarget.id,
          periodeId: periode.id,
          label: pertanyaanLabel,
          deskripsi: pertanyaanDeskripsi || undefined,
          tipe: pertanyaanTipe,
          wajib: pertanyaanWajib,
          opsi: needsOpsi ? opsiArr : undefined,
          urutan: Number(pertanyaanUrutan),
        });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("Pertanyaan diperbarui.");
      } else {
        const res = await createPertanyaan({
          periodeId: periode.id,
          label: pertanyaanLabel,
          deskripsi: pertanyaanDeskripsi || undefined,
          tipe: pertanyaanTipe,
          wajib: pertanyaanWajib,
          opsi: needsOpsi ? opsiArr : undefined,
          urutan: Number(pertanyaanUrutan),
        });
        if (!res.ok) { toast.error("Gagal membuat pertanyaan."); return; }
        toast.success("Pertanyaan ditambahkan.");
      }
      setPertanyaanDialogOpen(false);
      router.refresh();
    });
  }

  function handlePertanyaanDelete(p: PertanyaanTftRow) {
    if (!confirm(`Hapus pertanyaan "${p.label}"?`)) return;
    startTransition(async () => {
      const res = await deletePertanyaan(p.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Pertanyaan dihapus.");
      router.refresh();
    });
  }

  // ─── PDF EXPORT HANDLERS ─────────────────────────────────────────────────
  function handleCetakFormPenilaian(pn: PenilaiTftRow) {
    exportFormPenilaianPdf({
      periode,
      penilai: pn,
      pendaftar,
      kriteria,
    });
    toast.success(`PDF form penilaian untuk ${pn.nama} sedang diunduh.`);
  }

  function handleCetakRekapHasil() {
    exportRekapHasilPdf({
      periode,
      pendaftar,
      kriteria,
    });
    toast.success("PDF rekap hasil sedang diunduh.");
  }

  function getSkorPenilai(pendaftarId: string, penilaiId: string) {
    const nilaiPenilai = nilai.filter((n) => n.pendaftarId === pendaftarId && n.penilaiId === penilaiId);
    if (nilaiPenilai.length === 0) return "";

    let weightedSum = 0;
    let bobotUsed = 0;
    for (const k of kriteria) {
      const nilaiKriteria = nilaiPenilai.find((n) => n.kriteriaId === k.id);
      if (!nilaiKriteria) continue;
      weightedSum += Number(nilaiKriteria.skor) * Number(k.bobot);
      bobotUsed += Number(k.bobot);
    }

    return bobotUsed > 0 ? (weightedSum / bobotUsed).toFixed(2) : "";
  }

  async function handleExportPendaftarExcel() {
    if (pendaftar.length === 0) {
      toast.error("Belum ada pendaftar untuk diekspor.");
      return;
    }

    const XLSX = await import("xlsx");
    const rows = pendaftar.map((p) => ({
      Nama: p.namaLengkap,
      Email: p.email,
      "No HP": p.noHp,
      Pekerjaan: p.pekerjaan ?? "",
      "Alamat Pekerjaan": p.alamatPekerjaan ?? "",
      "Alamat Domisili": p.alamatDomisili ?? "",
      "Materi Brevet AB": p.materiBrevetAb.join("; "),
      "Materi Brevet C": p.materiBrevetC.join("; "),
      "Bersedia Hadir": p.bersediaHadir ? "Ya" : "Tidak",
      Status: p.status,
      "Skor Akhir": p.skorAkhir ?? "",
      "Nama CV": p.cvOriginalName ?? "",
      "Storage Key CV": p.cvStorageKey ?? "",
      "Tanggal Submit": p.submittedAt ? new Date(p.submittedAt).toLocaleString("id-ID") : "",
      "Catatan Admin": p.catatanAdmin ?? "",
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pendaftar");
    XLSX.writeFile(workbook, `pendaftar-${safeFileName(periode.slug)}.xlsx`);
  }

  async function handleExportRekapExcel() {
    const ranked = pendaftar
      .filter((p) => p.skorAkhir)
      .sort((a, b) => Number(b.skorAkhir) - Number(a.skorAkhir));
    if (ranked.length === 0) {
      toast.error("Belum ada hasil penilaian untuk diekspor.");
      return;
    }

    const XLSX = await import("xlsx");
    const rows = ranked.map((p, idx) => {
      const lulus = periode.skorMinimum
        ? Number(p.skorAkhir) >= Number(periode.skorMinimum)
        : null;
      const row: Record<string, string | number> = {
        Ranking: idx + 1,
        Nama: p.namaLengkap,
        Email: p.email,
        "Skor Akhir": p.skorAkhir ?? "",
        Status: p.status,
        Kelulusan: lulus == null ? "" : lulus ? "Lulus" : "Tidak Lulus",
      };
      for (const pn of penilai) {
        row[`Skor ${pn.nama}`] = getSkorPenilai(p.id, pn.id);
      }
      return row;
    });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Hasil");
    XLSX.writeFile(workbook, `rekap-hasil-${safeFileName(periode.slug)}.xlsx`);
  }

  function handleTerimaSemuaLulus() {
    if (!periode.skorMinimum) {
      toast.error("Set skor minimum terlebih dahulu di edit periode.");
      return;
    }

    const targets = pendaftar.filter(
      (p) =>
        p.skorAkhir &&
        Number(p.skorAkhir) >= Number(periode.skorMinimum) &&
        !p.instructorId,
    );

    if (targets.length === 0) {
      toast.error("Tidak ada peserta lulus yang belum menjadi instruktur.");
      return;
    }
    if (!confirm(`Terima dan konversi ${targets.length} peserta lulus menjadi instruktur?`)) {
      return;
    }

    startTransition(async () => {
      let success = 0;
      let failed = 0;
      for (const p of targets) {
        const res = await convertToInstructor(p.id);
        if (res.ok) success++;
        else failed++;
      }

      if (failed > 0) {
        toast.error(`${success} berhasil, ${failed} gagal dikonversi.`);
      } else {
        toast.success(`${success} peserta lulus diterima dan dikonversi.`);
      }
      router.refresh();
    });
  }

  const statusCounts = {
    baru: pendaftar.filter((p) => p.status === "baru").length,
    review: pendaftar.filter((p) => p.status === "review").length,
    diterima: pendaftar.filter((p) => p.status === "diterima").length,
    ditolak: pendaftar.filter((p) => p.status === "ditolak").length,
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="h-4 w-4" />
              Edit Periode
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              Salin Link Form
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/daftar/tft/${periode.slug}?preview=1`, "_blank")}
            >
              Lihat Form
            </Button>
            {periode.status === "draft" && (
              <Button size="sm" onClick={() => handleStatusChange("buka")} disabled={isPending}>
                Buka Pendaftaran
              </Button>
            )}
            {periode.status === "buka" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("tutup")} disabled={isPending}>
                Tutup Pendaftaran
              </Button>
            )}
            {periode.status === "tutup" && (
              <Button size="sm" onClick={() => handleStatusChange("penilaian")} disabled={isPending}>
                Mulai Penilaian
              </Button>
            )}
            {periode.status === "penilaian" && (
              <Button size="sm" onClick={() => handleStatusChange("selesai")} disabled={isPending}>
                Selesaikan Periode
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Baru: <strong>{statusCounts.baru}</strong></span>
            <span>Review: <strong>{statusCounts.review}</strong></span>
            <span>Diterima: <strong className="text-emerald-600">{statusCounts.diterima}</strong></span>
            <span>Ditolak: <strong className="text-red-600">{statusCounts.ditolak}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pendaftar">
        <TabsList>
          <TabsTrigger value="pendaftar">Pendaftar ({pendaftar.length})</TabsTrigger>
          <TabsTrigger value="form">Form ({pertanyaan.length})</TabsTrigger>
          <TabsTrigger value="penilaian">Penilaian</TabsTrigger>
          <TabsTrigger value="hasil">Hasil</TabsTrigger>
        </TabsList>

        {/* Tab: Pendaftar */}
        <TabsContent value="pendaftar" className="mt-4">
          <Card className="rounded-[24px]">
            <CardContent className="pt-6">
              {pendaftar.length > 0 && (
                <div className="mb-4 flex items-center justify-end">
                  <Button variant="outline" size="sm" onClick={handleExportPendaftarExcel}>
                    <Download className="h-4 w-4" />
                    Export Pendaftar
                  </Button>
                </div>
              )}
              {pendaftar.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada pendaftar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>No HP</TableHead>
                        <TableHead>Materi</TableHead>
                        <TableHead>CV</TableHead>
                        <TableHead>Hadir</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Skor</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendaftar.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.namaLengkap}</TableCell>
                          <TableCell className="text-sm">{p.email}</TableCell>
                          <TableCell className="text-sm">{p.noHp}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.materiBrevetAb.slice(0, 2).map((m) => (
                                <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                              ))}
                              {p.materiBrevetAb.length > 2 && (
                                <Badge variant="secondary" className="text-[10px]">+{p.materiBrevetAb.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {p.cvStorageKey ? (
                              <Button variant="ghost" size="icon-sm" asChild title={p.cvOriginalName ?? "Download CV"}>
                                <a
                                  href={fileUrlFromStorageKey(p.cvStorageKey)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{p.bersediaHadir ? "Ya" : "Tidak"}</TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                          <TableCell className="text-sm">{p.skorAkhir ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.status !== "diterima" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-emerald-600"
                                  onClick={() => { setReviewTarget(p); setReviewStatus("diterima"); }}
                                  title="Terima"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              {p.status !== "ditolak" && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-red-600"
                                  onClick={() => { setReviewTarget(p); setReviewStatus("ditolak"); }}
                                  title="Tolak"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {p.status === "diterima" && !p.instructorId && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleConvert(p)}
                                  disabled={isPending}
                                  title="Tambah ke Instruktur"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Form (Dynamic Questions) */}
        <TabsContent value="form" className="mt-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pertanyaan Tambahan</CardTitle>
                  <CardDescription>
                    Kelola pertanyaan custom di form pendaftaran publik. Pertanyaan ini muncul setelah field bawaan (nama, email, dst).
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openPertanyaanCreate}>
                  Tambah Pertanyaan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pertanyaan.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada pertanyaan tambahan. Form hanya menampilkan field bawaan.
                </p>
              ) : (
                <div className="space-y-2">
                  {pertanyaan.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{p.label}</p>
                          {p.wajib && <Badge variant="destructive" className="text-[10px]">Wajib</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{p.tipe}</Badge>
                          {p.opsi.length > 0 && <span>{p.opsi.length} pilihan</span>}
                          {p.deskripsi && <span className="truncate max-w-[200px]">— {p.deskripsi}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button variant="ghost" size="icon-sm" onClick={() => openPertanyaanEdit(p)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => handlePertanyaanDelete(p)} title="Hapus">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Penilaian */}
        <TabsContent value="penilaian" className="mt-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>Kriteria & Penilai</CardTitle>
              <CardDescription>
                Kelola kriteria penilaian dan data penilai. Input nilai di halaman terpisah.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Kriteria Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Kriteria Penilaian ({kriteria.length})</h3>
                  <div className="flex items-center gap-2">
                    {periodeOptions.length > 0 && (
                      <>
                        <Select value={copySourcePeriodeId} onValueChange={setCopySourcePeriodeId}>
                          <SelectTrigger className="h-8 w-48">
                            <SelectValue placeholder="Salin dari periode..." />
                          </SelectTrigger>
                          <SelectContent>
                            {periodeOptions.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.judul}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyKriteria}
                          disabled={isPending || !copySourcePeriodeId}
                        >
                          Salin
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={openKriteriaCreate}>
                      Tambah Kriteria
                    </Button>
                  </div>
                </div>
                {kriteria.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada kriteria. Tambahkan kriteria untuk memulai penilaian.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {kriteria.map((k) => (
                        <div key={k.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{k.nama}</p>
                            {k.deskripsi && <p className="text-xs text-muted-foreground">{k.deskripsi}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{k.bobot}%</Badge>
                            <Button variant="ghost" size="icon-sm" onClick={() => openKriteriaEdit(k)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => handleKriteriaDelete(k)} title="Hapus">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const totalBobot = kriteria.reduce((sum, k) => sum + Number(k.bobot), 0);
                      return totalBobot !== 100 ? (
                        <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Total bobot: {totalBobot}% (harus 100%)
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-600">Total bobot: 100% ✓</p>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Penilai Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Penilai ({penilai.length})</h3>
                  <Button variant="outline" size="sm" onClick={openPenilaiCreate}>
                    Tambah Penilai
                  </Button>
                </div>
                {penilai.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada penilai.</p>
                ) : (
                  <div className="space-y-2">
                    {penilai.map((pn) => (
                      <div key={pn.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{pn.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {[pn.jabatan, pn.instansi].filter(Boolean).join(" — ") || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {kriteria.length > 0 && pendaftar.length > 0 && (
                            <Button variant="ghost" size="icon-sm" onClick={() => handleCetakFormPenilaian(pn)} title="Cetak form penilaian">
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon-sm" onClick={() => openPenilaiEdit(pn)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => handlePenilaiDelete(pn)} title="Hapus">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {kriteria.length > 0 && penilai.length > 0 && pendaftar.length > 0 && (
                <Button
                  onClick={() => router.push(`/jadwal-otomatis/tft/${periode.id}/input-nilai`)}
                >
                  Input Nilai
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Hasil */}
        <TabsContent value="hasil" className="mt-4">
          <Card className="rounded-[24px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rekap Hasil Penilaian</CardTitle>
                  <CardDescription>
                    Ranking peserta berdasarkan skor akhir.
                    {periode.skorMinimum && ` Threshold kelulusan: ${periode.skorMinimum}`}
                  </CardDescription>
                </div>
                {pendaftar.filter((p) => p.skorAkhir).length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {periode.skorMinimum && (
                      <Button variant="outline" size="sm" onClick={handleTerimaSemuaLulus} disabled={isPending}>
                        <UserPlus className="h-4 w-4" />
                        Terima yang Lulus
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExportRekapExcel}>
                      <Download className="h-4 w-4" />
                      Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCetakRekapHasil}>
                      <FileDown className="h-4 w-4" />
                      Cetak Rekap PDF
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {pendaftar.filter((p) => p.skorAkhir).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada hasil penilaian. Input nilai terlebih dahulu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Nama</TableHead>
                        {penilai.map((pn) => (
                          <TableHead key={pn.id}>Skor {pn.nama}</TableHead>
                        ))}
                        <TableHead>Skor Akhir</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendaftar
                        .filter((p) => p.skorAkhir)
                        .sort((a, b) => Number(b.skorAkhir) - Number(a.skorAkhir))
                        .map((p, idx) => {
                          const lulus = periode.skorMinimum
                            ? Number(p.skorAkhir) >= Number(periode.skorMinimum)
                            : null;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{idx + 1}</TableCell>
                              <TableCell>{p.namaLengkap}</TableCell>
                              {penilai.map((pn) => (
                                <TableCell key={pn.id} className="text-sm">
                                  {getSkorPenilai(p.id, pn.id) || "-"}
                                </TableCell>
                              ))}
                              <TableCell>
                                <span className={lulus === false ? "text-red-600" : lulus === true ? "text-emerald-600 font-medium" : ""}>
                                  {p.skorAkhir}
                                </span>
                              </TableCell>
                              <TableCell>{statusBadge(p.status)}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewStatus === "diterima" ? "Terima" : "Tolak"} Pendaftar
            </DialogTitle>
            <DialogDescription>
              {reviewTarget?.namaLengkap} akan ditandai sebagai{" "}
              <strong>{reviewStatus}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">Catatan (opsional)</p>
            <Textarea
              placeholder="Catatan untuk keputusan ini..."
              value={reviewCatatan}
              onChange={(e) => setReviewCatatan(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={isPending}>
              Batal
            </Button>
            <Button
              variant={reviewStatus === "ditolak" ? "destructive" : "default"}
              onClick={handleReview}
              disabled={isPending}
            >
              {isPending ? "Memproses..." : reviewStatus === "diterima" ? "Terima" : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Periode Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Periode TFT</DialogTitle>
            <DialogDescription>Perbarui informasi periode TFT.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Judul *</p>
              <Input value={editJudul} onChange={(e) => setEditJudul(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Slug (URL) *</p>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Program Target *</p>
              <Select value={editProgram} onValueChange={(v) => setEditProgram(v as typeof editProgram)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brevet_ab">Brevet AB</SelectItem>
                  <SelectItem value="brevet_c">Brevet C</SelectItem>
                  <SelectItem value="all">Semua Program</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tanggal Mulai *</p>
                <Input type="date" value={editTanggalMulai} onChange={(e) => setEditTanggalMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Tanggal Selesai *</p>
                <Input type="date" value={editTanggalSelesai} onChange={(e) => setEditTanggalSelesai(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Waktu Mulai</p>
                <Input type="time" value={editWaktuMulai} onChange={(e) => setEditWaktuMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Waktu Selesai</p>
                <Input type="time" value={editWaktuSelesai} onChange={(e) => setEditWaktuSelesai(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Lokasi</p>
              <Input value={editLokasi} onChange={(e) => setEditLokasi(e.target.value)} placeholder="Kantor IAI Jakarta" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Batas Pendaftaran</p>
              <Input type="datetime-local" value={editBatasPendaftaran} onChange={(e) => setEditBatasPendaftaran(e.target.value)} />
              <p className="text-xs text-muted-foreground">Form otomatis tertutup setelah waktu ini.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Max Peserta</p>
                <Input type="number" min="1" value={editMaxPeserta} onChange={(e) => setEditMaxPeserta(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Skor Minimum Lulus</p>
                <Input type="number" min="0" max="100" step="0.01" value={editSkorMinimum} onChange={(e) => setEditSkorMinimum(e.target.value)} placeholder="Misal: 70" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Deskripsi (tampil di form publik)</p>
              <Textarea value={editDeskripsi} onChange={(e) => setEditDeskripsi(e.target.value)} rows={4} placeholder="Deskripsi kegiatan TFT..." />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Catatan Internal (admin only)</p>
              <Textarea value={editCatatan} onChange={(e) => setEditCatatan(e.target.value)} rows={2} placeholder="Catatan internal..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={handleEditSave} disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kriteria Dialog */}
      <Dialog open={kriteriaDialogOpen} onOpenChange={setKriteriaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{kriteriaEditTarget ? "Edit" : "Tambah"} Kriteria Penilaian</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Nama Kriteria *</p>
              <Input value={kriteriaNama} onChange={(e) => setKriteriaNama(e.target.value)} placeholder="Penguasaan Materi" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Deskripsi</p>
              <Textarea value={kriteriaDeskripsi} onChange={(e) => setKriteriaDeskripsi(e.target.value)} rows={2} placeholder="Penjelasan kriteria..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Bobot (%) *</p>
                <Input type="number" min="0.01" max="100" step="0.01" value={kriteriaBobot} onChange={(e) => setKriteriaBobot(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Skor Min</p>
                <Input type="number" min="0" value={kriteriaSkorMin} onChange={(e) => setKriteriaSkorMin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Skor Max</p>
                <Input type="number" min="1" value={kriteriaSkorMax} onChange={(e) => setKriteriaSkorMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Urutan</p>
              <Input type="number" min="0" value={kriteriaUrutan} onChange={(e) => setKriteriaUrutan(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKriteriaDialogOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={handleKriteriaSave} disabled={isPending}>
              {isPending ? "Menyimpan..." : kriteriaEditTarget ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Penilai Dialog */}
      <Dialog open={penilaiDialogOpen} onOpenChange={setPenilaiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{penilaiEditTarget ? "Edit" : "Tambah"} Penilai</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Nama Penilai *</p>
              <Input value={penilaiNama} onChange={(e) => setPenilaiNama(e.target.value)} placeholder="Dr. Ahmad Fauzi" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Jabatan</p>
              <Input value={penilaiJabatan} onChange={(e) => setPenilaiJabatan(e.target.value)} placeholder="Konsultan Pajak Senior" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Instansi</p>
              <Input value={penilaiInstansi} onChange={(e) => setPenilaiInstansi(e.target.value)} placeholder="KAP ABC" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Catatan</p>
              <Textarea value={penilaiCatatan} onChange={(e) => setPenilaiCatatan(e.target.value)} rows={2} placeholder="Catatan opsional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPenilaiDialogOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={handlePenilaiSave} disabled={isPending}>
              {isPending ? "Menyimpan..." : penilaiEditTarget ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pertanyaan Dialog */}
      <Dialog open={pertanyaanDialogOpen} onOpenChange={setPertanyaanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pertanyaanEditTarget ? "Edit" : "Tambah"} Pertanyaan</DialogTitle>
            <DialogDescription>
              Pertanyaan custom yang muncul di form pendaftaran publik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Label Pertanyaan *</p>
              <Input value={pertanyaanLabel} onChange={(e) => setPertanyaanLabel(e.target.value)} placeholder="Pengalaman mengajar?" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Teks Bantuan</p>
              <Input value={pertanyaanDeskripsi} onChange={(e) => setPertanyaanDeskripsi(e.target.value)} placeholder="Helper text di bawah field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tipe *</p>
                <Select value={pertanyaanTipe} onValueChange={(v) => setPertanyaanTipe(v as PertanyaanTftRow["tipe"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Teks singkat</SelectItem>
                    <SelectItem value="textarea">Teks panjang</SelectItem>
                    <SelectItem value="number">Angka</SelectItem>
                    <SelectItem value="radio">Pilihan tunggal</SelectItem>
                    <SelectItem value="checkbox">Pilihan ganda</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="file">Upload file</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Urutan</p>
                <Input type="number" min="0" value={pertanyaanUrutan} onChange={(e) => setPertanyaanUrutan(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pertanyaan-wajib"
                checked={pertanyaanWajib}
                onChange={(e) => setPertanyaanWajib(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="pertanyaan-wajib" className="text-sm">Wajib diisi</label>
            </div>
            {["radio", "checkbox", "select"].includes(pertanyaanTipe) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Pilihan (satu per baris) *</p>
                <Textarea
                  value={pertanyaanOpsi}
                  onChange={(e) => setPertanyaanOpsi(e.target.value)}
                  rows={4}
                  placeholder={"Pilihan 1\nPilihan 2\nPilihan 3"}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPertanyaanDialogOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={handlePertanyaanSave} disabled={isPending}>
              {isPending ? "Menyimpan..." : pertanyaanEditTarget ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
