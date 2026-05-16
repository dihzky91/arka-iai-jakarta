"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Peserta, SesiPelatihan, AbsensiRow } from "./types";
import { formatSessionDate, getIsoDateParts, buildSessionMonthGroups } from "./utils";

interface AbsensiPelatihanSectionProps {
  absensiData: { pesertaList: Peserta[]; sesiList: SesiPelatihan[]; absensiList: AbsensiRow[] } | null;
  canManage: boolean;
  isPending: boolean;
  quickAbsensiScope: "all" | "session" | "peserta";
  quickAbsensiSessionId: string;
  quickAbsensiPesertaId: string;
  quickAbsensiStatus: "hadir" | "tidak_hadir";
  onQuickScopeChange: (v: "all" | "session" | "peserta") => void;
  onQuickSessionChange: (v: string) => void;
  onQuickPesertaChange: (v: string) => void;
  onQuickStatusChange: (v: "hadir" | "tidak_hadir") => void;
  onApplyQuick: () => void;
  onAbsensiToggle: (pesertaId: string, sessionId: string, currentHadir: boolean | undefined) => void;
}

export function AbsensiPelatihanSection({
  absensiData,
  canManage,
  isPending,
  quickAbsensiScope,
  quickAbsensiSessionId,
  quickAbsensiPesertaId,
  quickAbsensiStatus,
  onQuickScopeChange,
  onQuickSessionChange,
  onQuickPesertaChange,
  onQuickStatusChange,
  onApplyQuick,
  onAbsensiToggle,
}: AbsensiPelatihanSectionProps) {
  const absensiMonthGroups = buildSessionMonthGroups(absensiData?.sesiList ?? []);

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <CardTitle>Absensi Pelatihan</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!absensiData ? (
          <EmptyState title={isPending ? "Memuat data absensi" : "Data absensi belum dimuat"} description={isPending ? "Mohon tunggu sebentar." : "Klik tab ini untuk memuat data absensi pelatihan."} className="m-4" />
        ) : absensiData.sesiList.length === 0 ? (
          <EmptyState title="Belum ada jadwal sesi" description="Absensi pelatihan akan tersedia setelah sesi pelatihan dibuat." className="m-4" />
        ) : (
          <>
          {canManage && absensiData.pesertaList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 p-3">
              <span className="text-sm font-medium">Isi Cepat</span>
              <Select value={quickAbsensiScope} onValueChange={onQuickScopeChange}>
                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="session">Per sesi</SelectItem>
                  <SelectItem value="peserta">Per peserta</SelectItem>
                  <SelectItem value="all">Semua data</SelectItem>
                </SelectContent>
              </Select>
              {quickAbsensiScope === "session" && (
                <Select value={quickAbsensiSessionId || absensiData.sesiList[0]?.id} onValueChange={onQuickSessionChange}>
                  <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {absensiData.sesiList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatSessionDate(s.scheduledDate)}{s.sessionNumber ? ` - Sesi ${s.sessionNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {quickAbsensiScope === "peserta" && (
                <Select value={quickAbsensiPesertaId || absensiData.pesertaList[0]?.id} onValueChange={onQuickPesertaChange}>
                  <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {absensiData.pesertaList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={quickAbsensiStatus} onValueChange={onQuickStatusChange}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hadir">Hadir</SelectItem>
                  <SelectItem value="tidak_hadir">Tidak hadir</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={onApplyQuick} disabled={isPending}>
                {quickAbsensiStatus === "hadir" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                Terapkan
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th rowSpan={2} className="sticky left-0 z-20 min-w-48 bg-background px-3 py-2 text-left align-middle font-medium text-muted-foreground">Nama Peserta</th>
                {absensiMonthGroups.map((group) => (
                  <th key={group.key} colSpan={group.sessions.length} className="border-l bg-muted/30 px-2 py-2 text-center text-xs font-medium text-foreground">{group.label}</th>
                ))}
                <th rowSpan={2} className="sticky right-0 z-20 min-w-24 bg-background px-3 py-2 text-center align-middle font-medium text-muted-foreground">Kehadiran</th>
              </tr>
              <tr className="border-b border-border/60 bg-muted/20">
                {absensiMonthGroups.flatMap((group) =>
                  group.sessions.map((s) => {
                    const { day, isValid } = getIsoDateParts(s.scheduledDate);
                    const title = [s.sessionNumber ? `Sesi ${s.sessionNumber}` : "Sesi", formatSessionDate(s.scheduledDate), s.materiName].filter(Boolean).join(" - ");
                    return (
                        <th key={s.id} title={title} className="min-w-10 border-l px-2 py-2 text-center text-xs font-medium text-foreground">
                        {isValid ? day : s.scheduledDate}
                      </th>
                    );
                  })
                )}
              </tr>
            </thead>
            <tbody>
              {absensiData.pesertaList.length === 0 ? (
                <tr><td colSpan={absensiData.sesiList.length + 2} className="px-4 py-8"><EmptyState title="Belum ada peserta aktif" description="Data absensi akan tampil setelah peserta aktif tersedia di kelas ini." /></td></tr>
              ) : (
                absensiData.pesertaList.map((p) => {
                  const hadirCount = absensiData.sesiList.filter((s) => {
                    const a = absensiData.absensiList.find((a) => a.pesertaId === p.id && a.sessionId === s.id);
                    return a?.hadir;
                  }).length;
                  const pct = absensiData.sesiList.length > 0 ? Math.round((hadirCount / absensiData.sesiList.length) * 100) : 0;
                  return (
                    <tr key={p.id} className="border-b border-border/60 transition-colors hover:bg-muted/40">
                      <td className="sticky left-0 z-10 min-w-48 bg-background px-3 py-1.5 font-medium">{p.nama}</td>
                      {absensiData.sesiList.map((s) => {
                        const a = absensiData.absensiList.find((a) => a.pesertaId === p.id && a.sessionId === s.id);
                        const present = a?.hadir === true;
                        return (
                          <td key={s.id} className="border-l px-2 py-1.5 text-center">
                            <button
                              className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-semibold tabular-nums ${present ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"} ${canManage ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                              disabled={!canManage}
                              onClick={() => onAbsensiToggle(p.id, s.id, a?.hadir)}
                              title={`${present ? "Hadir" : "Tidak hadir"} - ${formatSessionDate(s.scheduledDate)}${s.sessionNumber ? ` - Sesi ${s.sessionNumber}` : ""}`}
                            >
                              {present ? "1" : "0"}
                            </button>
                          </td>
                        );
                      })}
                      <td className={`sticky right-0 z-10 bg-background px-3 py-1.5 text-center font-medium tabular-nums ${pct < 60 ? "text-destructive" : ""}`}>{pct}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
