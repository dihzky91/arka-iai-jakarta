"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Search, CalendarDays } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";
import type {
  KategoriPpl,
  KegiatanRow,
  PaginatedResult,
  StatusPpl,
} from "@/server/actions/ppl-evaluasi/types";

const KATEGORI_OPTIONS: KategoriPpl[] = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan",
  "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik",
  "SAK & PSAK",
];

const STATUS_OPTIONS: { value: StatusPpl; label: string }[] = [
  { value: "aktif", label: "Aktif" },
  { value: "archived", label: "Diarsipkan" },
];

interface KegiatanListClientProps {
  initialData: PaginatedResult<KegiatanRow>;
}

export function KegiatanListClient({ initialData }: KegiatanListClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState<KategoriPpl | "all">("all");
  const [status, setStatus] = useState<StatusPpl | "all">("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(
    (opts: {
      search?: string;
      kategori?: KategoriPpl | "all";
      status?: StatusPpl | "all";
      page?: number;
    }) => {
      startTransition(async () => {
        const result = await listKegiatan({
          page: opts.page ?? 1,
          pageSize: 10,
          search: opts.search || undefined,
          kategori: opts.kategori && opts.kategori !== "all" ? opts.kategori : undefined,
          status: opts.status && opts.status !== "all" ? opts.status : undefined,
        });
        setData(result);
      });
    },
    [],
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchData({ search, kategori, status, page: 1 });
  }

  function handleKategoriChange(value: string) {
    const newKategori = value as KategoriPpl | "all";
    setKategori(newKategori);
    setPage(1);
    fetchData({ search, kategori: newKategori, status, page: 1 });
  }

  function handleStatusChange(value: string) {
    const newStatus = value as StatusPpl | "all";
    setStatus(newStatus);
    setPage(1);
    fetchData({ search, kategori, status: newStatus, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData({ search, kategori, status, page: newPage });
  }

  const columns = useMemo<ColumnDef<KegiatanRow>[]>(
    () => [
      {
        accessorKey: "namaKegiatan",
        header: "Nama Kegiatan",
        cell: ({ row }) => (
          <button
            onClick={() => router.push(`/ppl-evaluasi/${row.original.id}`)}
            className="text-left font-medium hover:underline cursor-pointer"
          >
            {row.original.namaKegiatan}
          </button>
        ),
      },
      {
        accessorKey: "kategoriPpl",
        header: "Kategori PPL",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.kategoriPpl}</Badge>
        ),
      },
      {
        accessorKey: "tanggalMulai",
        header: "Tanggal",
        cell: ({ row }) => {
          const mulai = row.original.tanggalMulai;
          const selesai = row.original.tanggalSelesai;
          const formatDate = (d: string) => {
            try {
              return format(new Date(d), "d MMM yyyy", { locale: localeId });
            } catch {
              return d;
            }
          };
          if (mulai === selesai) {
            return <span className="text-sm">{formatDate(mulai)}</span>;
          }
          return (
            <span className="text-sm">
              {formatDate(mulai)} – {formatDate(selesai)}
            </span>
          );
        },
      },
      {
        accessorKey: "skp",
        header: "SKP",
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{row.original.skp}</span>
        ),
      },
      {
        accessorKey: "statusEvent",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.statusEvent;
          return (
            <Badge
              variant={status === "aktif" ? "default" : "outline"}
            >
              {status === "aktif" ? "Aktif" : "Diarsipkan"}
            </Badge>
          );
        },
      },
    ],
    [router],
  );

  return (
    <Card className="rounded-[24px]">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kegiatan..."
                className="pl-9"
                onBlur={() => {
                  if (search !== "") {
                    fetchData({ search, kategori, status, page: 1 });
                    setPage(1);
                  }
                }}
              />
            </form>
            <Select value={kategori} onValueChange={handleKategoriChange}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {KATEGORI_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
            <DataTable
              columns={columns}
              data={data.data}
              emptyMessage="Belum ada kegiatan PPL. Klik 'Tambah Kegiatan' untuk memulai."
              pageSize={data.pageSize}
            />
          </div>

          {/* Server-side Pagination */}
          {data.totalPages > 1 && (
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                {data.total} kegiatan · Halaman {data.page} / {data.totalPages}
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
  );
}
