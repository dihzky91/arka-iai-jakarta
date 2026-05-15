"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarX, Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConflictBadge } from "./ConflictBadge";
import { UjianForm } from "./UjianForm";
import { UjianExportButton } from "./UjianExportButton";
import { deleteUjian, type UjianRow } from "@/server/actions/jadwal-ujian/ujian";
import type { KelasRow } from "@/server/actions/jadwal-ujian/kelas";
import type { PengawasRow } from "@/server/actions/jadwal-ujian/pengawas";
import type { MateriRow } from "@/server/actions/jadwal-ujian/materi";
import {
  APP_TIME_ZONE,
  getTodayIsoInJakarta,
  parseIsoDateInJakarta,
} from "@/lib/utils";

interface UjianTableProps {
  initialData: UjianRow[];
  kelasList: Pick<KelasRow, "id" | "namaKelas" | "program">[];
  pengawasList: Pick<PengawasRow, "id" | "nama" | "jumlahTugas">[];
  materiList: Pick<MateriRow, "id" | "nama" | "program">[];
  canManage: boolean;
  programOptions: string[];
  systemIdentity: {
    namaSistem: string;
    logoUrl: string | null;
  };
}

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: UjianRow };

export function UjianTable({
  initialData,
  kelasList,
  pengawasList,
  materiList,
  canManage,
  programOptions,
  systemIdentity,
}: UjianTableProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<UjianRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [filterProgram, setFilterProgram] = useState("__all__");
  const [filterTanggalMulai, setFilterTanggalMulai] = useState("");
  const [filterTanggalSelesai, setFilterTanggalSelesai] = useState("");
  const [showPastExams, setShowPastExams] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const today = useMemo(() => getTodayIsoInJakarta(), []);

  const archivedCount = useMemo(
    () => initialData.filter((u) => u.tanggalUjian < today).length,
    [initialData, today],
  );

  const filteredData = useMemo(() => {
    return initialData.filter((u) => {
      if (!showPastExams && u.tanggalUjian < today) return false;
      if (filterProgram !== "__all__" && u.program !== filterProgram) return false;
      if (filterTanggalMulai && u.tanggalUjian < filterTanggalMulai) return false;
      if (filterTanggalSelesai && u.tanggalUjian > filterTanggalSelesai) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSubject = u.mataPelajaran.some((mata) => mata.toLowerCase().includes(query));
        const matchesClass = u.namaKelas.toLowerCase().includes(query);
        const matchesProgram = u.program.toLowerCase().includes(query);
        if (!matchesSubject && !matchesClass && !matchesProgram) return false;
      }

      return true;
    });
  }, [
    initialData,
    showPastExams,
    today,
    filterProgram,
    filterTanggalMulai,
    filterTanggalSelesai,
    searchQuery,
  ]);

  const groupedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const classCompare = a.namaKelas.localeCompare(b.namaKelas, "id");
      if (classCompare !== 0) return classCompare;

      const dateCompare = a.tanggalUjian.localeCompare(b.tanggalUjian);
      if (dateCompare !== 0) return dateCompare;

      return a.jamMulai.localeCompare(b.jamMulai);
    });

    const groups = new Map<string, UjianRow[]>();
    sorted.forEach((row) => {
      const existing = groups.get(row.namaKelas);
      if (existing) {
        existing.push(row);
        return;
      }
      groups.set(row.namaKelas, [row]);
    });

    return Array.from(groups.entries());
  }, [filteredData]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deleteUjian(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Jadwal ujian dihapus.");
      setDeleteTarget(null);
    });
  }

  const exportFilter: import("@/lib/validators/jadwalUjian.schema").UjianFilter = {
    program: filterProgram !== "__all__" ? filterProgram : undefined,
    tanggalMulai: filterTanggalMulai || undefined,
    tanggalSelesai: filterTanggalSelesai || undefined,
  };

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Jadwal Ujian</CardTitle>
              <CardDescription className="mt-1">
                Daftar seluruh jadwal ujian, pengawas, dan status konflik penugasan.
              </CardDescription>
            </div>
            <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Button
                variant={showPastExams ? "secondary" : "outline"}
                onClick={() => setShowPastExams((v) => !v)}
                className="w-full sm:w-auto"
              >
                <Archive className="h-4 w-4" />
                {showPastExams ? "Sembunyikan Arsip" : `Lihat Arsip (${archivedCount})`}
              </Button>
              <UjianExportButton
                filter={exportFilter}
                includePastExams={showPastExams}
                today={today}
                systemIdentity={systemIdentity}
              />
              {canManage && (
                <Button
                  onClick={() => setFormState({ open: true, mode: "create" })}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Ujian
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Program</SelectItem>
                {programOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterTanggalMulai}
                onChange={(e) => setFilterTanggalMulai(e.target.value)}
                placeholder="Dari tanggal"
              />
              <span className="text-sm text-muted-foreground sm:px-1">s/d</span>
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterTanggalSelesai}
                onChange={(e) => setFilterTanggalSelesai(e.target.value)}
                placeholder="Sampai tanggal"
              />
              {(filterTanggalMulai || filterTanggalSelesai) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterTanggalMulai("");
                    setFilterTanggalSelesai("");
                  }}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-full max-w-sm">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari mata pelajaran atau kelas..."
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <Table className="min-w-[56rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Mata Ujian</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Pengawas</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedData.length > 0 ? (
                    groupedData.map(([kelasName, rows]) => (
                      <Fragment key={kelasName}>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={7} className="py-3 font-semibold text-primary">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>{kelasName}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {rows[0]?.program} - {rows[0]?.mode}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {rows.map((row) => {
                          const d = parseIsoDateInJakarta(row.tanggalUjian);
                          return (
                            <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                              <TableCell className="whitespace-nowrap text-sm">
                                {d.toLocaleDateString("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  timeZone: APP_TIME_ZONE,
                                })}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {row.jamMulai} - {row.jamSelesai}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  {row.mataPelajaran.map((m, i) => (
                                    <span key={i} className="text-sm font-medium">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm">{row.namaKelas}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {row.program} - {row.mode}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{row.jumlahPengawas} orang</span>
                                  {row.adaKonflik && <ConflictBadge />}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Aksi</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => router.push(`/jadwal-ujian/${row.id}`)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Lihat Detail
                                    </DropdownMenuItem>
                                    {canManage && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => setFormState({ open: true, mode: "edit", row })}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Ubah
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onClick={() => setDeleteTarget(row)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Hapus
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="p-4">
                        <EmptyState
                          icon={CalendarX}
                          title="Belum ada jadwal ujian"
                          description={
                            searchQuery || filterProgram !== "__all__" || filterTanggalMulai || filterTanggalSelesai
                              ? "Tidak ada jadwal ujian yang cocok dengan filter saat ini."
                              : "Tambahkan jadwal ujian untuk mulai mengatur kelas, mata ujian, dan pengawas."
                          }
                          action={
                            canManage ? (
                              <Button
                                onClick={() => setFormState({ open: true, mode: "create" })}
                                size="sm"
                              >
                                <Plus className="h-4 w-4" />
                                Tambah Ujian
                              </Button>
                            ) : null
                          }
                          className="min-h-44"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-muted-foreground">{filteredData.length} baris</div>
          </div>
        </CardContent>
      </Card>

      <UjianForm
        open={formState.open}
        onOpenChange={(open) => (open ? null : setFormState({ open: false }))}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        kelasList={kelasList}
        pengawasList={pengawasList}
        materiList={materiList}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Jadwal Ujian?</DialogTitle>
            <DialogDescription>
              Ujian{" "}
              <span className="font-medium text-foreground">{deleteTarget?.mataPelajaran.join(" & ")}</span>{" "}
              pada <span className="font-medium text-foreground">{deleteTarget?.tanggalUjian}</span> beserta semua
              penugasan pengawasnya akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
