"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MoreHorizontal, Pencil, Plus, Search, UserX } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createNarasumber,
  updateNarasumber,
  deactivateNarasumber,
  listNarasumber,
} from "@/server/actions/ppl-evaluasi/narasumber";
import type {
  NarasumberRow,
  PaginatedResult,
} from "@/server/actions/ppl-evaluasi/types";

// ─── Form Schema ─────────────────────────────────────────────────────────────

const narasumberFormSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi").max(200, "Nama maksimal 200 karakter"),
  email: z.string().email("Format email tidak valid").max(150, "Email maksimal 150 karakter"),
  noTelepon: z.string().max(30, "No. telepon maksimal 30 karakter").regex(/^[0-9+\-]*$/, "Hanya angka, +, dan - yang diperbolehkan").optional().or(z.literal("")),
  feePerSkp: z.coerce.number().int("Fee harus bilangan bulat").min(0, "Fee minimal 0").max(99_999_999, "Fee maksimal 99.999.999"),
});

type NarasumberFormValues = z.infer<typeof narasumberFormSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

interface NarasumberListClientProps {
  initialData: PaginatedResult<NarasumberRow>;
}

export function NarasumberListClient({ initialData }: NarasumberListClientProps) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNarasumber, setEditingNarasumber] = useState<NarasumberRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NarasumberFormValues>({
    resolver: zodResolver(narasumberFormSchema),
    defaultValues: {
      nama: "",
      email: "",
      noTelepon: "",
      feePerSkp: 0,
    },
  });

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchData = useCallback(
    (opts: {
      search?: string;
      statusFilter?: "all" | "active" | "inactive";
      page?: number;
    }) => {
      startTransition(async () => {
        const isActive =
          opts.statusFilter === "active"
            ? true
            : opts.statusFilter === "inactive"
              ? false
              : undefined;

        const result = await listNarasumber({
          page: opts.page ?? 1,
          pageSize: 10,
          search: opts.search || undefined,
          isActive,
        });
        setData(result);
      });
    },
    [],
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchData({ search, statusFilter, page: 1 });
  }

  function handleStatusFilterChange(value: string) {
    const newStatus = value as "all" | "active" | "inactive";
    setStatusFilter(newStatus);
    setPage(1);
    fetchData({ search, statusFilter: newStatus, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData({ search, statusFilter, page: newPage });
  }

  // ─── Dialog Handlers ─────────────────────────────────────────────────────

  function openCreateDialog() {
    setEditingNarasumber(null);
    form.reset({ nama: "", email: "", noTelepon: "", feePerSkp: 0 });
    setDialogOpen(true);
  }

  function openEditDialog(row: NarasumberRow) {
    setEditingNarasumber(row);
    form.reset({
      nama: row.nama,
      email: row.email,
      noTelepon: row.noTelepon ?? "",
      feePerSkp: row.feePerSkp,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: NarasumberFormValues) {
    setIsSubmitting(true);
    try {
      if (editingNarasumber) {
        const result = await updateNarasumber(editingNarasumber.id, {
          nama: values.nama,
          email: values.email,
          noTelepon: values.noTelepon || undefined,
          feePerSkp: values.feePerSkp,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Gagal memperbarui narasumber");
          return;
        }
        toast.success("Narasumber berhasil diperbarui");
      } else {
        const result = await createNarasumber({
          nama: values.nama,
          email: values.email,
          noTelepon: values.noTelepon || undefined,
          feePerSkp: values.feePerSkp,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Gagal membuat narasumber");
          return;
        }
        toast.success("Narasumber berhasil ditambahkan");
      }
      setDialogOpen(false);
      fetchData({ search, statusFilter, page });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(row: NarasumberRow) {
    const result = await deactivateNarasumber(row.id);
    if (!result.ok) {
      toast.error(result.error ?? "Gagal menonaktifkan narasumber");
      return;
    }
    toast.success("Narasumber berhasil dinonaktifkan");
    fetchData({ search, statusFilter, page });
  }

  // ─── Table Columns ───────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<NarasumberRow>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.nama}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: "expertise",
        header: "Kategori Keahlian",
        cell: ({ row }) => {
          // Expertise categories are not included in the basic list query
          // We show fee per SKP as a useful indicator instead
          const fee = row.original.feePerSkp;
          return (
            <span className="text-sm tabular-nums">
              {fee > 0
                ? `Rp ${fee.toLocaleString("id-ID")}/SKP`
                : "-"}
            </span>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => {
          const active = row.original.isActive;
          return (
            <Badge variant={active ? "default" : "outline"}>
              {active ? "Aktif" : "Nonaktif"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Aksi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {row.original.isActive && (
                <DropdownMenuItem
                  onClick={() => handleDeactivate(row.original)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Nonaktifkan
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Daftar Narasumber</CardTitle>
              <CardDescription className="mt-1">
                Kelola profil narasumber, keahlian, dan fee honorarium.
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Tambah Narasumber
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari narasumber..."
                  className="pl-9"
                  onBlur={() => {
                    if (search !== "") {
                      fetchData({ search, statusFilter, page: 1 });
                      setPage(1);
                    }
                  }}
                />
              </form>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
              <DataTable
                columns={columns}
                data={data.data}
                emptyMessage="Belum ada narasumber. Klik 'Tambah Narasumber' untuk memulai."
                pageSize={data.pageSize}
              />
            </div>

            {/* Server-side Pagination */}
            {data.totalPages > 1 && (
              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground">
                  {data.total} narasumber · Halaman {data.page} / {data.totalPages}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || isPending}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= data.totalPages || isPending}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingNarasumber ? "Edit Narasumber" : "Tambah Narasumber"}
            </DialogTitle>
            <DialogDescription>
              {editingNarasumber
                ? "Perbarui data narasumber."
                : "Isi data narasumber baru."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input
                id="nama"
                placeholder="Nama lengkap narasumber"
                {...form.register("nama")}
              />
              {form.formState.errors.nama && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.nama.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@contoh.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="noTelepon">No. Telepon</Label>
              <Input
                id="noTelepon"
                placeholder="+62-812-3456-7890"
                {...form.register("noTelepon")}
              />
              {form.formState.errors.noTelepon && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.noTelepon.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feePerSkp">Fee per SKP (Rp)</Label>
              <Input
                id="feePerSkp"
                type="number"
                placeholder="0"
                {...form.register("feePerSkp")}
              />
              {form.formState.errors.feePerSkp && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.feePerSkp.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Menyimpan..."
                  : editingNarasumber
                    ? "Simpan Perubahan"
                    : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
