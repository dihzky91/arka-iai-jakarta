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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  keluargaCreateSchema,
  keluargaUpdateSchema,
  type KeluargaCreateInput,
  type KeluargaUpdateInput,
} from "@/lib/validators/pegawai.schema";
import {
  listKeluarga,
  createKeluarga,
  updateKeluarga,
  deleteKeluarga,
  type KeluargaRow,
} from "@/server/actions/pegawai";
import { formatTanggal } from "@/lib/utils";

const HUBUNGAN_OPTIONS = ["Suami", "Istri", "Anak", "Ayah", "Ibu", "Saudara", "Lainnya"];

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: KeluargaRow };

export function KeluargaTab({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<KeluargaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<KeluargaRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    listKeluarga(userId).then((data) => {
      setRows(data);
      setIsLoading(false);
    });
  }, [userId]);

  function handleSaved(row: KeluargaRow, mode: "create" | "edit") {
    setRows((prev) =>
      mode === "create" ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r)),
    );
    setFormState({ open: false });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deleteKeluarga({ id: deleteTarget.id, userId });
      if (!res.ok) {
        toast.error("Gagal menghapus data.");
        return;
      }
      toast.success("Data keluarga dihapus.");
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Memuat data keluarga...</div>;
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 && canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormState({ open: true, mode: "create" })}>
            <Plus className="h-4 w-4" />
            Tambah Anggota
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada data keluarga"
          description="Tambahkan anggota keluarga pegawai ini."
          action={canEdit ? (
            <Button size="sm" onClick={() => setFormState({ open: true, mode: "create" })}>
              <Plus className="h-4 w-4" />
              Tambah Anggota
            </Button>
          ) : null}
        />
      ) : (
        <div className="divide-y divide-border/60 rounded-2xl border border-border/60 overflow-hidden">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/35">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.namaAnggota}</p>
                <p className="text-sm text-muted-foreground">
                  {row.hubungan ?? "—"} · {row.pekerjaan ?? "—"} ·{" "}
                  {row.tanggalLahir ? formatTanggal(row.tanggalLahir) : "—"}
                </p>
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

      <KeluargaFormDialog
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
            <DialogTitle>Hapus Anggota Keluarga?</DialogTitle>
            <DialogDescription>
              Data <span className="font-medium text-foreground">{deleteTarget?.namaAnggota}</span> akan dihapus permanen.
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

function KeluargaFormDialog({
  open,
  mode,
  initialData,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialData: KeluargaRow | null;
  userId: string;
  onClose: () => void;
  onSaved: (row: KeluargaRow, mode: "create" | "edit") => void;
}) {
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<KeluargaCreateInput>({
    resolver: zodResolver(keluargaCreateSchema),
    values: {
      userId,
      hubungan: initialData?.hubungan ?? "",
      namaAnggota: initialData?.namaAnggota ?? "",
      tempatLahir: initialData?.tempatLahir ?? "",
      tanggalLahir: initialData?.tanggalLahir ?? "",
      pekerjaan: initialData?.pekerjaan ?? "",
    },
  });

  const editForm = useForm<KeluargaUpdateInput>({
    resolver: zodResolver(keluargaUpdateSchema),
    values: {
      id: initialData?.id ?? 0,
      userId,
      hubungan: initialData?.hubungan ?? "",
      namaAnggota: initialData?.namaAnggota ?? "",
      tempatLahir: initialData?.tempatLahir ?? "",
      tanggalLahir: initialData?.tanggalLahir ?? "",
      pekerjaan: initialData?.pekerjaan ?? "",
    },
  });

  const form = (mode === "edit" ? editForm : createForm) as unknown as UseFormReturn<FieldValues>;

  function onSubmit(values: KeluargaCreateInput | KeluargaUpdateInput) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          const res = await createKeluarga(values);
          if (res.ok) { toast.success("Anggota keluarga ditambahkan."); onSaved(res.data, "create"); }
        } else {
          const res = await updateKeluarga(values);
          if (!res.ok) { toast.error(res.error); return; }
          toast.success("Data keluarga diperbarui.");
          onSaved(res.data, "edit");
        }
      } catch {
        toast.error("Gagal menyimpan data.");
      }
    });
  }

  const fields = (
    <>
      <FormField control={form.control as never} name="namaAnggota" render={({ field }) => (
        <FormItem className="md:col-span-2">
          <FormLabel>Nama Anggota <span className="text-destructive">*</span></FormLabel>
          <FormControl><Input {...field} disabled={isPending} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control as never} name="hubungan" render={({ field }) => (
        <FormItem>
          <FormLabel>Hubungan</FormLabel>
          <Select
            value={field.value ?? ""}
            onValueChange={field.onChange}
            disabled={isPending}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih hubungan" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {HUBUNGAN_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control as never} name="pekerjaan" render={({ field }) => (
        <FormItem>
          <FormLabel>Pekerjaan</FormLabel>
          <FormControl><Input {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control as never} name="tempatLahir" render={({ field }) => (
        <FormItem>
          <FormLabel>Tempat Lahir</FormLabel>
          <FormControl><Input {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control as never} name="tanggalLahir" render={({ field }) => (
        <FormItem>
          <FormLabel>Tanggal Lahir</FormLabel>
          <FormControl><Input type="date" {...field} value={field.value ?? ""} disabled={isPending} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Anggota Keluarga" : "Ubah Anggota Keluarga"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit as never)}>
            {fields}
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
