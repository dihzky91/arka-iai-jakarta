"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createJadwalAdminJaga,
  updateJadwalAdminJaga,
  deleteJadwalAdminJagaByKelas,
  deleteJadwalAdminJaga,
  importJadwalAdminJaga,
} from "@/server/actions/jadwal-ujian/jadwalAdminJaga";
import type {
  JadwalAdminJagaRow,
  BebanJadwalAdminJagaRow,
} from "@/server/actions/jadwal-ujian/jadwalAdminJaga";

type KelasOption = { id: string; namaKelas: string; program: string };
type PengawasOption = { id: string; nama: string };

const DEFAULT_JAM_MULAI = "17:15";
const DEFAULT_JAM_SELESAI = "21:30";

interface AdminJagaViewProps {
  rows: JadwalAdminJagaRow[];
  beban: BebanJadwalAdminJagaRow[];
  kelasOptions: KelasOption[];
  pengawasOptions: PengawasOption[];
  systemIdentity: { namaSistem: string; logoUrl: string | null };
}

type ImportPreviewRow = {
  rowNum: number;
  namaKelas: string;
  tanggalRaw: string;
  tanggalParsed: string | null;
  jamMulai: string;
  jamSelesai: string;
  materi: string;
  namaAdmin: string;
  catatan: string;
  kelasId: string | null;
  pengawasId: string | null;
  error: string | null;
};

function formatTanggal(dateStr: string) {
  return format(parseISO(dateStr), "dd MMM yyyy", { locale: localeId });
}
function formatHari(dateStr: string) {
  return format(parseISO(dateStr), "EEEE", { locale: localeId });
}

function formatWaktu(jamMulai: string | null, jamSelesai: string | null) {
  if (!jamMulai || !jamSelesai) return "-";
  return `${jamMulai} - ${jamSelesai}`;
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTanggalText(value: string) {
  const raw = value.trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const match = isoMatch ?? localMatch;
  if (!match) return null;

  const year = Number(isoMatch ? match[1] : match[3]);
  const month = Number(match[2]);
  const day = Number(isoMatch ? match[3] : match[1]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatDateParts(year, month, day);
}

function parseImportedTanggal(
  rawValue: unknown,
  displayValue: string | undefined,
  parseExcelSerial: (serial: number) => { y: number; m: number; d: number } | null,
) {
  const tanggalRaw =
    typeof displayValue === "string" && displayValue.trim()
      ? displayValue.trim()
      : String(rawValue ?? "").trim();

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    const parsed = parseExcelSerial(rawValue);
    if (parsed) {
      return {
        tanggalRaw,
        tanggalParsed: formatDateParts(parsed.y, parsed.m, parsed.d),
      };
    }
  }

  const textValues = [
    typeof displayValue === "string" ? displayValue : "",
    typeof rawValue === "string" ? rawValue : "",
  ];
  for (const text of textValues) {
    const parsed = parseTanggalText(text);
    if (parsed) return { tanggalRaw, tanggalParsed: parsed };
  }

  if (rawValue instanceof Date) {
    return {
      tanggalRaw,
      tanggalParsed: formatDateParts(rawValue.getFullYear(), rawValue.getMonth() + 1, rawValue.getDate()),
    };
  }

  return { tanggalRaw, tanggalParsed: null };
}

function normalizeJam(value: string) {
  const raw = value.trim().replace(".", ":");
  const match = raw.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;

  const hour = Number(match[1]);
  if (hour > 23) return null;

  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function parseImportedJam(rawValue: unknown, displayValue: string | undefined, fallback: string) {
  const jamRaw =
    typeof displayValue === "string" && displayValue.trim()
      ? displayValue.trim()
      : String(rawValue ?? "").trim();

  if (!jamRaw) return { jamRaw: fallback, jamParsed: fallback };

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    if (rawValue >= 0 && rawValue < 1) {
      const totalMinutes = Math.round(rawValue * 24 * 60);
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      return {
        jamRaw,
        jamParsed: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      };
    }
  }

  const textValues = [
    typeof displayValue === "string" ? displayValue : "",
    typeof rawValue === "string" ? rawValue : "",
    jamRaw,
  ];
  for (const text of textValues) {
    const parsed = normalizeJam(text);
    if (parsed) return { jamRaw, jamParsed: parsed };
  }

  return { jamRaw, jamParsed: null };
}

async function buildLogoDataUrl(logoUrl: string): Promise<string> {
  const response = await fetch(logoUrl);
  if (!response.ok) throw new Error("Logo tidak dapat dimuat.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") { resolve(reader.result); return; }
      reject(new Error("Logo tidak dapat dibaca."));
    };
    reader.onerror = () => reject(new Error("Logo tidak dapat dibaca."));
    reader.readAsDataURL(blob);
  });
}

async function buildLogoImage(logoUrl: string) {
  const dataUrl = await buildLogoDataUrl(logoUrl);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Logo tidak dapat diproses."));
    img.src = dataUrl;
  });
  return { dataUrl, image };
}

export function AdminJagaView({
  rows,
  beban,
  kelasOptions,
  pengawasOptions,
  systemIdentity,
}: AdminJagaViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [filterKelasId, setFilterKelasId] = useState("__all__");
  const [filterPengawasId, setFilterPengawasId] = useState("__all__");
  const [filterTanggalMulai, setFilterTanggalMulai] = useState("");
  const [filterTanggalSelesai, setFilterTanggalSelesai] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addKelasId, setAddKelasId] = useState("");
  const [addTanggal, setAddTanggal] = useState("");
  const [addJamMulai, setAddJamMulai] = useState(DEFAULT_JAM_MULAI);
  const [addJamSelesai, setAddJamSelesai] = useState(DEFAULT_JAM_SELESAI);
  const [addMateri, setAddMateri] = useState("");
  const [addPengawasId, setAddPengawasId] = useState("");
  const [addCatatan, setAddCatatan] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editKelasId, setEditKelasId] = useState("");
  const [editTanggal, setEditTanggal] = useState("");
  const [editJamMulai, setEditJamMulai] = useState(DEFAULT_JAM_MULAI);
  const [editJamSelesai, setEditJamSelesai] = useState(DEFAULT_JAM_SELESAI);
  const [editMateri, setEditMateri] = useState("");
  const [editPengawasId, setEditPengawasId] = useState("");
  const [editCatatan, setEditCatatan] = useState("");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [deleteKelasOpen, setDeleteKelasOpen] = useState(false);

  const filteredWithoutKelas = useMemo(() => {
    return rows.filter((r) => {
      if (filterPengawasId !== "__all__" && r.pengawasId !== filterPengawasId) return false;
      if (filterTanggalMulai && r.tanggal < filterTanggalMulai) return false;
      if (filterTanggalSelesai && r.tanggal > filterTanggalSelesai) return false;
      return true;
    });
  }, [rows, filterPengawasId, filterTanggalMulai, filterTanggalSelesai]);

  const kelasTabs = useMemo(() => {
    const tabMap = new Map<string, { id: string; namaKelas: string; program: string; jumlah: number }>();

    filteredWithoutKelas.forEach((r) => {
      const existing = tabMap.get(r.kelasId);
      if (existing) {
        existing.jumlah += 1;
      } else {
        tabMap.set(r.kelasId, {
          id: r.kelasId,
          namaKelas: r.namaKelas,
          program: r.program,
          jumlah: 1,
        });
      }
    });

    const ordered = kelasOptions
      .map((kelas) => tabMap.get(kelas.id))
      .filter((kelas): kelas is { id: string; namaKelas: string; program: string; jumlah: number } => Boolean(kelas));
    const knownKelasIds = new Set(kelasOptions.map((kelas) => kelas.id));
    const extra = Array.from(tabMap.values())
      .filter((kelas) => !knownKelasIds.has(kelas.id))
      .sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, "id"));

    return [...ordered, ...extra];
  }, [filteredWithoutKelas, kelasOptions]);

  useEffect(() => {
    if (filterKelasId !== "__all__" && !kelasTabs.some((kelas) => kelas.id === filterKelasId)) {
      setFilterKelasId("__all__");
    }
  }, [filterKelasId, kelasTabs]);

  const filtered = useMemo(() => {
    if (filterKelasId === "__all__") return filteredWithoutKelas;
    return filteredWithoutKelas.filter((r) => r.kelasId === filterKelasId);
  }, [filteredWithoutKelas, filterKelasId]);

  const selectedKelas = useMemo(() => {
    if (filterKelasId === "__all__") return null;
    const option = kelasOptions.find((kelas) => kelas.id === filterKelasId);
    if (option) return option;
    const row = rows.find((item) => item.kelasId === filterKelasId);
    return row ? { id: row.kelasId, namaKelas: row.namaKelas, program: row.program } : null;
  }, [filterKelasId, kelasOptions, rows]);

  const selectedKelasTotal = useMemo(() => {
    if (filterKelasId === "__all__") return 0;
    return rows.filter((row) => row.kelasId === filterKelasId).length;
  }, [filterKelasId, rows]);

  // ── Add single ───────────────────────────────────────────────────────────────
  function openAdd() {
    setAddKelasId("");
    setAddTanggal("");
    setAddJamMulai(DEFAULT_JAM_MULAI);
    setAddJamSelesai(DEFAULT_JAM_SELESAI);
    setAddMateri("");
    setAddPengawasId("");
    setAddCatatan("");
    setAddOpen(true);
  }

  function handleAdd() {
    if (!addKelasId || !addTanggal || !addJamMulai || !addJamSelesai || !addMateri.trim() || !addPengawasId) {
      toast.error("Lengkapi semua field wajib.");
      return;
    }
    if (addJamSelesai <= addJamMulai) {
      toast.error("Jam selesai harus setelah jam mulai.");
      return;
    }
    startTransition(async () => {
      const res = await createJadwalAdminJaga({
        kelasId: addKelasId,
        tanggal: addTanggal,
        jamMulai: addJamMulai,
        jamSelesai: addJamSelesai,
        materi: addMateri,
        pengawasId: addPengawasId,
        catatan: addCatatan || undefined,
      });
      if (res.ok) {
        toast.success("Penugasan admin jaga ditambahkan.");
        setAddOpen(false);
        router.refresh();
      } else {
        toast.error("Gagal menyimpan.");
      }
    });
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────
  function openEdit(row: JadwalAdminJagaRow) {
    setEditId(row.id);
    setEditKelasId(row.kelasId);
    setEditTanggal(row.tanggal);
    setEditJamMulai(row.jamMulai ?? DEFAULT_JAM_MULAI);
    setEditJamSelesai(row.jamSelesai ?? DEFAULT_JAM_SELESAI);
    setEditMateri(row.materi);
    setEditPengawasId(row.pengawasId);
    setEditCatatan(row.catatan ?? "");
    setEditOpen(true);
  }

  function handleEdit() {
    if (!editKelasId || !editTanggal || !editJamMulai || !editJamSelesai || !editMateri.trim() || !editPengawasId) {
      toast.error("Lengkapi semua field wajib.");
      return;
    }
    if (editJamSelesai <= editJamMulai) {
      toast.error("Jam selesai harus setelah jam mulai.");
      return;
    }
    startTransition(async () => {
      const res = await updateJadwalAdminJaga({
        id: editId,
        kelasId: editKelasId,
        tanggal: editTanggal,
        jamMulai: editJamMulai,
        jamSelesai: editJamSelesai,
        materi: editMateri,
        pengawasId: editPengawasId,
        catatan: editCatatan || undefined,
      });
      if (res.ok) {
        toast.success("Penugasan admin jaga diperbarui.");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal menyimpan.");
      }
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function handleDelete(id: string, nama: string) {
    startTransition(async () => {
      const res = await deleteJadwalAdminJaga(id);
      if (res.ok) {
        toast.success(`Penugasan ${nama} dihapus.`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal menghapus.");
      }
    });
  }

  function handleDeleteSelectedKelas() {
    if (!selectedKelas) {
      toast.error("Pilih kelas yang ingin dihapus.");
      return;
    }

    startTransition(async () => {
      const res = await deleteJadwalAdminJagaByKelas(selectedKelas.id);
      if (res.ok) {
        toast.success(`${res.deleted} jadwal kelas ${selectedKelas.namaKelas} dihapus.`);
        setDeleteKelasOpen(false);
        setFilterKelasId("__all__");
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal menghapus jadwal kelas.");
      }
    });
  }

  // ── Template download ─────────────────────────────────────────────────────────
  function handleDownloadTemplate() {
    startTransition(async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Data (template untuk diisi)
      const dataSheet = XLSX.utils.aoa_to_sheet([
        ["Nama Kelas", "Tanggal (dd/mm/yyyy)", "Jam Mulai", "Jam Selesai", "Materi", "Nama Admin", "Catatan (opsional)"],
        ["Brevet AB 232", "13/01/2026", DEFAULT_JAM_MULAI, DEFAULT_JAM_SELESAI, "KUP A", "Lidya", ""],
        ["Brevet AB 232", "15/01/2026", DEFAULT_JAM_MULAI, DEFAULT_JAM_SELESAI, "KUP A", "Vani", ""],
      ]);
      dataSheet["!cols"] = [{ wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, "Data");

      // Sheet 2: Referensi Kelas
      const kelasData = [["Nama Kelas", "Program"], ...kelasOptions.map((k) => [k.namaKelas, k.program])];
      const kelasSheet = XLSX.utils.aoa_to_sheet(kelasData);
      kelasSheet["!cols"] = [{ wch: 28 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, kelasSheet, "Ref Kelas");

      // Sheet 3: Referensi Admin
      const adminData = [["Nama Admin"], ...pengawasOptions.map((p) => [p.nama])];
      const adminSheet = XLSX.utils.aoa_to_sheet(adminData);
      adminSheet["!cols"] = [{ wch: 24 }];
      XLSX.utils.book_append_sheet(wb, adminSheet, "Ref Admin");

      XLSX.writeFile(wb, "template-admin-jaga.xlsx");
      toast.success("Template berhasil diunduh.");
    });
  }

  // ── Import: parse file ────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    startTransition(async () => {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      if (!ws) { toast.error("Sheet tidak ditemukan."); return; }

      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      if (raw.length < 2) { toast.error("File kosong atau tidak ada data."); return; }

      const kelasMap = new Map(kelasOptions.map((k) => [k.namaKelas.trim().toLowerCase(), k.id]));
      const adminMap = new Map(pengawasOptions.map((p) => [p.nama.trim().toLowerCase(), p.id]));
      const useDate1904 = Boolean(wb.Workbook?.WBProps?.date1904);
      const headerRow = raw[0] ?? [];
      const headerText = headerRow.map((cell) => String(cell ?? "").trim().toLowerCase());
      const hasWaktuColumns = headerText.some((text) => text.includes("jam mulai") || text.includes("waktu mulai"));
      const materiIndex = hasWaktuColumns ? 4 : 2;
      const adminIndex = hasWaktuColumns ? 5 : 3;
      const catatanIndex = hasWaktuColumns ? 6 : 4;

      const preview: ImportPreviewRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        const namaKelas = String(row[0] ?? "").trim();
        const tanggalCell = ws[XLSX.utils.encode_cell({ r: i, c: 1 })];
        const tanggalDisplay = typeof tanggalCell?.w === "string" ? tanggalCell.w : undefined;
        const { tanggalRaw, tanggalParsed } = parseImportedTanggal(
          row[1],
          tanggalDisplay,
          (serial) => {
            const parsed = XLSX.SSF.parse_date_code(serial, { date1904: useDate1904 });
            if (!parsed) return null;
            return { y: parsed.y, m: parsed.m, d: parsed.d };
          },
        );
        const jamMulaiCell = hasWaktuColumns ? ws[XLSX.utils.encode_cell({ r: i, c: 2 })] : undefined;
        const jamSelesaiCell = hasWaktuColumns ? ws[XLSX.utils.encode_cell({ r: i, c: 3 })] : undefined;
        const jamMulaiDisplay = typeof jamMulaiCell?.w === "string" ? jamMulaiCell.w : undefined;
        const jamSelesaiDisplay = typeof jamSelesaiCell?.w === "string" ? jamSelesaiCell.w : undefined;
        const { jamRaw: jamMulaiRaw, jamParsed: jamMulai } = parseImportedJam(
          hasWaktuColumns ? row[2] : "",
          jamMulaiDisplay,
          DEFAULT_JAM_MULAI,
        );
        const { jamRaw: jamSelesaiRaw, jamParsed: jamSelesai } = parseImportedJam(
          hasWaktuColumns ? row[3] : "",
          jamSelesaiDisplay,
          DEFAULT_JAM_SELESAI,
        );
        const materi = String(row[materiIndex] ?? "").trim();
        const namaAdmin = String(row[adminIndex] ?? "").trim();
        const catatan = String(row[catatanIndex] ?? "").trim();

        if (!namaKelas && !tanggalRaw && !materi && !namaAdmin) continue;

        const errors: string[] = [];
        const kelasId = kelasMap.get(namaKelas.toLowerCase()) ?? null;
        const pengawasId = adminMap.get(namaAdmin.toLowerCase()) ?? null;

        if (!namaKelas) errors.push("Nama Kelas kosong");
        else if (!kelasId) errors.push(`Kelas "${namaKelas}" tidak ditemukan`);

        if (!materi) errors.push("Materi kosong");

        if (!namaAdmin) errors.push("Nama Admin kosong");
        else if (!pengawasId) errors.push(`Admin "${namaAdmin}" tidak ditemukan`);

        if (!tanggalRaw) {
          errors.push("Tanggal kosong");
        } else if (!tanggalParsed) {
          errors.push("Format tanggal tidak valid (gunakan dd/mm/yyyy)");
        }
        if (!jamMulai) errors.push(`Jam mulai tidak valid (${jamMulaiRaw || "kosong"})`);
        if (!jamSelesai) errors.push(`Jam selesai tidak valid (${jamSelesaiRaw || "kosong"})`);
        if (jamMulai && jamSelesai && jamSelesai <= jamMulai) {
          errors.push("Jam selesai harus setelah jam mulai");
        }

        preview.push({
          rowNum: i + 1,
          namaKelas,
          tanggalRaw,
          tanggalParsed,
          jamMulai: jamMulai ?? jamMulaiRaw,
          jamSelesai: jamSelesai ?? jamSelesaiRaw,
          materi,
          namaAdmin,
          catatan,
          kelasId,
          pengawasId,
          error: errors.length > 0 ? errors.join("; ") : null,
        });
      }

      if (preview.length === 0) {
        toast.error("Tidak ada data yang bisa diproses.");
        return;
      }

      setImportPreview(preview);
      setImportOpen(true);
    });

    e.target.value = "";
  }

  function handleConfirmImport() {
    const valid = importPreview.filter((r) => !r.error && r.kelasId && r.pengawasId && r.tanggalParsed);
    if (valid.length === 0) {
      toast.error("Tidak ada baris valid untuk diimpor.");
      return;
    }
    startTransition(async () => {
      const res = await importJadwalAdminJaga(
        valid.map((r) => ({
          kelasId: r.kelasId!,
          tanggal: r.tanggalParsed!,
          jamMulai: r.jamMulai,
          jamSelesai: r.jamSelesai,
          materi: r.materi,
          pengawasId: r.pengawasId!,
          catatan: r.catatan || undefined,
        })),
      );
      if (res.ok) {
        toast.success(`${res.inserted} penugasan berhasil diimpor.`);
        setImportOpen(false);
        setImportPreview([]);
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal mengimpor data.");
      }
    });
  }

  // ── Export Excel ──────────────────────────────────────────────────────────────
  function handleExcelExport() {
    startTransition(async () => {
      try {
        if (filtered.length === 0) { toast.info("Tidak ada data untuk diekspor."); return; }
        const XLSX = await import("xlsx");
        const wsData = [
          ["No", "Hari", "Tanggal", "Waktu", "Kelas", "Materi", "Admin Jaga", "Catatan"],
          ...filtered.map((r, i) => [
            i + 1,
            formatHari(r.tanggal),
            formatTanggal(r.tanggal),
            formatWaktu(r.jamMulai, r.jamSelesai),
            r.namaKelas,
            r.materi,
            r.namaPengawas,
            r.catatan ?? "",
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws["!cols"] = [
          { wch: 4 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
          { wch: 24 }, { wch: 36 }, { wch: 24 }, { wch: 30 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Admin Jaga");
        XLSX.writeFile(wb, `admin-jaga-${format(new Date(), "yyyyMMdd")}.xlsx`);
        toast.success(`${filtered.length} data berhasil diekspor ke Excel.`);
      } catch {
        toast.error("Gagal mengekspor ke Excel.");
      }
    });
  }

  // ── Export PDF ────────────────────────────────────────────────────────────────
  function handlePdfExport() {
    startTransition(async () => {
      try {
        if (filtered.length === 0) { toast.info("Tidak ada data untuk diekspor."); return; }
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const printDate = format(new Date(), "dd MMMM yyyy, HH:mm", { locale: localeId });

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 12;
        let currentY = 10;

        if (systemIdentity.logoUrl) {
          try {
            const { dataUrl, image } = await buildLogoImage(systemIdentity.logoUrl);
            const maxWidth = 34; const maxHeight = 28;
            const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
            const w = image.width * ratio; const h = image.height * ratio;
            doc.addImage(dataUrl, "PNG", (pageWidth - w) / 2, currentY, w, h);
            currentY += h + 5;
          } catch { /* logo opsional */ }
        }

        doc.setFontSize(17);
        doc.setTextColor(29, 78, 216);
        doc.text("JADWAL ADMIN JAGA", pageWidth / 2, currentY, { align: "center" });
        currentY += 7;
        doc.setDrawColor(29, 78, 216);
        doc.setLineWidth(0.5);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 6;

        // Group by kelas
        const grouped = new Map<string, JadwalAdminJagaRow[]>();
        [...filtered]
          .sort((a, b) => {
            const k = a.namaKelas.localeCompare(b.namaKelas, "id");
            if (k !== 0) return k;
            return a.tanggal.localeCompare(b.tanggal);
          })
          .forEach((r) => {
            const existing = grouped.get(r.namaKelas);
            if (existing) existing.push(r);
            else grouped.set(r.namaKelas, [r]);
          });

        const body: Array<Array<string | { content: string; colSpan: number; styles: Record<string, unknown> }>> = [];
        let rowNumber = 1;
        grouped.forEach((group, namaKelas) => {
          body.push([{
            content: namaKelas,
            colSpan: 6,
            styles: { fillColor: [219, 234, 254], textColor: [29, 78, 216], fontStyle: "bold", halign: "left" },
          }]);
          group.forEach((r) => {
            body.push([
              String(rowNumber++),
              formatHari(r.tanggal),
              formatTanggal(r.tanggal),
              formatWaktu(r.jamMulai, r.jamSelesai),
              r.materi,
              r.namaPengawas,
            ]);
          });
        });

        autoTable(doc, {
          startY: currentY,
          head: [["No", "Hari", "Tanggal", "Waktu", "Materi", "Admin Jaga"]],
          body,
          theme: "grid",
          styles: {
            font: "helvetica", fontSize: 8.5, textColor: [15, 23, 42],
            cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
            lineColor: [203, 213, 225], lineWidth: 0.1, valign: "middle",
          },
          headStyles: {
            fillColor: [37, 99, 235], textColor: [255, 255, 255],
            fontStyle: "bold", halign: "center", valign: "middle",
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 18 },
            2: { cellWidth: 24 },
            3: { cellWidth: 24, halign: "center" },
            4: { cellWidth: "auto" },
            5: { cellWidth: 28 },
          },
          margin: { top: 14, right: marginX, bottom: 14, left: marginX },
          didDrawPage: (data) => {
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(51, 65, 85);
            doc.text(printDate, marginX, 7);
            doc.text("Jadwal Admin Jaga", pageWidth - marginX, 7, { align: "right" });
            doc.text(`Dicetak: ${printDate} WIB`, marginX, pageHeight - 6);
            doc.text(`Halaman ${data.pageNumber}`, pageWidth - marginX, pageHeight - 6, { align: "right" });
          },
        });

        const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY;
        let summaryBoxY = finalY + 4;
        if (summaryBoxY + 8 > pageHeight - 18) { doc.addPage(); summaryBoxY = 18; }
        doc.setDrawColor(186, 230, 253); doc.setFillColor(239, 246, 255);
        doc.setLineWidth(0.4);
        doc.roundedRect(marginX, summaryBoxY, 42, 8, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(30, 41, 59);
        doc.text(`Total: ${filtered.length} penugasan`, marginX + 2, summaryBoxY + 5.4);

        doc.save(`admin-jaga-${format(new Date(), "yyyyMMdd")}.pdf`);
        toast.success(`${filtered.length} data berhasil diekspor ke PDF.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengekspor ke PDF.");
      }
    });
  }

  const importValidCount = importPreview.filter((r) => !r.error).length;
  const importErrorCount = importPreview.filter((r) => r.error).length;

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Penugasan Admin Jaga</DialogTitle>
            <DialogDescription>Isi data piket admin untuk sesi kelas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Kelas</p>
              <Select value={addKelasId} onValueChange={setAddKelasId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {kelasOptions.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.namaKelas}
                      <span className="ml-1.5 text-muted-foreground text-xs">({k.program})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tanggal</p>
                <Input type="date" value={addTanggal} onChange={(e) => setAddTanggal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Jam Mulai</p>
                <Input type="time" value={addJamMulai} onChange={(e) => setAddJamMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Jam Selesai</p>
                <Input type="time" value={addJamSelesai} onChange={(e) => setAddJamSelesai(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Admin Jaga</p>
              <Select value={addPengawasId} onValueChange={setAddPengawasId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih admin..." />
                </SelectTrigger>
                <SelectContent>
                  {pengawasOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Materi</p>
              <Input
                placeholder="Nama materi / topik sesi ini..."
                value={addMateri}
                onChange={(e) => setAddMateri(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
              </p>
              <Textarea
                rows={2}
                placeholder="Catatan tambahan..."
                value={addCatatan}
                onChange={(e) => setAddCatatan(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={isPending}>Batal</Button>
            <Button
              onClick={handleAdd}
              disabled={
                isPending ||
                !addKelasId ||
                !addTanggal ||
                !addJamMulai ||
                !addJamSelesai ||
                !addMateri.trim() ||
                !addPengawasId
              }
            >
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Penugasan Admin Jaga</DialogTitle>
            <DialogDescription>Ubah data piket admin untuk sesi ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Kelas</p>
              <Select value={editKelasId} onValueChange={setEditKelasId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {kelasOptions.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.namaKelas}
                      <span className="ml-1.5 text-muted-foreground text-xs">({k.program})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tanggal</p>
                <Input type="date" value={editTanggal} onChange={(e) => setEditTanggal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Jam Mulai</p>
                <Input type="time" value={editJamMulai} onChange={(e) => setEditJamMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Jam Selesai</p>
                <Input type="time" value={editJamSelesai} onChange={(e) => setEditJamSelesai(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Admin Jaga</p>
              <Select value={editPengawasId} onValueChange={setEditPengawasId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih admin..." />
                </SelectTrigger>
                <SelectContent>
                  {pengawasOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Materi</p>
              <Input
                placeholder="Nama materi / topik sesi ini..."
                value={editMateri}
                onChange={(e) => setEditMateri(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
              </p>
              <Textarea
                rows={2}
                placeholder="Catatan tambahan..."
                value={editCatatan}
                onChange={(e) => setEditCatatan(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>Batal</Button>
            <Button
              onClick={handleEdit}
              disabled={
                isPending ||
                !editKelasId ||
                !editTanggal ||
                !editJamMulai ||
                !editJamSelesai ||
                !editMateri.trim() ||
                !editPengawasId
              }
            >
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setImportPreview([]); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview Import</DialogTitle>
            <DialogDescription>
              {importFileName} — {importPreview.length} baris ditemukan.{" "}
              <span className="text-emerald-600">{importValidCount} valid</span>
              {importErrorCount > 0 && (
                <>, <span className="text-red-600">{importErrorCount} error</span></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            <div className="overflow-hidden rounded-md border">
              <Table className="min-w-3xl">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Materi</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreview.map((r) => (
                    <TableRow key={r.rowNum} className={r.error ? "bg-red-50/50" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{r.rowNum}</TableCell>
                      <TableCell className="text-sm">{r.namaKelas || <span className="text-muted-foreground italic">kosong</span>}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.tanggalParsed ? formatTanggal(r.tanggalParsed) : <span className="text-red-500">{r.tanggalRaw || "kosong"}</span>}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatWaktu(r.jamMulai, r.jamSelesai)}</TableCell>
                      <TableCell className="text-sm">{r.materi || <span className="text-muted-foreground italic">kosong</span>}</TableCell>
                      <TableCell className="text-sm">{r.namaAdmin || <span className="text-muted-foreground italic">kosong</span>}</TableCell>
                      <TableCell>
                        {r.error ? (
                          <div className="flex items-start gap-1">
                            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                            <span className="text-xs text-red-600">{r.error}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-600">OK</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {importErrorCount > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Baris dengan error akan dilewati. Hanya {importValidCount} baris valid yang akan diimpor.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview([]); }} disabled={isPending}>
              Batal
            </Button>
            <Button onClick={handleConfirmImport} disabled={isPending || importValidCount === 0}>
              {isPending ? "Mengimpor..." : `Import ${importValidCount} Baris`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteKelasOpen} onOpenChange={setDeleteKelasOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Jadwal Kelas?</DialogTitle>
            <DialogDescription>
              {selectedKelas ? (
                <>
                  Seluruh jadwal admin jaga untuk kelas <span className="font-medium text-foreground">{selectedKelas.namaKelas}</span> akan dihapus.
                  Aksi ini tidak menghapus jadwal kelas lain.
                </>
              ) : (
                "Pilih salah satu tab kelas terlebih dahulu."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {selectedKelasTotal} jadwal akan dihapus permanen. Filter admin dan tanggal tidak membatasi aksi ini.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKelasOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelectedKelas}
              disabled={isPending || !selectedKelas || selectedKelasTotal === 0}
            >
              {isPending ? "Menghapus..." : "Hapus Jadwal Kelas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Beban Kerja Summary */}
      {beban.length > 0 && (
        <Card className="rounded-[24px]">
          <CardHeader className="border-b border-border">
            <CardTitle>Rekap Beban Admin Jaga</CardTitle>
            <CardDescription>Total penugasan per admin.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {beban.map((b) => (
                <div key={b.pengawasId} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.namaPengawas}</p>
                    <p className="text-xs text-muted-foreground">{b.jumlah} penugasan</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabel */}
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Daftar Penugasan Admin Jaga</CardTitle>
              <CardDescription>Jadwal piket admin per sesi kelas.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={openAdd} disabled={isPending} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
              {selectedKelas && (
                <Button
                  variant="outline"
                  onClick={() => setDeleteKelasOpen(true)}
                  disabled={isPending || selectedKelasTotal === 0}
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus Kelas
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isPending} className="w-full sm:w-auto">
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadTemplate}>
                    <Download className="mr-2 h-4 w-4 text-blue-500" />
                    Unduh Template Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4 text-emerald-600" />
                    Upload File Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isPending} className="w-full sm:w-auto">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExcelExport}>
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                    Export Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePdfExport}>
                    <FileText className="mr-2 h-4 w-4 text-red-500" />
                    Export PDF (.pdf)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterPengawasId} onValueChange={setFilterPengawasId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Admin</SelectItem>
                {pengawasOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterTanggalMulai}
                onChange={(e) => setFilterTanggalMulai(e.target.value)}
              />
              <span className="text-sm text-muted-foreground px-1">s/d</span>
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterTanggalSelesai}
                onChange={(e) => setFilterTanggalSelesai(e.target.value)}
              />
              {(filterTanggalMulai || filterTanggalSelesai) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFilterTanggalMulai(""); setFilterTanggalSelesai(""); }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <Tabs value={filterKelasId} onValueChange={setFilterKelasId} className="w-full gap-0">
            <div className="overflow-x-auto pb-1">
              <TabsList
                variant="line"
                className="h-auto w-max flex-nowrap justify-start gap-1.5 rounded-none p-0"
              >
                <TabsTrigger
                  value="__all__"
                  className="h-7 flex-none shrink-0 rounded-md border border-border bg-background px-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/5"
                >
                  Semua
                  <Badge variant="secondary" className="px-1 py-0 text-[10px] leading-4">
                    {filteredWithoutKelas.length}
                  </Badge>
                </TabsTrigger>
                {kelasTabs.map((kelas) => (
                  <TabsTrigger
                    key={kelas.id}
                    value={kelas.id}
                    className="h-7 flex-none shrink-0 rounded-md border border-border bg-background px-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/5"
                  >
                    <span className="block max-w-36 truncate">{kelas.namaKelas}</span>
                    <Badge variant="secondary" className="px-1 py-0 text-[10px] leading-4">
                      {kelas.jumlah}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <div className="overflow-hidden rounded-md border bg-card">
            <Table className="min-w-208">
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Materi</TableHead>
                  <TableHead>Admin Jaga</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length > 0 ? (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatTanggal(row.tanggal)}</span>
                          <span className="text-xs text-muted-foreground">{formatHari(row.tanggal)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatWaktu(row.jamMulai, row.jamSelesai)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{row.namaKelas}</span>
                          <span className="text-xs text-muted-foreground">{row.program}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{row.materi}</TableCell>
                      <TableCell className="text-sm font-medium">{row.namaPengawas}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                        {row.catatan ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            disabled={isPending}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            disabled={isPending}
                            onClick={() => handleDelete(row.id, row.namaPengawas)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                      Belum ada penugasan admin jaga.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground">{filtered.length} penugasan</p>
        </CardContent>
      </Card>
    </div>
  );
}
