"use client";

import { useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { MateriForm } from "./MateriForm";
import { deleteMateri, type MateriRow } from "@/server/actions/jadwal-ujian/materi";

interface MateriManagerProps {
  initialData: MateriRow[];
  canManage: boolean;
  programOptions: string[];
}

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: MateriRow };

export function MateriManager({ initialData, canManage, programOptions }: MateriManagerProps) {
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<MateriRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const columns = useMemo<ColumnDef<MateriRow>[]>(() => {
    const base: ColumnDef<MateriRow>[] = [
      {
        accessorKey: "program",
        header: "Program",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.program}</span>
        ),
      },
      {
        accessorKey: "nama",
        header: "Nama Materi Ujian",
        cell: ({ row }) => <span className="font-medium">{row.original.nama}</span>,
      },
      {
        accessorKey: "urutan",
        header: "Urutan",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">{row.original.urutan}</span>
        ),
      },
    ];

    if (canManage) {
      base.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Aksi</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setFormState({ open: true, mode: "edit", row: row.original })}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Ubah
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      });
    }

    return base;
  }, [canManage]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const res = await deleteMateri(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Materi "${deleteTarget.nama}" dihapus.`);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          {canManage && (
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setFormState({ open: true, mode: "create" })} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Tambah Materi
              </Button>
            </div>
          )}
          <DataTable
            columns={columns}
            data={initialData}
            searchColumnId="nama"
            searchPlaceholder="Cari nama materi..."
            emptyMessage="Belum ada materi ujian. Klik 'Tambah Materi' untuk memulai."
          />
        </CardContent>
      </Card>

      <MateriForm
        open={formState.open}
        onOpenChange={(open) => (open ? null : setFormState({ open: false }))}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        programOptions={programOptions}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Materi Ujian?</DialogTitle>
            <DialogDescription>
              Materi{" "}
              <span className="font-medium text-foreground">{deleteTarget?.nama}</span>{" "}
              akan dihapus dari daftar master. Data jadwal ujian yang sudah ada tidak terpengaruh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting} className="w-full sm:w-auto">
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
