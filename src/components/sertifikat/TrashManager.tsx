"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { restoreEvent, type DeletedEventRow } from "@/server/actions/sertifikat/events";
import {
  restoreParticipant,
  type DeletedParticipantRow,
} from "@/server/actions/sertifikat/participants";
import { EmptyState } from "@/components/ui/empty-state";

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return format(new Date(value), "d MMM yyyy HH:mm", { locale: localeId });
}

export function TrashManager({
  initialEvents,
  initialParticipants,
}: {
  initialEvents: DeletedEventRow[];
  initialParticipants: DeletedParticipantRow[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [participants, setParticipants] = useState(initialParticipants);
  const [isPending, startTransition] = useTransition();

  function handleRestoreEvent(id: number, nama: string) {
    if (!window.confirm(`Pulihkan kegiatan "${nama}"?`)) return;
    startTransition(async () => {
      const result = await restoreEvent(id);
      if (result.ok) {
        toast.success("Kegiatan berhasil dipulihkan.");
        setEvents((prev) => prev.filter((row) => row.id !== id));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRestoreParticipant(id: number, nama: string) {
    if (!window.confirm(`Pulihkan peserta "${nama}"?`)) return;
    startTransition(async () => {
      const result = await restoreParticipant(id);
      if (result.ok) {
        toast.success("Peserta berhasil dipulihkan.");
        setParticipants((prev) => prev.filter((row) => row.id !== id));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Tabs defaultValue="events" className="space-y-4">
      <TabsList>
        <TabsTrigger value="events">
          Kegiatan
          <Badge variant="secondary" className="ml-2">{events.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="participants">
          Peserta
          <Badge variant="secondary" className="ml-2">{participants.length}</Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="events">
        <div className="rounded-[24px] border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Kegiatan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Dihapus pada</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-4">
                    <EmptyState
                      icon={Trash2}
                      title="Sampah kegiatan kosong"
                      description="Kegiatan yang dihapus akan muncul di sini dan bisa dipulihkan."
                      className="min-h-40"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                events.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{row.kodeEvent}</TableCell>
                    <TableCell className="font-medium">{row.namaKegiatan}</TableCell>
                    <TableCell>{row.kategori}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.tanggalMulai === row.tanggalSelesai ? row.tanggalMulai : `${row.tanggalMulai} - ${row.tanggalSelesai}`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.deletedAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreEvent(row.id, row.namaKegiatan)}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                        Pulihkan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="participants">
        <div className="rounded-[24px] border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Sertifikat</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kegiatan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dihapus pada</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-4">
                    <EmptyState
                      icon={Trash2}
                      title="Sampah peserta kosong"
                      description="Peserta yang dihapus akan muncul di sini dan bisa dipulihkan."
                      className="min-h-40"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                participants.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{row.noSertifikat}</TableCell>
                    <TableCell className="font-medium">{row.nama}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{row.eventKodeEvent}</span>
                      <br />
                      {row.eventNamaKegiatan}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.statusPeserta === "dicabut" ? "destructive" : "secondary"}>
                        {row.statusPeserta === "dicabut" ? "Dicabut" : "Aktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.deletedAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreParticipant(row.id, row.nama)}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                        Pulihkan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
