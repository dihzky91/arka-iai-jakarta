"use client";

import { useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { KelasForm } from "./KelasForm";
import { deleteKelas, type KelasRow } from "@/server/actions/jadwal-ujian/kelas";

const MODE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  Offline: "default",
  Online: "secondary",
};

interface KelasManagerProps {
  initialData: KelasRow[];
  canManage: boolean;
  programOptions: string[];
  tipeOptions: string[];
  modeOptions: string[];
}

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: KelasRow };

export function KelasManager({ initialData, canManage, programOptions, tipeOptions, modeOptions }: KelasManagerProps) {
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<KelasRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [filterProgram, setFilterProgram] = useState<string>("__all__");

  const filteredData = useMemo(
    () =>
      filterProgram === "__all__"
        ? initialData
        : initialData.filter((k) => k.program === filterProgram),
    [initialData, filterProgram],
  );

  const columns = useMemo<ColumnDef<KelasRow>[]>(() => {
    const base: ColumnDef<KelasRow>[] = [
      {
        accessorKey: "namaKelas",
        header: "Nama Kelas",
        cell: ({ row }) => <span className="font-medium">{row.original.namaKelas}</span>,
      },
      {
        id: "sumber",
        header: "Sumber",
        cell: ({ row }) =>
          row.original.kelasPelatihanId ? (
            <Badge variant="outline" className="border-blue-300 text-blue-700 text-xs gap-1">
              Jadwal Otomatis
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "program",
        header: "Program",
        cell: ({ row }) => <Badge variant="secondary">{row.original.program}</Badge>,
      },
      {
        accessorKey: "tipe",
        header: "Tipe",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.tipe}</span>
        ),
      },
      {
        accessorKey: "mode",
        header: "Mode",
        cell: ({ row }) => (
          <Badge variant={MODE_COLORS[row.original.mode] ?? "outline"}>{row.original.mode}</Badge>
        ),
      },
      {
        accessorKey: "lokasi",
        header: "Lokasi",
        cell: ({ row }) =>
          row.original.lokasi ? (
            <span className="text-sm text-muted-foreground">{row.original.lokasi}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: "jumlahUjian",
        header: "Jadwal Ujian",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{row.original.jumlahUjian}</span>
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
      const res = await deleteKelas(deleteTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Kelas "${deleteTarget.namaKelas}" dihapus.`);
      setDeleteTarget(null);
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Daftar Kelas</CardTitle>
              <CardDescription className="mt-1">
                Kelola kelas ujian berdasarkan program, tipe, dan mode pembelajaran.
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => setFormState({ open: true, mode: "create" })} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Tambah Kelas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
            <span className="text-sm text-muted-foreground">Filter program:</span>
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Program</SelectItem>
                {programOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={filteredData}
            searchColumnId="namaKelas"
            searchPlaceholder="Cari nama kelas..."
            emptyMessage="Belum ada kelas. Klik 'Tambah Kelas' untuk memulai."
          />
        </CardContent>
      </Card>

      <KelasForm
        open={formState.open}
        onOpenChange={(open) => (open ? null : setFormState({ open: false }))}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        programOptions={programOptions}
        tipeOptions={tipeOptions}
        modeOptions={modeOptions}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Kelas?</DialogTitle>
            <DialogDescription>
              Kelas{" "}
              <span className="font-medium text-foreground">{deleteTarget?.namaKelas}</span>{" "}
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
