"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ClipboardList, Eye, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
import { listBatches, type BatchRow } from "@/server/actions/sertifikat/nomor/batches";
import type { CertificateProgramRow } from "@/server/actions/sertifikat/nomor/programs";
import type { CertificateClassTypeRow } from "@/server/actions/sertifikat/nomor/classTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTanggal(d: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function StatusBadge({ status }: { status: BatchRow["status"] }) {
  const map: Record<BatchRow["status"], { label: string; className: string }> = {
    active: {
      label: "Aktif",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    revised: {
      label: "Direvisi",
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
    },
    cancelled: {
      label: "Dibatalkan",
      className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
    },
  };
  const { label, className } = map[status];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BatchTableProps {
  initialBatches: BatchRow[];
  programs: CertificateProgramRow[];
  classTypes: CertificateClassTypeRow[];
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

export function BatchTable({ initialBatches, programs, classTypes }: BatchTableProps) {
  const [batches, setBatches] = useState<BatchRow[]>(initialBatches);
  const [programId, setProgramId]     = useState("");
  const [classTypeId, setClassTypeId] = useState("");
  const [status, setStatus]           = useState<BatchRow["status"] | "">("");
  const [angkatan, setAngkatan]       = useState("");
  const [isPending, startTransition]  = useTransition();

  const hasFilters = programId || classTypeId || status || angkatan;

  function fetchBatches(overrides: Record<string, string> = {}) {
    startTransition(async () => {
      const p   = overrides.programId   ?? programId;
      const ct  = overrides.classTypeId ?? classTypeId;
      const s   = overrides.status      ?? status;
      const ang = overrides.angkatan    ?? angkatan;

      const result = await listBatches({
        programId:   p   || undefined,
        classTypeId: ct  || undefined,
        status:      (s as BatchRow["status"]) || undefined,
        angkatan:    ang ? Number(ang) : undefined,
      });
      setBatches(result);
    });
  }

  function clearFilters() {
    setProgramId("");
    setClassTypeId("");
    setStatus("");
    setAngkatan("");
    startTransition(async () => {
      const result = await listBatches();
      setBatches(result);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          {/* Program */}
          <Select
            value={programId || "__all__"}
            onValueChange={(v) => {
              const val = v === "__all__" ? "" : v;
              setProgramId(val);
              fetchBatches({ programId: val });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Program</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Jenis Kelas */}
          <Select
            value={classTypeId || "__all__"}
            onValueChange={(v) => {
              const val = v === "__all__" ? "" : v;
              setClassTypeId(val);
              fetchBatches({ classTypeId: val });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Jenis Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Jenis Kelas</SelectItem>
              {classTypes.map((ct) => (
                <SelectItem key={ct.id} value={ct.id}>
                  {ct.name} ({ct.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select
            value={status || "__all__"}
            onValueChange={(v) => {
              const val = v === "__all__" ? "" : v;
              setStatus(val as BatchRow["status"] | "");
              fetchBatches({ status: val });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="revised">Direvisi</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>

          {/* Angkatan */}
          <Input
            type="number"
            placeholder="Angkatan (mis. 223)"
            value={angkatan}
            onChange={(e) => setAngkatan(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchBatches()}
            className="w-full lg:w-44"
          />

          {/* Tombol aksi */}
          <div className="flex gap-2">
            {hasFilters && (
              <Button variant="outline" size="icon" onClick={clearFilters} title="Hapus filter">
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button asChild>
              <Link href="/sertifikat/nomor/generate">
                <Plus className="h-4 w-4 mr-1" />
                Generate Batch
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-[24px] border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Angkatan</TableHead>
                <TableHead>Jenis Kelas</TableHead>
                <TableHead className="text-center">Jumlah</TableHead>
                <TableHead>Nomor Pertama</TableHead>
                <TableHead>Nomor Terakhir</TableHead>
                <TableHead>Dibuat Oleh</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-16 text-center text-muted-foreground">
                    Memuat data…
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-4">
                    <EmptyState
                      icon={ClipboardList}
                      title="Belum ada batch sertifikat"
                      description={
                        hasFilters
                          ? "Tidak ada batch sertifikat yang sesuai dengan filter saat ini."
                          : "Generate batch sertifikat untuk mulai mengelola nomor, program, dan angkatan."
                      }
                      action={
                        <Button asChild size="sm">
                          <Link href="/sertifikat/nomor/generate">
                            <Plus className="h-4 w-4" />
                            Generate Batch
                          </Link>
                        </Button>
                      }
                      className="min-h-44"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatTanggal(batch.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{batch.programName}</p>
                      {batch.kelasName ? (
                        <p className="text-xs text-muted-foreground">{batch.kelasName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{batch.angkatan}</TableCell>
                    <TableCell>
                      {batch.classTypeName}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        ({batch.classTypeCode})
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{batch.quantityRequested}</TableCell>
                    <TableCell className="font-mono text-sm">{batch.firstCertificateNumber}</TableCell>
                    <TableCell className="font-mono text-sm">{batch.lastCertificateNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {batch.createdByName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/sertifikat/nomor/${batch.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Detail
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {batches.length > 0 && (
        <p className="text-sm text-muted-foreground text-right">
          {batches.length} batch ditemukan
        </p>
      )}
    </div>
  );
}
