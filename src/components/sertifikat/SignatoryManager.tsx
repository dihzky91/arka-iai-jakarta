"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Signature, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSignatory,
  deleteSignatory,
  updateSignatory,
  type SignatoryRow,
} from "@/server/actions/sertifikat/signatories";
import { EmptyState } from "@/components/ui/empty-state";

const signatorySchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi."),
  jabatan: z.string().trim().optional(),
});

type SignatoryFormValues = z.infer<typeof signatorySchema>;

function toFormValues(signatory?: SignatoryRow): SignatoryFormValues {
  return {
    nama: signatory?.nama ?? "",
    jabatan: signatory?.jabatan ?? "",
  };
}

export function SignatoryManager({ initialData }: { initialData: SignatoryRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SignatoryRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignatoryFormValues>({
    resolver: zodResolver(signatorySchema),
    defaultValues: toFormValues(),
  });

  function openCreateDialog() {
    setEditing(null);
    form.reset(toFormValues());
    setDialogOpen(true);
  }

  function openEditDialog(signatory: SignatoryRow) {
    setEditing(signatory);
    form.reset(toFormValues(signatory));
    setDialogOpen(true);
  }

  function submit(values: SignatoryFormValues) {
    startTransition(async () => {
      const result = editing
        ? await updateSignatory(editing.id, values)
        : await createSignatory(values);

      if (result.ok) {
        toast.success(editing ? "Penandatangan berhasil diperbarui." : "Penandatangan berhasil ditambahkan.");
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(signatory: SignatoryRow) {
    if (!window.confirm(`Hapus penandatangan "${signatory.nama}"?`)) return;
    startTransition(async () => {
      const result = await deleteSignatory(signatory.id);
      if (result.ok) {
        toast.success("Penandatangan berhasil dihapus.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Tambah Penandatangan
        </Button>
      </div>

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>Data Penandatangan</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Link Pejabat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.map((signatory) => (
                <TableRow key={signatory.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="font-medium">{signatory.nama}</TableCell>
                  <TableCell>{signatory.jabatan ?? "-"}</TableCell>
                  <TableCell>{signatory.pejabatJabatan ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon-sm" onClick={() => openEditDialog(signatory)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon-sm" onClick={() => remove(signatory)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {initialData.length === 0 ? (
            <EmptyState
              icon={Signature}
              title="Belum ada penandatangan"
              description="Tambahkan penandatangan agar template sertifikat bisa memakai data pejabat yang konsisten."
              action={
                <Button type="button" size="sm" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Tambah Penandatangan
                </Button>
              }
              className="mt-4"
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Penandatangan" : "Tambah Penandatangan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input {...form.register("nama")} />
              {form.formState.errors.nama?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.nama.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Jabatan</Label>
              <Input {...form.register("jabatan")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
