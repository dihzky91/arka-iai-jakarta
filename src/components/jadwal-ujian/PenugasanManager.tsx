"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserMinus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ConflictBadge } from "./ConflictBadge";
import {
  assignPengawas,
  unassignPengawas,
  type PenugasanRow,
  type ConflictDetail,
} from "@/server/actions/jadwal-ujian/penugasan";
import type { PengawasRow } from "@/server/actions/jadwal-ujian/pengawas";
import { APP_TIME_ZONE, parseIsoDateInJakarta } from "@/lib/utils";

interface PenugasanManagerProps {
  ujianId: string;
  mataPelajaran: string;
  tanggalUjian: string;
  jamMulai: string;
  jamSelesai: string;
  initialPenugasan: PenugasanRow[];
  pengawasList: Pick<PengawasRow, "id" | "nama">[];
  canManage: boolean;
}

interface ConflictConfirmState {
  pengawasId: string;
  pengawasNama: string;
  details: ConflictDetail[];
}

export function PenugasanManager({
  ujianId,
  mataPelajaran,
  tanggalUjian,
  jamMulai,
  jamSelesai,
  initialPenugasan,
  pengawasList,
  canManage,
}: PenugasanManagerProps) {
  const [selectedPengawasId, setSelectedPengawasId] = useState("");
  const [unassignTarget, setUnassignTarget] = useState<PenugasanRow | null>(null);
  const [conflictConfirm, setConflictConfirm] = useState<ConflictConfirmState | null>(null);
  const [isAssigning, startAssignTransition] = useTransition();
  const [isForceAssigning, startForceAssignTransition] = useTransition();
  const [isUnassigning, startUnassignTransition] = useTransition();

  const assignedIds = new Set(initialPenugasan.map((p) => p.pengawasId));
  const availablePengawas = pengawasList.filter((p) => !assignedIds.has(p.id));

  function handleAssign() {
    if (!selectedPengawasId) return;
    startAssignTransition(async () => {
      const res = await assignPengawas({ ujianId, pengawasId: selectedPengawasId });
      if (!res.ok) {
        // Jika konflik terdeteksi, tampilkan dialog konfirmasi
        if ("konflikDetected" in res && res.konflikDetected) {
          const nama = pengawasList.find((p) => p.id === selectedPengawasId)?.nama ?? "Pengawas";
          setConflictConfirm({
            pengawasId: selectedPengawasId,
            pengawasNama: nama,
            details: ("conflictDetails" in res ? res.conflictDetails : []) as ConflictDetail[],
          });
          return;
        }
        toast.error(res.error);
        return;
      }
      if (res.konflik) {
        toast.warning("Pengawas berhasil ditugaskan (force), namun terdeteksi konflik jadwal di waktu yang sama.");
      } else {
        toast.success("Pengawas berhasil ditugaskan.");
      }
      setSelectedPengawasId("");
    });
  }

  function handleForceAssign() {
    if (!conflictConfirm) return;
    startForceAssignTransition(async () => {
      const res = await assignPengawas({
        ujianId,
        pengawasId: conflictConfirm.pengawasId,
        forceAssign: true,
      });
      if (!res.ok) {
        toast.error(res.error);
        setConflictConfirm(null);
        return;
      }
      toast.warning(`${conflictConfirm.pengawasNama} ditugaskan meski ada konflik jadwal.`);
      setConflictConfirm(null);
      setSelectedPengawasId("");
    });
  }

  function handleUnassignConfirm() {
    if (!unassignTarget) return;
    startUnassignTransition(async () => {
      const res = await unassignPengawas(unassignTarget.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${unassignTarget.namaPengawas} dilepas dari penugasan.`);
      setUnassignTarget(null);
    });
  }

  const d = parseIsoDateInJakarta(tanggalUjian);
  const tanggalFormatted = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });

  return (
    <>
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Penugasan Pengawas</CardTitle>
          <CardDescription>
            {mataPelajaran} — {tanggalFormatted}, {jamMulai}–{jamSelesai}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {canManage && (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Tugaskan Pengawas</p>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedPengawasId}
                    onValueChange={setSelectedPengawasId}
                    disabled={availablePengawas.length === 0}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={
                          availablePengawas.length === 0
                            ? "Semua pengawas sudah ditugaskan"
                            : "Pilih pengawas..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePengawas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssign}
                    disabled={!selectedPengawasId || isAssigning}
                    className="shrink-0"
                  >
                    <UserCheck className="h-4 w-4" />
                    {isAssigning ? "Menugaskan..." : "Tugaskan"}
                  </Button>
                </div>
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Pengawas Bertugas{" "}
              <span className="text-muted-foreground font-normal">
                ({initialPenugasan.length} orang)
              </span>
            </p>

            {initialPenugasan.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada pengawas yang ditugaskan.
              </p>
            ) : (
              <ul className="space-y-2">
                {initialPenugasan.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{p.namaPengawas}</span>
                      {p.konflik && <ConflictBadge />}
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setUnassignTarget(p)}
                      >
                        <UserMinus className="h-4 w-4" />
                        <span className="sr-only">Lepas penugasan</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {initialPenugasan.some((p) => p.konflik) && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 mt-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">
                  Terdapat konflik jadwal. Beberapa pengawas ditugaskan di waktu yang bersamaan pada
                  tanggal ini.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Konfirmasi lepas penugasan */}
      <Dialog
        open={!!unassignTarget}
        onOpenChange={(open) => { if (!open && !isUnassigning) setUnassignTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lepas Penugasan?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{unassignTarget?.namaPengawas}</span>{" "}
              akan dilepas dari penugasan ujian ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnassignTarget(null)}
              disabled={isUnassigning}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleUnassignConfirm} disabled={isUnassigning}>
              {isUnassigning ? "Memproses..." : "Lepas Penugasan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi force assign saat konflik */}
      <Dialog
        open={!!conflictConfirm}
        onOpenChange={(open) => { if (!open && !isForceAssigning) setConflictConfirm(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Konflik Jadwal Terdeteksi
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>
                  <span className="font-medium text-foreground">{conflictConfirm?.pengawasNama}</span>{" "}
                  sudah ditugaskan di jadwal lain yang waktunya bentrok:
                </p>
                {conflictConfirm?.details && conflictConfirm.details.length > 0 && (
                  <ul className="space-y-2">
                    {conflictConfirm.details.map((d, i) => (
                      <li key={i} className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
                        <span className="font-medium">{d.mataPelajaran.join(" & ")}</span>
                        <span className="text-muted-foreground"> — {d.namaKelas}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{d.jamMulai}–{d.jamSelesai}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-muted-foreground">
                  Apakah tetap ingin menugaskan pengawas ini meski jadwal bentrok?
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConflictConfirm(null)}
              disabled={isForceAssigning}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleForceAssign}
              disabled={isForceAssigning}
            >
              {isForceAssigning ? "Menugaskan..." : "Tetap Tugaskan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
