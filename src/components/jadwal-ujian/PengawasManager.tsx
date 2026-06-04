"use client";

import { useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PengawasForm } from "./PengawasForm";
import { deletePengawas, type PengawasRow } from "@/server/actions/jadwal-ujian/pengawas";

interface PengawasManagerProps {
  initialData: PengawasRow[];
  canManage: boolean;
}

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: PengawasRow };

export function PengawasManager({ initialData, canManage }: PengawasManagerProps) {
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<PengawasRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const columns = useMemo<ColumnDef<PengawasRow>[]>(() => {
    const base: ColumnDef<PengawasRow>[] = [
      {
        accessorKey: "nama",
        header: "Nama Pengawas",
        cell: ({ row }) => <span className="font-medium">{row.original.nama}</span>,
      },
      {
        accessorKey: "jumlahTugas",
        header: "Jumlah Tugas",
        cell: ({ row }) => (
          <Badge variant={row.original.jumlahTugas > 0 ? "secondary" : "outline"}>
            {row.original.jumlahTugas} tugas
          </Badge>
        ),
      },
      {
        accessorKey: "catatan",
        header: "Catatan",
        cell: ({ row }) =>
          row.original.catatan ? (
            <span className="text-sm text-muted-foreground line-clamp-1">
              {row.original.catatan}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
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
      const res = await deletePengawas(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pengawas "${deleteTarget.nama}" dihapus.`);
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
                Tambah Pengawas
              </Button>
            </div>
          )}
          <DataTable
            columns={columns}
            data={initialData}
            searchColumnId="nama"
            searchPlaceholder="Cari nama pengawas..."
            emptyMessage="Belum ada pengawas. Klik 'Tambah Pengawas' untuk memulai."
          />
        </CardContent>
      </Card>

      <PengawasForm
        open={formState.open}
        onOpenChange={(open) => (open ? null : setFormState({ open: false }))}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pengawas?</DialogTitle>
            <DialogDescription>
              Pengawas{" "}
              <span className="font-medium text-foreground">{deleteTarget?.nama}</span>{" "}
              akan dihapus permanen. Aksi ini tidak dapat dibatalkan.
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
