"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FilePlus2, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  generateHonorariumBatchFromSelection,
  type OutstandingHonorariumResult,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { formatTanggalPendek } from "@/lib/utils";

interface Props {
  data: OutstandingHonorariumResult;
}

function fmtCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function rateSourceLabel(v: "override_instructor" | "matrix_standard" | "missing") {
  if (v === "override_instructor") return "Override";
  if (v === "matrix_standard") return "Standar";
  return "Missing";
}

function rateSourceVariant(v: "override_instructor" | "matrix_standard" | "missing"): "secondary" | "outline" | "destructive" {
  if (v === "override_instructor") return "secondary";
  if (v === "matrix_standard") return "outline";
  return "destructive";
}

export function OutstandingHonorariumSection({ data }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const eligibleSessions = useMemo(
    () => data.sessions.filter((s) => s.rateSource !== "missing"),
    [data.sessions],
  );

  const missingSessions = useMemo(
    () => data.sessions.filter((s) => s.rateSource === "missing"),
    [data.sessions],
  );

  const allEligibleIds = useMemo(
    () => new Set(eligibleSessions.map((s) => s.assignmentId)),
    [eligibleSessions],
  );

  const isAllSelected = selected.size > 0 && selected.size === allEligibleIds.size;
  const isSomeSelected = selected.size > 0 && selected.size < allEligibleIds.size;

  const selectedTotal = useMemo(
    () => data.sessions.filter((s) => selected.has(s.assignmentId)).reduce((sum, s) => sum + s.totalAmount, 0),
    [data.sessions, selected],
  );

  function toggleAll() {
    if (isAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allEligibleIds));
    }
  }

  function toggleOne(assignmentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) {
        next.delete(assignmentId);
      } else {
        next.add(assignmentId);
      }
      return next;
    });
  }

  function handleGenerateDraft() {
    if (selected.size === 0) {
      toast.error("Pilih minimal 1 sesi untuk generate draft.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await generateHonorariumBatchFromSelection({
          assignmentIds: Array.from(selected),
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(
          `Draft ${result.documentNumber} berhasil dibuat (${result.itemCount} sesi, ${fmtCurrency(result.totalAmount)}).`,
        );
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal generate draft.");
      }
    });
  }

  if (data.sessions.length === 0) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="pt-6">
          <EmptyState
            icon={CheckCircle2}
            title="Semua sesi sudah masuk batch"
            description="Tidak ada sesi outstanding. Semua sesi yang selesai sudah diproses ke batch honorarium."
            className="min-h-32"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Sesi Siap Bayar</CardTitle>
            <CardDescription>
              Sesi yang sudah selesai namun belum masuk batch honorarium.
            </CardDescription>
          </div>
          <Button onClick={handleGenerateDraft} disabled={pending || selected.size === 0}>
            <FilePlus2 className="h-4 w-4 mr-1" />
            Generate Draft ({selected.size})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {/* Summary Tiles */}
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile icon={Wallet} label="Sesi Siap" value={String(data.totals.sessionCount)} />
          <SummaryTile icon={Users} label="Instruktur" value={String(data.totals.instructorCount)} />
          <SummaryTile icon={Wallet} label="Total Estimasi" value={fmtCurrency(data.totals.totalAmount)} />
          <SummaryTile
            icon={AlertTriangle}
            label="Tanpa Tarif"
            value={String(data.totals.missingRateCount)}
            variant={data.totals.missingRateCount > 0 ? "warning" : "default"}
          />
        </div>

        {/* Selected info */}
        {selected.size > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 text-sm">
            <span className="font-medium">{selected.size} sesi dipilih</span>
            <span className="text-muted-foreground ml-2">— Total: {fmtCurrency(selectedTotal)}</span>
          </div>
        )}

        {/* Missing rate warning */}
        {missingSessions.length > 0 && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            {missingSessions.length} sesi belum punya tarif dan tidak bisa di-generate. Lengkapi tarif di halaman Instruktur.
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <Table className="min-w-[50rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllSelected || (isSomeSelected && "indeterminate")}
                    onCheckedChange={toggleAll}
                    aria-label="Pilih semua sesi eligible"
                    disabled={eligibleSessions.length === 0}
                  />
                </TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Materi</TableHead>
                <TableHead>Instruktur</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessions.map((session) => {
                const isMissing = session.rateSource === "missing";
                return (
                  <TableRow
                    key={session.assignmentId}
                    className={isMissing ? "opacity-60" : "transition-colors hover:bg-muted/30"}
                    data-state={selected.has(session.assignmentId) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(session.assignmentId)}
                        onCheckedChange={() => toggleOne(session.assignmentId)}
                        disabled={isMissing}
                        aria-label={`Pilih sesi ${session.materiBlock} ${session.scheduledDate}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatTanggalPendek(session.scheduledDate)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{session.namaKelas}</p>
                        <p className="text-xs text-muted-foreground">{session.programName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{session.materiBlock}</TableCell>
                    <TableCell className="text-sm">{session.paidInstructorName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {session.expertiseLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rateSourceVariant(session.rateSource)}>
                        {rateSourceLabel(session.rateSource)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {isMissing ? "-" : fmtCurrency(session.totalAmount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant?: "default" | "warning";
}) {
  return (
    <div className={`rounded-lg border p-4 ${variant === "warning" ? "border-amber-300/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20" : "border-border/60 bg-muted/20"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${variant === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
