"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { deleteInstructor } from "@/server/actions/jadwal-otomatis/instructors";

type InstrukturTableRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  expertiseCount: number;
  weeklySessions: number;
  monthlySessions: number;
  activeClassCount: number;
};

interface InstrukturTableProps {
  initialData: InstrukturTableRow[];
  canManage: boolean;
}

export function InstrukturTable({ initialData, canManage }: InstrukturTableProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<InstrukturTableRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const columns = useMemo<ColumnDef<InstrukturTableRow>[]>(() => {
    const base: ColumnDef<InstrukturTableRow>[] = [
      {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email ?? <span className="text-muted-foreground text-xs">-</span>,
      },
      {
        accessorKey: "phone",
        header: "Telepon",
        cell: ({ row }) => row.original.phone ?? <span className="text-muted-foreground text-xs">-</span>,
      },
      {
        accessorKey: "expertiseCount",
        header: "Keahlian",
        cell: ({ row }) => <span className="tabular-nums">{row.original.expertiseCount}</span>,
      },
      {
        id: "workload",
        header: "Beban Kerja",
        cell: ({ row }) => (
          <div className="text-xs">
            <p>
              7h: <span className="tabular-nums">{row.original.weeklySessions}</span> sesi
            </p>
            <p>
              30h: <span className="tabular-nums">{row.original.monthlySessions}</span> sesi
            </p>
          </div>
        ),
      },
      {
        accessorKey: "activeClassCount",
        header: "Kelas Aktif",
        cell: ({ row }) => <span className="tabular-nums">{row.original.activeClassCount}</span>,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        ),
      },
    ];

    base.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/jadwal-otomatis/instruktur/${row.original.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                Detail
              </DropdownMenuItem>
              {canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row.original)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });

    return base;
  }, [canManage, router]);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const result = await deleteInstructor(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menghapus instruktur.");
        return;
      }
      if (result.mode === "deactivated") {
        toast.info(
          `Instruktur "${deleteTarget.name}" tidak bisa dihapus karena masih dipakai (${result.referenceCount} assignment). Status diubah jadi nonaktif.`,
        );
      } else {
        toast.success(`Instruktur "${deleteTarget.name}" dihapus.`);
      }
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Daftar Instruktur</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={initialData}
            searchColumnId="name"
            searchPlaceholder="Cari instruktur..."
            emptyMessage="Belum ada instruktur."
          />
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Instruktur?</DialogTitle>
            <DialogDescription>
              Instruktur <span className="font-medium">{deleteTarget?.name}</span> akan dihapus permanen.
              Jika masih terhubung ke jadwal, sistem otomatis mengubah menjadi nonaktif.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
