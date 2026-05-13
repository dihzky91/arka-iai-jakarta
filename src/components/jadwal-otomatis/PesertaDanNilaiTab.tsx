"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardPaste, Download, FileDown, Loader2, Plus, Search, Trash2, Upload, UserRoundX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  bulkDeletePesertaIfClean,
  bulkImportPeserta,
  bulkMovePesertaToKelas,
  bulkUpdateStatusEnrollment,
  enrollPeserta,
  getPesertaByKelas,
  updateStatusEnrollment,
} from "@/server/actions/jadwal-otomatis/peserta/enrollment";
import { listKelasOtomatis } from "@/server/actions/jadwal-otomatis/kelasOtomatis";
import { inputAbsensiPelatihan, getAbsensiByKelas } from "@/server/actions/jadwal-otomatis/peserta/absensi-pelatihan";
import { getAbsensiUjianByKelas } from "@/server/actions/jadwal-otomatis/peserta/absensi-ujian";
import { inputNilaiUjian, inputNilaiPerbaikan, getNilaiByKelas } from "@/server/actions/jadwal-otomatis/peserta/nilai-ujian";
import { ajukanUjianSusulan } from "@/server/actions/jadwal-otomatis/peserta/ujian-susulan";
import { exportRekapKelas } from "@/server/actions/jadwal-otomatis/peserta/export-rekap";
import type { Peserta, SesiPelatihan, SesiUjian, AbsensiRow, AbsensiUjianRow, NilaiRow, DuplicateStrategy, ImportPesertaRow, KelasOption, DeactivateDialogState } from "./peserta-tab/types";
import { PESERTA_PAGE_SIZE_OPTIONS, mapImportRecord, parsePastedRows, buildImportPreview } from "./peserta-tab/utils";
import { StatusBadge } from "./peserta-tab/StatusBadge";
import { PesertaImportDialog } from "./peserta-tab/PesertaImportDialog";
import { AbsensiPelatihanSection } from "./peserta-tab/AbsensiPelatihanSection";
import { NilaiUjianSection } from "./peserta-tab/NilaiUjianSection";
import { RekapSection } from "./peserta-tab/RekapSection";

// ─── Props ────────────────────────────────────────────────

interface PesertaDanNilaiTabProps {
  kelasId: string;
  canManage: boolean;
}

// ─── Component ────────────────────────────────────────────

export function PesertaDanNilaiTab({ kelasId, canManage }: PesertaDanNilaiTabProps) {
  const [isPending, start] = useTransition();
  const [exportPending, startExport] = useTransition();

  // Daftar Peserta state
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [newPesertaRows, setNewPesertaRows] = useState<{ nama: string; nomorPeserta?: string }[]>([
    { nama: "", nomorPeserta: "" },
  ]);
  const [showTambah, setShowTambah] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importRows, setImportRows] = useState<ImportPesertaRow[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("skip");
  const [searchTerm, setSearchTerm] = useState("");
  const [pesertaPage, setPesertaPage] = useState(1);
  const [pesertaPageSize, setPesertaPageSize] = useState(25);
  const [selectedPesertaIds, setSelectedPesertaIds] = useState<string[]>([]);
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([]);
  const [moveTargetKelasId, setMoveTargetKelasId] = useState("");
  const [deactivateDialog, setDeactivateDialog] = useState<DeactivateDialogState | null>(null);

  // Absensi Pelatihan state
  const [absensiData, setAbsensiData] = useState<{
    pesertaList: Peserta[]; sesiList: SesiPelatihan[]; absensiList: AbsensiRow[];
  } | null>(null);
  const [quickAbsensiScope, setQuickAbsensiScope] = useState<"all" | "session" | "peserta">("session");
  const [quickAbsensiSessionId, setQuickAbsensiSessionId] = useState("");
  const [quickAbsensiPesertaId, setQuickAbsensiPesertaId] = useState("");
  const [quickAbsensiStatus, setQuickAbsensiStatus] = useState<"hadir" | "tidak_hadir">("hadir");

  // Absensi & Nilai Ujian state
  const [nilaiData, setNilaiData] = useState<{
    pesertaList: Peserta[]; ujianList: SesiUjian[]; nilaiList: NilaiRow[];
  } | null>(null);
  const [absensiUjianData, setAbsensiUjianData] = useState<{
    pesertaList: Peserta[]; ujianList: SesiUjian[]; absensiList: AbsensiUjianRow[];
  } | null>(null);

  // Inline form states
  const [perbaikanEdit, setPerbaikanEdit] = useState<{
    pesertaId: string; jadwalUjianId: string; mapel: string; perbaikanDariId: string; nilai: "A" | "B" | "C";
  } | null>(null);
  const [susulanEdit, setSusulanEdit] = useState<{
    pesertaId: string; jadwalUjianId: string; tanggal: string;
  } | null>(null);

  // ─── Handlers ───────────────────────────────────────────

  const loadPeserta = useCallback(() => {
    start(async () => {
      const data = await getPesertaByKelas(kelasId);
      setPesertaList(data as unknown as Peserta[]);
      setSelectedPesertaIds([]);
    });
  }, [kelasId]);

  useEffect(() => {
    loadPeserta();
  }, [loadPeserta]);

  useEffect(() => {
    if (!canManage) return;
    start(async () => {
      const rows = await listKelasOtomatis();
      setKelasOptions(rows
        .filter((row) => row.id !== kelasId && row.status === "active")
        .map((row) => ({
          id: row.id,
          namaKelas: row.namaKelas,
          programName: row.programName,
          status: row.status,
        })));
    });
  }, [canManage, kelasId]);

  const handleEnroll = useCallback(() => {
    const valid = newPesertaRows.filter((r) => r.nama.trim());
    if (valid.length === 0) { toast.error("Isi minimal satu nama peserta."); return; }
    start(async () => {
      const result = await enrollPeserta(kelasId, valid);
      if (result.ok) {
        toast.success(`${result.data.length} peserta ditambahkan.`);
        setNewPesertaRows([{ nama: "", nomorPeserta: "" }]);
        setShowTambah(false);
        loadPeserta();
      } else {
        toast.error(result.error);
      }
    });
  }, [kelasId, newPesertaRows, loadPeserta]);

  const openDeactivatePesertaDialog = useCallback((peserta: Peserta) => {
    setDeactivateDialog({
      pesertaIds: [peserta.id],
      title: "Nonaktifkan peserta?",
      description: `Peserta "${peserta.nama}" akan dinonaktifkan dari kelas ini. Data historis seperti absensi dan nilai tetap disimpan.`,
    });
  }, []);

  const confirmDeactivatePeserta = useCallback(() => {
    if (!deactivateDialog) return;

    start(async () => {
      const result = deactivateDialog.pesertaIds.length === 1
        ? await updateStatusEnrollment(deactivateDialog.pesertaIds[0]!, "mengundurkan_diri")
        : await bulkUpdateStatusEnrollment(deactivateDialog.pesertaIds, "mengundurkan_diri");
      if (result.ok) {
        toast.success(
          deactivateDialog.pesertaIds.length === 1
            ? "Peserta dinonaktifkan."
            : `${deactivateDialog.pesertaIds.length} peserta dinonaktifkan.`,
        );
        setDeactivateDialog(null);
        loadPeserta();
      } else {
        toast.error(result.error);
      }
    });
  }, [deactivateDialog, loadPeserta]);

  const handleDownloadPesertaTemplate = useCallback(() => {
    startExport(async () => {
      const XLSX = await import("xlsx");
      const rows = [
        { nama: "Contoh Peserta", nomor_peserta: "AB-001", email: "peserta@example.com", telepon: "08123456789", catatan: "" },
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Template Peserta");
      XLSX.writeFile(wb, "template-import-peserta.xlsx");
    });
  }, [startExport]);

  const handlePesertaFileImport = useCallback((file: File | null) => {
    if (!file) return;
    start(async () => {
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          toast.error("File tidak memiliki sheet.");
          return;
        }

        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet]!, {
          defval: "",
        });
        const rows = records.map(mapImportRecord).filter((row) =>
          [row.nama, row.nomorPeserta, row.email, row.telepon, row.catatan].some(Boolean),
        );
        setImportRows(rows);
        setShowImport(true);
        toast.success(`${rows.length} baris dimuat untuk preview.`);
      } catch {
        toast.error("Gagal membaca file import.");
      }
    });
  }, []);

  const handlePastePreview = useCallback(() => {
    const rows = parsePastedRows(pasteText);
    setImportRows(rows);
    setShowImport(true);
    toast.success(`${rows.length} baris paste dimuat untuk preview.`);
  }, [pasteText]);

  const handleBulkImportPeserta = useCallback(() => {
    const rowsToImport = buildImportPreview(importRows, pesertaList, duplicateStrategy)
      .filter((row) => row.status === "valid" || row.status === "update")
      .map(({ rowNumber, status, issues, ...row }) => row);

    if (rowsToImport.length === 0) {
      toast.error("Tidak ada baris valid untuk diimport.");
      return;
    }

    start(async () => {
      const result = await bulkImportPeserta(kelasId, rowsToImport, duplicateStrategy);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { inserted, updated, skipped } = result.data;
      toast.success(`${inserted.length} ditambahkan, ${updated.length} diperbarui, ${skipped.length} dilewati.`);
      setImportRows([]);
      setPasteText("");
      setShowImport(false);
      loadPeserta();
    });
  }, [duplicateStrategy, importRows, kelasId, loadPeserta, pesertaList]);

  const handleBulkDeactivatePeserta = useCallback(() => {
    if (selectedPesertaIds.length === 0) {
      toast.error("Pilih peserta terlebih dahulu.");
      return;
    }

    setDeactivateDialog({
      pesertaIds: selectedPesertaIds,
      title: "Nonaktifkan peserta terpilih?",
      description: `${selectedPesertaIds.length} peserta akan dinonaktifkan dari kelas ini. Data historis seperti absensi dan nilai tetap disimpan.`,
    });
  }, [selectedPesertaIds]);

  const handleBulkMovePeserta = useCallback(() => {
    if (selectedPesertaIds.length === 0) {
      toast.error("Pilih peserta terlebih dahulu.");
      return;
    }
    if (!moveTargetKelasId) {
      toast.error("Pilih kelas tujuan.");
      return;
    }

    start(async () => {
      const result = await bulkMovePesertaToKelas(selectedPesertaIds, moveTargetKelasId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.data.length} peserta dipindahkan.`);
      setSelectedPesertaIds([]);
      setMoveTargetKelasId("");
      loadPeserta();
    });
  }, [loadPeserta, moveTargetKelasId, selectedPesertaIds]);

  const handleBulkDeleteCleanPeserta = useCallback(() => {
    if (selectedPesertaIds.length === 0) {
      toast.error("Pilih peserta terlebih dahulu.");
      return;
    }
    if (!window.confirm("Hapus permanen peserta terpilih yang belum punya absensi/nilai?")) {
      return;
    }

    start(async () => {
      const result = await bulkDeletePesertaIfClean(selectedPesertaIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.data.length} peserta dihapus.`);
      setSelectedPesertaIds([]);
      loadPeserta();
    });
  }, [loadPeserta, selectedPesertaIds]);

  const handleExportPeserta = useCallback(() => {
    startExport(async () => {
      const term = searchTerm.trim().toLowerCase();
      const rowsFromFilter = term
        ? pesertaList.filter((p) =>
            [p.nama, p.nomorPeserta, p.email, p.telepon, p.catatan]
              .some((value) => value?.toLowerCase().includes(term)),
          )
        : pesertaList;
      const rowsToExport = selectedPesertaIds.length > 0
        ? pesertaList.filter((p) => selectedPesertaIds.includes(p.id))
        : rowsFromFilter;
      if (rowsToExport.length === 0) {
        toast.info("Tidak ada data peserta untuk diexport.");
        return;
      }

      const XLSX = await import("xlsx");
      const rows = rowsToExport.map((p, index) => ({
        No: index + 1,
        Nama: p.nama,
        "No Peserta": p.nomorPeserta ?? "",
        Email: p.email ?? "",
        Telepon: p.telepon ?? "",
        Catatan: p.catatan ?? "",
        Status: p.statusEnrollment,
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Peserta");
      XLSX.writeFile(wb, `peserta-kelas-${kelasId.slice(0, 8)}.xlsx`);
    });
  }, [kelasId, pesertaList, searchTerm, selectedPesertaIds, startExport]);

  const togglePesertaSelection = useCallback((pesertaId: string, checked: boolean) => {
    setSelectedPesertaIds((current) =>
      checked ? [...new Set([...current, pesertaId])] : current.filter((id) => id !== pesertaId),
    );
  }, []);

  const toggleCurrentPageSelection = useCallback((checked: boolean) => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? pesertaList.filter((p) =>
          [p.nama, p.nomorPeserta, p.email, p.telepon, p.catatan]
            .some((value) => value?.toLowerCase().includes(term)),
        )
      : pesertaList;
    const startIndex = (pesertaPage - 1) * pesertaPageSize;
    const pageIds = filtered.slice(startIndex, startIndex + pesertaPageSize).map((p) => p.id);
    setSelectedPesertaIds((current) =>
      checked
        ? [...new Set([...current, ...pageIds])]
        : current.filter((id) => !pageIds.includes(id)),
    );
  }, [pesertaList, pesertaPage, pesertaPageSize, searchTerm]);

  const loadAbsensiPelatihan = useCallback(() => {
    start(async () => {
      const data = await getAbsensiByKelas(kelasId);
      setAbsensiData(data as unknown as typeof absensiData);
    });
  }, [kelasId]);

  const handleAbsensiToggle = useCallback(
    (pesertaId: string, sessionId: string, currentHadir: boolean | undefined) => {
      if (!canManage) return;
      const newHadir = !currentHadir;
      start(async () => {
        const result = await inputAbsensiPelatihan(
          sessionId,
          [{ pesertaId, hadir: newHadir }],
        );
        if (result.ok) {
          loadAbsensiPelatihan();
          toast.success("Absensi disimpan.");
        } else {
          toast.error(result.error);
        }
      });
    },
    [canManage, loadAbsensiPelatihan]
  );

  const handleBulkAbsensiBySession = useCallback(
    (sessionId: string, hadir: boolean) => {
      if (!canManage || !absensiData) return;
      if (absensiData.pesertaList.length === 0) {
        toast.info("Belum ada peserta untuk diubah.");
        return;
      }

      start(async () => {
        const result = await inputAbsensiPelatihan(
          sessionId,
          absensiData.pesertaList.map((p) => ({ pesertaId: p.id, hadir })),
        );
        if (result.ok) {
          loadAbsensiPelatihan();
          toast.success(`Sesi diisi ${hadir ? "hadir" : "tidak hadir"} untuk semua peserta.`);
        } else {
          toast.error(result.error);
        }
      });
    },
    [absensiData, canManage, loadAbsensiPelatihan],
  );

  const handleBulkAbsensiByPeserta = useCallback(
    (pesertaId: string, hadir: boolean) => {
      if (!canManage || !absensiData) return;
      if (absensiData.sesiList.length === 0) {
        toast.info("Belum ada sesi untuk diubah.");
        return;
      }

      start(async () => {
        const results = await Promise.all(
          absensiData.sesiList.map((s) =>
            inputAbsensiPelatihan(s.id, [{ pesertaId, hadir }]),
          ),
        );
        const failed = results.find((result) => !result.ok);
        if (failed && !failed.ok) {
          toast.error(failed.error);
          return;
        }

        loadAbsensiPelatihan();
        toast.success(`Peserta diisi ${hadir ? "hadir" : "tidak hadir"} untuk semua sesi.`);
      });
    },
    [absensiData, canManage, loadAbsensiPelatihan],
  );

  const handleBulkAbsensiAll = useCallback(
    (hadir: boolean) => {
      if (!canManage || !absensiData) return;
      if (absensiData.sesiList.length === 0 || absensiData.pesertaList.length === 0) {
        toast.info("Belum ada sesi atau peserta untuk diubah.");
        return;
      }

      start(async () => {
        const rows = absensiData.pesertaList.map((p) => ({ pesertaId: p.id, hadir }));
        const results = await Promise.all(
          absensiData.sesiList.map((s) => inputAbsensiPelatihan(s.id, rows)),
        );
        const failed = results.find((result) => !result.ok);
        if (failed && !failed.ok) {
          toast.error(failed.error);
          return;
        }

        loadAbsensiPelatihan();
        toast.success(`Semua absensi diisi ${hadir ? "hadir" : "tidak hadir"}.`);
      });
    },
    [absensiData, canManage, loadAbsensiPelatihan],
  );

  const handleApplyQuickAbsensi = useCallback(() => {
    if (!absensiData) return;

    const hadir = quickAbsensiStatus === "hadir";
    if (quickAbsensiScope === "all") {
      if (!window.confirm("Isi semua peserta dan semua sesi dengan status yang dipilih?")) {
        return;
      }
      handleBulkAbsensiAll(hadir);
      return;
    }

    if (quickAbsensiScope === "session") {
      const sessionId = quickAbsensiSessionId || absensiData.sesiList[0]?.id;
      if (!sessionId) {
        toast.error("Pilih sesi terlebih dahulu.");
        return;
      }
      handleBulkAbsensiBySession(sessionId, hadir);
      return;
    }

    const pesertaId = quickAbsensiPesertaId || absensiData.pesertaList[0]?.id;
    if (!pesertaId) {
      toast.error("Pilih peserta terlebih dahulu.");
      return;
    }
    handleBulkAbsensiByPeserta(pesertaId, hadir);
  }, [
    absensiData,
    handleBulkAbsensiAll,
    handleBulkAbsensiByPeserta,
    handleBulkAbsensiBySession,
    quickAbsensiPesertaId,
    quickAbsensiScope,
    quickAbsensiSessionId,
    quickAbsensiStatus,
  ]);

  const loadNilaiUjian = useCallback(() => {
    start(async () => {
      const [nData, aData] = await Promise.all([
        getNilaiByKelas(kelasId),
        getAbsensiUjianByKelas(kelasId),
      ]);
      setNilaiData(nData as unknown as typeof nilaiData);
      setAbsensiUjianData(aData as unknown as typeof absensiUjianData);
    });
  }, [kelasId]);

  const handleNilaiChange = useCallback(
    (pesertaId: string, jadwalUjianId: string, mapel: string, nilai: string) => {
      if (!canManage || nilai === "-") return;
      start(async () => {
        const result = await inputNilaiUjian(
          jadwalUjianId,
          [{ pesertaId, mataPelajaran: mapel, nilai: nilai as "A" | "B" | "C" | "D" }],
        );
        if (result.ok) {
          loadNilaiUjian();
          toast.success("Nilai disimpan.");
        }
      });
    },
    [canManage, loadNilaiUjian]
  );

  const handlePerbaikan = useCallback(() => {
    if (!perbaikanEdit) return;
    start(async () => {
      const r = await inputNilaiPerbaikan(
        perbaikanEdit.pesertaId,
        perbaikanEdit.jadwalUjianId,
        perbaikanEdit.mapel,
        perbaikanEdit.nilai,
        perbaikanEdit.perbaikanDariId,
      );
      if (r.ok) {
        toast.success("Nilai perbaikan disimpan.");
        setPerbaikanEdit(null);
        loadNilaiUjian();
      } else {
        toast.error("Gagal simpan nilai perbaikan.");
      }
    });
  }, [perbaikanEdit, loadNilaiUjian]);

  const handleSusulan = useCallback(() => {
    if (!susulanEdit) return;
    if (!susulanEdit.tanggal) { toast.error("Pilih tanggal susulan."); return; }
    start(async () => {
      const r = await ajukanUjianSusulan({
        pesertaId: susulanEdit.pesertaId,
        jadwalUjianOriginalId: susulanEdit.jadwalUjianId,
        tanggalUsulan: susulanEdit.tanggal,
      });
      if (r.ok) {
        toast.success("Permohonan susulan diajukan.");
        setSusulanEdit(null);
        loadNilaiUjian();
      } else {
        toast.error(r.error ?? "Gagal mengajukan susulan.");
      }
    });
  }, [susulanEdit, loadNilaiUjian]);

  const handleExportRekap = useCallback(() => {
    startExport(async () => {
      const result = await exportRekapKelas(kelasId);
      if (!result.ok) { toast.error(result.error); return; }
      const data = result.data;
      if (data.length === 0) { toast.info("Belum ada data untuk diekspor."); return; }
      try {
        const XLSX = await import("xlsx");
        const rows = data.map((r, i) => ({
          No: i + 1,
          Nama: r.nama,
          "No Peserta": r.nomorPeserta ?? "",
          "% Hadir": `${r.persentaseHadir}%`,
          ...Object.fromEntries(r.nilaiPerMapel.map((n) => [n.mapel, n.nilai])),
          Status: r.statusAkhir === "lulus" ? "Lulus" : r.statusAkhir === "telah_mengikuti" ? "Telah Mengikuti" : "Dalam Proses",
          Keterangan: r.alasanStatus === "kehadiran" ? "Kehadiran < 60%" : r.alasanStatus === "nilai" ? "Nilai D" : "",
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Rekap");
        XLSX.writeFile(wb, `rekap-kelas-${kelasId.slice(0, 8)}.xlsx`);
        toast.success("Rekap berhasil diexport.");
      } catch {
        toast.error("Gagal mengexport Excel.");
      }
    });
  }, [kelasId]);

  // ─── Computed ───────────────────────────────────────────

  const rekapSummary = useMemo(() => {
    const total = pesertaList.length;
    const lulus = pesertaList.filter((p) => p.statusAkhir === "lulus").length;
    const tm = pesertaList.filter((p) => p.statusAkhir === "telah_mengikuti");
    return { total, lulus, telahMengikuti: tm.length, belumFinal: total - lulus - tm.length, tm };
  }, [pesertaList]);

  const importPreview = useMemo(
    () => buildImportPreview(importRows, pesertaList, duplicateStrategy),
    [duplicateStrategy, importRows, pesertaList],
  );
  const importableRows = useMemo(
    () => importPreview
      .filter((row) => row.status === "valid" || row.status === "update")
      .map(({ rowNumber, status, issues, ...row }) => row),
    [importPreview],
  );

  const filteredPesertaList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pesertaList;
    return pesertaList.filter((p) =>
      [p.nama, p.nomorPeserta, p.email, p.telepon, p.catatan]
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [pesertaList, searchTerm]);
  const pesertaTotalPages = Math.max(1, Math.ceil(filteredPesertaList.length / pesertaPageSize));
  const paginatedPesertaList = useMemo(() => {
    const safePage = Math.min(pesertaPage, pesertaTotalPages);
    const startIndex = (safePage - 1) * pesertaPageSize;
    return filteredPesertaList.slice(startIndex, startIndex + pesertaPageSize);
  }, [filteredPesertaList, pesertaPage, pesertaPageSize, pesertaTotalPages]);
  const selectedOnPage = paginatedPesertaList.filter((p) => selectedPesertaIds.includes(p.id));
  const allOnPageSelected = paginatedPesertaList.length > 0 && selectedOnPage.length === paginatedPesertaList.length;

  useEffect(() => {
    setPesertaPage(1);
  }, [searchTerm, pesertaPageSize]);

  useEffect(() => {
    if (pesertaPage > pesertaTotalPages) {
      setPesertaPage(pesertaTotalPages);
    }
  }, [pesertaPage, pesertaTotalPages]);

  // ─── Render ─────────────────────────────────────────────

  return (
    <>
    <Tabs defaultValue="daftar-peserta" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="daftar-peserta">Daftar Peserta</TabsTrigger>
        <TabsTrigger value="absensi-pelatihan" onClick={loadAbsensiPelatihan}>Absensi Pelatihan</TabsTrigger>
        <TabsTrigger value="nilai-ujian" onClick={loadNilaiUjian}>Absensi &amp; Nilai Ujian</TabsTrigger>
        <TabsTrigger value="rekap" onClick={loadPeserta}>Status &amp; Rekap</TabsTrigger>
      </TabsList>

      {/* ── Sub-tab: Daftar Peserta ──────────────── */}
      <TabsContent value="daftar-peserta">
        <Card>
          <CardHeader className="border-b flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Peserta Kelas</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPesertaTemplate} disabled={exportPending}>
                <FileDown className="h-4 w-4" /> Template
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPeserta} disabled={exportPending}>
                <Download className="h-4 w-4" />
                {selectedPesertaIds.length > 0 ? `Export (${selectedPesertaIds.length})` : "Export"}
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <label>
                      <Upload className="h-4 w-4" /> Import
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(event) => {
                          handlePesertaFileImport(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
                    <ClipboardPaste className="h-4 w-4" /> Paste
                  </Button>
                  <Button size="sm" onClick={() => setShowTambah(!showTambah)}>
                    <Plus className="h-4 w-4" /> Tambah
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {showTambah && canManage && (
              <div className="p-4 border-b space-y-2">
                {newPesertaRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      placeholder="Nama peserta"
                      value={row.nama}
                      onChange={(e) => {
                        const copy = [...newPesertaRows];
                        const r = copy[i]!;
                        copy[i] = { nama: e.target.value, nomorPeserta: r.nomorPeserta };
                        setNewPesertaRows(copy);
                      }}
                    />
                    <input
                      className="w-40 border rounded px-2 py-1 text-sm"
                      placeholder="No Peserta (opsional)"
                      value={row.nomorPeserta ?? ""}
                      onChange={(e) => {
                        const copy = [...newPesertaRows];
                        const r = copy[i]!;
                        copy[i] = { nama: r.nama, nomorPeserta: e.target.value };
                        setNewPesertaRows(copy);
                      }}
                    />
                    {newPesertaRows.length > 1 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setNewPesertaRows(newPesertaRows.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setNewPesertaRows([...newPesertaRows, { nama: "", nomorPeserta: "" }])}>
                    <Plus className="h-3 w-3 mr-1" /> Baris
                  </Button>
                  <Button size="sm" onClick={handleEnroll} disabled={isPending}>
                    {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Simpan
                  </Button>
                </div>
              </div>
            )}
            {showImport && canManage && (
              <PesertaImportDialog
                importRows={importRows}
                pesertaList={pesertaList}
                duplicateStrategy={duplicateStrategy}
                isPending={isPending}
                importableRows={importableRows}
                pasteText={pasteText}
                onDuplicateStrategyChange={setDuplicateStrategy}
                onPasteTextChange={setPasteText}
                onPastePreview={handlePastePreview}
                onBulkImport={handleBulkImportPeserta}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div className="relative min-w-64 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Cari nama, nomor, email, telepon, atau catatan"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage && selectedPesertaIds.length > 0 && (
                  <>
                    <Select value={moveTargetKelasId} onValueChange={setMoveTargetKelasId}>
                      <SelectTrigger className="h-8 w-56">
                        <SelectValue placeholder="Kelas tujuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {kelasOptions.map((kelas) => (
                          <SelectItem key={kelas.id} value={kelas.id}>
                            {kelas.namaKelas} - {kelas.programName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={handleBulkMovePeserta} disabled={isPending || !moveTargetKelasId}>
                      Pindah ({selectedPesertaIds.length})
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkDeactivatePeserta} disabled={isPending}>
                      <UserRoundX className="h-4 w-4" /> Nonaktifkan
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkDeleteCleanPeserta} disabled={isPending}>
                      <Trash2 className="h-4 w-4" /> Hapus bersih
                    </Button>
                  </>
                )}
                <Select value={String(pesertaPageSize)} onValueChange={(value) => setPesertaPageSize(Number(value))}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PESERTA_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  {canManage && (
                    <th className="w-10 px-4 py-2">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(checked) => toggleCurrentPageSelection(checked === true)}
                        aria-label="Pilih semua peserta di halaman ini"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">No</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nama Peserta</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">No Peserta</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Kontak</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status Akhir</th>
                  {canManage && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPesertaList.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 5} className="px-4 py-8">
                      <EmptyState
                        icon={UserRoundX}
                        title={isPending ? "Memuat peserta" : searchTerm ? "Tidak ada peserta yang cocok" : "Belum ada peserta"}
                        description={isPending ? "Mohon tunggu sebentar." : searchTerm ? "Coba ubah kata kunci pencarian atau reset filter peserta." : canManage ? "Klik Tambah atau Import untuk menambahkan peserta ke kelas ini." : "Peserta kelas akan tampil setelah data tersedia."}
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedPesertaList.map((p, i) => (
                    <tr key={p.id} className="border-b border-border/60 transition-colors hover:bg-muted/40">
                      {canManage && (
                        <td className="px-4 py-2">
                          <Checkbox
                            checked={selectedPesertaIds.includes(p.id)}
                            onCheckedChange={(checked) => togglePesertaSelection(p.id, checked === true)}
                            aria-label={`Pilih ${p.nama}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">{(pesertaPage - 1) * pesertaPageSize + i + 1}</td>
                      <td className="px-4 py-2 font-medium">{p.nama}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.nomorPeserta ?? "-"}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {[p.email, p.telepon].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={p.statusAkhir} alasan={p.alasanStatus} />
                      </td>
                      {canManage && (
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openDeactivatePesertaDialog(p)}
                            disabled={isPending}
                            title="Nonaktifkan peserta"
                          >
                            <UserRoundX className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-muted-foreground">
              <span>
                Menampilkan {paginatedPesertaList.length} dari {filteredPesertaList.length} peserta
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPesertaPage((page) => Math.max(1, page - 1))}
                  disabled={pesertaPage <= 1}
                >
                  Sebelumnya
                </Button>
                <span className="tabular-nums">Halaman {pesertaPage} / {pesertaTotalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPesertaPage((page) => Math.min(pesertaTotalPages, page + 1))}
                  disabled={pesertaPage >= pesertaTotalPages}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Sub-tab: Absensi Pelatihan ───────────── */}
      <TabsContent value="absensi-pelatihan">
        <AbsensiPelatihanSection
          absensiData={absensiData}
          canManage={canManage}
          isPending={isPending}
          quickAbsensiScope={quickAbsensiScope}
          quickAbsensiSessionId={quickAbsensiSessionId}
          quickAbsensiPesertaId={quickAbsensiPesertaId}
          quickAbsensiStatus={quickAbsensiStatus}
          onQuickScopeChange={setQuickAbsensiScope}
          onQuickSessionChange={setQuickAbsensiSessionId}
          onQuickPesertaChange={setQuickAbsensiPesertaId}
          onQuickStatusChange={setQuickAbsensiStatus}
          onApplyQuick={handleApplyQuickAbsensi}
          onAbsensiToggle={handleAbsensiToggle}
        />
      </TabsContent>


      {/* ── Sub-tab: Absensi & Nilai Ujian ───────── */}
      <TabsContent value="nilai-ujian">
        <NilaiUjianSection
          nilaiData={nilaiData}
          absensiUjianData={absensiUjianData}
          canManage={canManage}
          isPending={isPending}
          perbaikanEdit={perbaikanEdit}
          susulanEdit={susulanEdit}
          onNilaiChange={handleNilaiChange}
          onPerbaikanEditChange={setPerbaikanEdit}
          onPerbaikanSave={handlePerbaikan}
          onSusulanEditChange={setSusulanEdit}
          onSusulanSave={handleSusulan}
        />
      </TabsContent>

      {/* ── Sub-tab: Status & Rekap ──────────────── */}
      <TabsContent value="rekap">
        <RekapSection
          pesertaList={pesertaList}
          rekapSummary={rekapSummary}
          exportPending={exportPending}
          onExportRekap={handleExportRekap}
        />
      </TabsContent>
    </Tabs>
    <Dialog open={deactivateDialog !== null} onOpenChange={(open) => !open && setDeactivateDialog(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deactivateDialog?.title ?? "Nonaktifkan peserta?"}</DialogTitle>
          <DialogDescription>
            {deactivateDialog?.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>Batal</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirmDeactivatePeserta} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundX className="h-4 w-4" />}
            Nonaktifkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
