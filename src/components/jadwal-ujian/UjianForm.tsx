"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ujianCreateSchema, type UjianCreateInput } from "@/lib/validators/jadwalUjian.schema";
import { createUjian, updateUjian, checkBatchConflicts, type UjianRow } from "@/server/actions/jadwal-ujian/ujian";
import { getPenugasanByUjian } from "@/server/actions/jadwal-ujian/penugasan";
import type { KelasRow } from "@/server/actions/jadwal-ujian/kelas";
import type { PengawasRow } from "@/server/actions/jadwal-ujian/pengawas";
import type { MateriRow } from "@/server/actions/jadwal-ujian/materi";

function getBebanInfo(jumlahTugas: number): { label: string; className: string } {
  if (jumlahTugas === 0) return { label: "Belum ada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (jumlahTugas <= 3) return { label: `${jumlahTugas} tugas`, className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (jumlahTugas <= 7) return { label: `${jumlahTugas} tugas`, className: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: `${jumlahTugas} tugas`, className: "bg-red-100 text-red-700 border-red-200" };
}

interface UjianFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: UjianRow | null;
  kelasList: Pick<KelasRow, "id" | "namaKelas" | "program">[];
  pengawasList: Pick<PengawasRow, "id" | "nama" | "jumlahTugas">[];
  materiList: Pick<MateriRow, "id" | "nama" | "program">[];
}

export function UjianForm({ open, onOpenChange, mode, initialData, kelasList, pengawasList, materiList }: UjianFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMateri, setSelectedMateri] = useState<string[]>([]);
  const [conflictConfirm, setConflictConfirm] = useState<{
    values: UjianCreateInput;
    konflikPengawas: { id: string; nama: string }[];
  } | null>(null);

  const form = useForm<UjianCreateInput>({
    resolver: zodResolver(ujianCreateSchema),
    defaultValues: { kelasId: "", mataPelajaran: [], tanggalUjian: "", jamMulai: "", jamSelesai: "", catatan: "" },
  });

  const selectedKelasId = useWatch({ control: form.control, name: "kelasId" });
  const selectedKelasProgram = useMemo(
    () => kelasList.find((k) => k.id === selectedKelasId)?.program ?? null,
    [kelasList, selectedKelasId],
  );
  const filteredMateri = useMemo(
    () => selectedKelasProgram ? materiList.filter((m) => m.program === selectedKelasProgram) : materiList,
    [materiList, selectedKelasProgram],
  );

  const prevKelasId = useMemo(() => initialData?.kelasId, [initialData]);
  useEffect(() => {
    if (!open) return;
    if (selectedKelasId && selectedKelasId !== prevKelasId && mode === "create") {
      setSelectedMateri([]);
      form.setValue("mataPelajaran", [], { shouldValidate: false });
    }
  }, [selectedKelasId, prevKelasId, mode, open, form]);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      form.reset({
        kelasId: initialData.kelasId,
        mataPelajaran: initialData.mataPelajaran,
        tanggalUjian: initialData.tanggalUjian,
        jamMulai: initialData.jamMulai,
        jamSelesai: initialData.jamSelesai,
        catatan: initialData.catatan ?? "",
      });
      setSelectedMateri(initialData.mataPelajaran);
      getPenugasanByUjian(initialData.id).then((rows) => {
        setSelectedIds(new Set(rows.map((r) => r.pengawasId)));
      });
    } else {
      form.reset({ kelasId: "", mataPelajaran: [], tanggalUjian: "", jamMulai: "", jamSelesai: "", catatan: "" });
      setSelectedMateri([]);
      setSelectedIds(new Set());
    }
  }, [open, mode, initialData, form]);

  function toggleMateri(nama: string) {
    let next: string[];
    if (selectedMateri.includes(nama)) {
      next = selectedMateri.filter((n) => n !== nama);
    } else {
      if (selectedMateri.length >= 2) return;
      next = [...selectedMateri, nama];
    }
    setSelectedMateri(next);
    form.setValue("mataPelajaran", next, { shouldValidate: true });
  }

  function togglePengawas(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(values: UjianCreateInput) {
    startTransition(async () => {
      const pengawasIds = Array.from(selectedIds);

      // Pre-check konflik sebelum simpan (kecuali sudah di-confirm)
      if (pengawasIds.length > 0 && !conflictConfirm) {
        const excludeId = mode === "edit" && initialData ? initialData.id : undefined;
        const conflicts = await checkBatchConflicts({
          pengawasIds,
          tanggalUjian: values.tanggalUjian,
          jamMulai: values.jamMulai,
          jamSelesai: values.jamSelesai,
          excludeUjianId: excludeId,
        });

        if (conflicts.length > 0) {
          const konflikPengawas = conflicts.map((c) => ({
            id: c.pengawasId,
            nama: pengawasList.find((p) => p.id === c.pengawasId)?.nama ?? c.pengawasId,
          }));
          setConflictConfirm({ values, konflikPengawas });
          return;
        }
      }

      const res =
        mode === "edit" && initialData
          ? await updateUjian({ ...values, id: initialData.id, pengawasIds })
          : await createUjian({ ...values, pengawasIds });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const warnings: string[] = [];
      if (res.konflikPengawasIds && res.konflikPengawasIds.length > 0) {
        const namaKonflik = res.konflikPengawasIds
          .map((id) => pengawasList.find((p) => p.id === id)?.nama ?? id)
          .join(", ");
        warnings.push(`Konflik pengawas: ${namaKonflik}`);
      }
      if (warnings.length > 0) {
        toast.warning(`Jadwal disimpan dengan konflik (force). ${warnings.join(" | ")}`);
      } else {
        toast.success(mode === "edit" ? "Jadwal ujian diperbarui." : "Jadwal ujian berhasil dibuat.");
      }
      setConflictConfirm(null);
      onOpenChange(false);
    });
  }

  function handleForceSubmit() {
    if (!conflictConfirm) return;
    // Langsung submit tanpa pre-check lagi
    const { values } = conflictConfirm;
    startTransition(async () => {
      const pengawasIds = Array.from(selectedIds);
      const res =
        mode === "edit" && initialData
          ? await updateUjian({ ...values, id: initialData.id, pengawasIds })
          : await createUjian({ ...values, pengawasIds });

      if (!res.ok) {
        toast.error(res.error);
        setConflictConfirm(null);
        return;
      }

      toast.warning("Jadwal disimpan meskipun ada konflik pengawas.");
      setConflictConfirm(null);
      onOpenChange(false);
    });
  }

  // Sort by jumlahTugas (ringan ke berat), lalu alfabetis jika sama
  const sortedPengawas = [...pengawasList].sort((a, b) => {
    if (a.jumlahTugas !== b.jumlahTugas) return a.jumlahTugas - b.jumlahTugas;
    return a.nama.localeCompare(b.nama, "id");
  });

  // Pengawas dengan beban teringan (untuk badge rekomendasi)
  const minBeban = sortedPengawas.length > 0 ? sortedPengawas[0]!.jumlahTugas : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Ubah Jadwal Ujian" : "Tambah Jadwal Ujian"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Perbarui data jadwal ujian." : "Isi detail jadwal ujian baru."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} id="ujian-form" className="space-y-4">
            <FormField
              control={form.control}
              name="kelasId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kelas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kelas..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {kelasList.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.namaKelas}
                          <span className="ml-2 text-muted-foreground text-xs">({k.program})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mataPelajaran"
              render={() => (
                <FormItem>
                  <FormLabel>
                    Mata Ujian{" "}
                    <span className="text-muted-foreground font-normal">(pilih 1–2)</span>
                  </FormLabel>
                  {!selectedKelasId ? (
                    <p className="text-sm text-muted-foreground">Pilih kelas terlebih dahulu.</p>
                  ) : filteredMateri.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Belum ada materi untuk program {selectedKelasProgram}. Tambah di halaman Materi Ujian.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                      {filteredMateri.map((m) => {
                        const checked = selectedMateri.includes(m.nama);
                        const disabled = !checked && selectedMateri.length >= 2;
                        return (
                          <div key={m.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`mat-${m.id}`}
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() => toggleMateri(m.nama)}
                            />
                            <label
                              htmlFor={`mat-${m.id}`}
                              className={`text-sm leading-none select-none ${disabled ? "text-muted-foreground" : "cursor-pointer"}`}
                            >
                              {m.nama}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedMateri.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Dipilih: {selectedMateri.join(" & ")}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tanggalUjian"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Ujian</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="jamMulai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jam Mulai</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jamSelesai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jam Selesai</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Informasi tambahan..." {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Pengawas{" "}
                <span className="text-muted-foreground font-normal">(opsional)</span>
              </p>
              {sortedPengawas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data pengawas.</p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 rounded-md border p-3">
                    {sortedPengawas.map((p) => {
                      const beban = getBebanInfo(p.jumlahTugas);
                      const isRecommended = p.jumlahTugas === minBeban;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors ${
                            selectedIds.has(p.id) ? "bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              id={`pg-${p.id}`}
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={() => togglePengawas(p.id)}
                            />
                            <label
                              htmlFor={`pg-${p.id}`}
                              className="text-sm leading-none cursor-pointer select-none truncate"
                            >
                              {p.nama}
                            </label>
                            {isRecommended && !selectedIds.has(p.id) && (
                              <span className="shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 leading-none">
                                Disarankan
                              </span>
                            )}
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-medium border rounded-full px-1.5 py-0.5 leading-none ${
                              beban.className
                            }`}
                          >
                            {beban.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
              {selectedIds.size > 0 && (
                <p className="text-xs text-muted-foreground">{selectedIds.size} pengawas dipilih</p>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Konflik jadwal akan dicek otomatis saat menyimpan. Jika ada konflik, Anda akan diminta konfirmasi.
                </p>
              </div>
            )}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" form="ujian-form" disabled={isPending}>
            {isPending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog konfirmasi konflik batch */}
      {conflictConfirm && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Konflik Jadwal Terdeteksi
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>Pengawas berikut memiliki jadwal yang bentrok:</p>
                <ul className="space-y-1">
                  {conflictConfirm.konflikPengawas.map((p) => (
                    <li key={p.id} className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium">
                      {p.nama}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Apakah tetap ingin menyimpan jadwal dengan pengawas yang bentrok?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConflictConfirm(null)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleForceSubmit}
              disabled={isPending}
            >
              {isPending ? "Menyimpan..." : "Tetap Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
