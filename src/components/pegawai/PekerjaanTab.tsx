"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  pekerjaanCreateSchema,
  pekerjaanUpdateSchema,
  type PekerjaanCreateInput,
  type PekerjaanUpdateInput,
} from "@/lib/validators/pegawai.schema";
import {
  listPekerjaan,
  createPekerjaan,
  updatePekerjaan,
  deletePekerjaan,
  type PekerjaanRow,
} from "@/server/actions/pegawai";
import { formatTanggal } from "@/lib/utils";

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: PekerjaanRow };

export function PekerjaanTab({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<PekerjaanRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<PekerjaanRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    listPekerjaan(userId).then((data) => {
      setRows(data);
      setIsLoading(false);
    });
  }, [userId]);

  function handleSaved(row: PekerjaanRow, mode: "create" | "edit") {
    setRows((prev) =>
      mode === "create" ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r)),
    );
    setFormState({ open: false });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deletePekerjaan({ id: deleteTarget.id, userId });
      if (!res.ok) { toast.error("Gagal menghapus data."); return; }
      toast.success("Riwayat pekerjaan dihapus.");
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Memuat data pekerjaan...</div>;
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 && canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormState({ open: true, mode: "create" })}>
            <Plus className="h-4 w-4" />
            Tambah Riwayat
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat pekerjaan"
          description="Tambahkan riwayat pekerjaan pegawai ini."
          action={canEdit ? (
            <Button size="sm" onClick={() => setFormState({ open: true, mode: "create" })}>
              <Plus className="h-4 w-4" />
              Tambah Riwayat
            </Button>
          ) : null}
        />
      ) : (
        <div className="divide-y divide-border/60 rounded-2xl border border-border/60 overflow-hidden">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/35">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.namaPerusahaan ?? "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {row.jabatan ?? "—"} ·{" "}
                  {row.tanggalMulai ? formatTanggal(row.tanggalMulai) : "—"} s/d{" "}
                  {row.tanggalSelesai ? formatTanggal(row.tanggalSelesai) : "Sekarang"}
                </p>
                {row.keterangan ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{row.keterangan}</p>
                ) : null}
              </div>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setFormState({ open: true, mode: "edit", row })}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Ubah
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <PekerjaanFormDialog
        open={formState.open}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        userId={userId}
        onClose={() => setFormState({ open: false })}
        onSaved={handleSaved}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Riwayat Pekerjaan?</DialogTitle>
            <DialogDescription>
              Data <span className="font-medium text-foreground">{deleteTarget?.namaPerusahaan ?? "ini"}</span> akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PekerjaanFormDialog({
  open,
  mode,
  initialData,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialData: PekerjaanRow | null;
  userId: string;
  onClose: () => void;
  onSaved: (row: PekerjaanRow, mode: "create" | "edit") => void;
}) {
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<PekerjaanCreateInput>({
    resolver: zodResolver(pekerjaanCreateSchema),
    values: {
      userId,
      namaPerusahaan: initialData?.namaPerusahaan ?? "",
      jabatan: initialData?.jabatan ?? "",
      tanggalMulai: initialData?.tanggalMulai ?? "",
      tanggalSelesai: initialData?.tanggalSelesai ?? "",
      keterangan: initialData?.keterangan ?? "",
    },
  });

  const editForm = useForm<PekerjaanUpdateInput>({
    resolver: zodResolver(pekerjaanUpdateSchema),
    values: {
      id: initialData?.id ?? 0,
      userId,
      namaPerusahaan: initialData?.namaPerusahaan ?? "",
      jabatan: initialData?.jabatan ?? "",
      tanggalMulai: initialData?.tanggalMulai ?? "",
      tanggalSelesai: initialData?.tanggalSelesai ?? "",
      keterangan: initialData?.keterangan ?? "",
    },
  });

  const form = (mode === "edit" ? editForm : createForm) as unknown as UseFormReturn<FieldValues>;

  function onSubmit(values: PekerjaanCreateInput | PekerjaanUpdateInput) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          const res = await createPekerjaan(values);
          if (res.ok) { toast.success("Riwayat pekerjaan ditambahkan."); onSaved(res.data, "create"); }
        } else {
          const res = await updatePekerjaan(values);
          if (!res.ok) { toast.error(res.error); return; }
          toast.success("Riwayat pekerjaan diperbarui.");
          onSaved(res.data, "edit");
        }
      } catch {
        toast.error("Gagal menyimpan data.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Riwayat Pekerjaan" : "Ubah Riwayat Pekerjaan"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit as never)}>
            <FormField control={form.control as never} name="namaPerusahaan" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nama Perusahaan / Instansi</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control as never} name="jabatan" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Jabatan</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control as never} name="tanggalMulai" render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Mulai</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control as never} name="tanggalSelesai" render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Selesai</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control as never} name="keterangan" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Keterangan</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Batal</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
