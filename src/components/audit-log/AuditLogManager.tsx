"use client";

import React, { useState, useCallback, useTransition } from "react";
import {
  listAuditLog,
  listAuditEntitasTypes,
  listSertifikatAuditLog,
  type AuditLogRow,
  type AuditLogResult,
} from "@/server/actions/auditLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  ShieldCheck,
  FileText,
} from "lucide-react";

// ─── Badge warna per entitas ──────────────────────────────────────────────────
function entitasBadgeVariant(
  entitas: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  switch (entitas) {
    case "surat_keluar":
      return "default";
    case "surat_masuk":
      return "secondary";
    case "disposisi":
      return "outline";
    case "pegawai":
    case "divisi":
    case "pejabat":
      return "secondary";
    default:
      return "outline";
  }
}

// ─── Label aksi supaya lebih human-readable ───────────────────────────────────
function labelAksi(aksi: string | null): string {
  if (!aksi) return "-";
  return aksi
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Format tanggal lokal ─────────────────────────────────────────────────────
function formatTanggal(d: Date | null): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

// ─── Detail JSON preview (collapsible) ───────────────────────────────────────
function DetailCell({ detail }: { detail: unknown }) {
  const [open, setOpen] = useState(false);
  if (!detail) return <span className="text-muted-foreground text-xs">—</span>;
  const preview = JSON.stringify(detail).slice(0, 50);
  return (
    <div>
      <button
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? "Sembunyikan" : preview + (preview.length >= 50 ? "…" : "")}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] bg-muted rounded p-2 max-w-xs overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AuditLogManagerProps {
  initialData: AuditLogResult;
  entitasTypes: string[];
  scope?: "all" | "sertifikat";
}

// ─── Komponen utama ───────────────────────────────────────────────────────────
export default function AuditLogManager({
  initialData,
  entitasTypes,
  scope = "all",
}: AuditLogManagerProps) {
  const [data, setData] = useState<AuditLogResult>(initialData);
  const [search, setSearch] = useState("");
  const [entitas, setEntitas] = useState("__all__");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(
    (page = 1, overrides: Record<string, unknown> = {}) => {
      startTransition(async () => {
        const params = {
          search: (overrides.search as string) ?? search,
          startDate: (overrides.startDate as string) ?? startDate,
          endDate: (overrides.endDate as string) ?? endDate,
          page,
          pageSize: (overrides.pageSize as number) ?? pageSize,
        };
        const result =
          scope === "sertifikat"
            ? await listSertifikatAuditLog(params)
            : await listAuditLog({
                ...params,
                entitasType: (overrides.entitas as string) ?? entitas,
              });
        setData(result);
      });
    },
    [search, entitas, startDate, endDate, pageSize, scope],
  );

  const handleFilter = () => fetchData(1);
  const handleReset = () => {
    setSearch("");
    setEntitas("__all__");
    setStartDate("");
    setEndDate("");
    setPageSize(25);
    startTransition(async () => {
      const result =
        scope === "sertifikat"
          ? await listSertifikatAuditLog({ page: 1, pageSize: 25 })
          : await listAuditLog({ page: 1, pageSize: 25 });
      setData(result);
    });
  };

  return (
    <div className="space-y-4">
      {/* ─── Filter Bar ─── */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search aksi */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="audit-search"
            placeholder="Cari aksi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            className="pl-9 w-52"
          />
        </div>

        {/* Filter entitas */}
        <Select
          value={entitas}
          onValueChange={(v) => {
            setEntitas(v);
            fetchData(1, { entitas: v });
          }}
        >
          <SelectTrigger id="audit-filter-entitas" className="w-44">
            <SelectValue placeholder="Semua entitas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Entitas</SelectItem>
            {entitasTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Range tanggal */}
        <div className="flex items-center gap-2">
          <Input
            id="audit-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
            title="Tanggal mulai"
          />
          <span className="text-muted-foreground text-sm">s/d</span>
          <Input
            id="audit-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
            title="Tanggal akhir"
          />
        </div>

        {/* Page size */}
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            const n = Number(v);
            setPageSize(n);
            fetchData(1, { pageSize: n });
          }}
        >
          <SelectTrigger id="audit-page-size" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / hal</SelectItem>
            <SelectItem value="25">25 / hal</SelectItem>
            <SelectItem value="50">50 / hal</SelectItem>
          </SelectContent>
        </Select>

        <Button id="audit-filter-btn" onClick={handleFilter} disabled={isPending}>
          <Search className="h-4 w-4 mr-1" />
          Filter
        </Button>
        <Button
          id="audit-reset-btn"
          variant="outline"
          onClick={handleReset}
          disabled={isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isPending ? "animate-spin" : ""}`} />
          Reset
        </Button>
      </div>

      {/* ─── Info total ─── */}
      <p className="text-sm text-muted-foreground">
        Menampilkan{" "}
        <strong>
          {(data.page - 1) * data.pageSize + 1}–
          {Math.min(data.page * data.pageSize, data.total)}
        </strong>{" "}
        dari <strong>{data.total}</strong> log
      </p>

      {/* ─── Tabel ─── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Waktu</TableHead>
              <TableHead className="w-[160px]">User</TableHead>
              <TableHead className="w-[80px]">Entitas</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead className="w-[120px]">ID Entitas</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-6">
                  <EmptyState
                    icon={FileText}
                    title="Tidak ada log yang sesuai filter"
                    description="Coba ubah kata kunci, entitas, tanggal, atau reset filter audit log."
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow key={row.id} className="text-sm transition-colors hover:bg-muted/40">
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatTanggal(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium leading-tight">{row.namaUser ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.emailUser ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    {row.entitasType ? (
                      <Badge
                        variant={entitasBadgeVariant(row.entitasType)}
                        className="text-[10px] px-1.5 py-0.5 capitalize whitespace-nowrap"
                      >
                        {row.entitasType.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{labelAksi(row.aksi)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[100px]" title={row.entitasId ?? ""}>
                    {row.entitasId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <DetailCell detail={row.detail} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Pagination ─── */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Halaman {data.page} dari {data.totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            id="audit-prev-page"
            variant="outline"
            size="sm"
            disabled={data.page <= 1 || isPending}
            onClick={() => fetchData(data.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <Button
            id="audit-next-page"
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages || isPending}
            onClick={() => fetchData(data.page + 1)}
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
