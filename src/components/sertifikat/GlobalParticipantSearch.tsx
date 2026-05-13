"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Loader2, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  searchAllParticipants,
  type GlobalSearchResult,
  type StatusPeserta,
} from "@/server/actions/sertifikat/participants";

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return format(new Date(value), "d MMM yyyy HH:mm", { locale: localeId });
}

export function GlobalParticipantSearch({ initialData }: { initialData: GlobalSearchResult }) {
  const [data, setData] = useState<GlobalSearchResult>(initialData);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusPeserta | "all">("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  function fetchData(overrides: { search?: string; status?: StatusPeserta | "all"; page?: number } = {}) {
    startTransition(async () => {
      const result = await searchAllParticipants({
        search: overrides.search ?? search,
        status: overrides.status ?? status,
        page: overrides.page ?? page,
        pageSize: 25,
      });
      setData(result);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchData({ page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData({ page: newPage });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, nomor sertifikat, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            const newStatus = value as StatusPeserta | "all";
            setStatus(newStatus);
            setPage(1);
            fetchData({ status: newStatus, page: 1 });
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="dicabut">Dicabut</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cari
        </Button>
      </form>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Sertifikat</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Kegiatan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email Terkirim</TableHead>
              <TableHead>PDF Terakhir</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-4">
                  <EmptyState
                    icon={Users}
                    title={search ? "Peserta tidak ditemukan" : "Mulai cari peserta"}
                    description={
                      search
                        ? "Tidak ada peserta yang cocok dengan pencarian saat ini."
                        : "Cari berdasarkan nama, nomor sertifikat, atau email peserta."
                    }
                    className="min-h-40"
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{row.noSertifikat}</TableCell>
                  <TableCell className="font-medium">{row.nama}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.email ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="font-mono text-xs">{row.eventKodeEvent}</span>
                    <br />
                    {row.eventNamaKegiatan}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.statusPeserta === "dicabut" ? "destructive" : "outline"}
                      className={
                        row.statusPeserta === "aktif"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : ""
                      }
                    >
                      {row.statusPeserta === "dicabut" ? "Dicabut" : "Aktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.emailSentAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.lastPdfGeneratedAt)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/sertifikat/kegiatan/${row.eventId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Buka
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1 || isPending} onClick={() => handlePageChange(data.page - 1)}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.totalPages || isPending} onClick={() => handlePageChange(data.page + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
