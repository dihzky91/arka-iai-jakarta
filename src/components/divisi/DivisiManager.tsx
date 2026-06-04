"use client";

import { useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { DivisiForm } from "./DivisiForm";
import { deleteDivisi, type DivisiRow } from "@/server/actions/divisi";
import { formatTanggal } from "@/lib/utils";

interface DivisiManagerProps {
  initialData: DivisiRow[];
  canManage: boolean;
}

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: DivisiRow };

export function DivisiManager({ initialData, canManage }: DivisiManagerProps) {
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<DivisiRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const columns = useMemo<ColumnDef<DivisiRow>[]>(() => {
    const base: ColumnDef<DivisiRow>[] = [
      {
        accessorKey: "nama",
        header: "Nama Divisi",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.nama}</span>
        ),
      },
      {
        accessorKey: "kode",
        header: "Kode",
        cell: ({ row }) =>
          row.original.kode ? (
            <Badge variant="secondary" className="font-mono">
              {row.original.kode}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: "jumlahPegawai",
        header: "Jumlah Pegawai",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.jumlahPegawai}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Dibuat",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatTanggal(row.original.createdAt)}
          </span>
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
                  onClick={() =>
                    setFormState({
                      open: true,
                      mode: "edit",
                      row: row.original,
                    })
                  }
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
      const res = await deleteDivisi({ id: deleteTarget.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Divisi "${deleteTarget.nama}" dihapus.`);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          {canManage ? (
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setFormState({ open: true, mode: "create" })}>
                <Plus className="h-4 w-4" />
                Tambah Divisi
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={columns}
            data={initialData}
            searchColumnId="nama"
            searchPlaceholder="Cari nama divisi..."
            emptyMessage="Belum ada divisi. Klik 'Tambah Divisi' untuk memulai."
          />
        </CardContent>
      </Card>

      <DivisiForm
        open={formState.open}
        onOpenChange={(open) =>
          open ? null : setFormState({ open: false })
        }
        mode={formState.open ? formState.mode : "create"}
        initialData={
          formState.open && formState.mode === "edit" ? formState.row : null
        }
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Divisi?</DialogTitle>
            <DialogDescription>
              Divisi{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.nama}
              </span>{" "}
              akan dihapus permanen. Aksi ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
