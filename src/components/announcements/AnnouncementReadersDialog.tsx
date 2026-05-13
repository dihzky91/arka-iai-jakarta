"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getAnnouncementReaders,
  type AnnouncementReaderRow,
} from "@/server/actions/announcements";
import { formatTanggalWaktuJakarta } from "@/lib/utils";

interface AnnouncementReadersDialogProps {
  announcementId: string | null;
  announcementTitle: string;
  onOpenChange: (open: boolean) => void;
}

export function AnnouncementReadersDialog({
  announcementId,
  announcementTitle,
  onOpenChange,
}: AnnouncementReadersDialogProps) {
  const [readers, setReaders] = useState<AnnouncementReaderRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!announcementId) return;
    startTransition(async () => {
      const result = await getAnnouncementReaders({ id: announcementId });
      if (result.ok) setReaders(result.data);
    });
  }, [announcementId]);

  return (
    <Dialog open={!!announcementId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Siapa yang sudah baca?</DialogTitle>
          <DialogDescription className="line-clamp-1">{announcementTitle}</DialogDescription>
        </DialogHeader>
        {isPending ? (
          <EmptyState title="Memuat pembaca" description="Mohon tunggu sebentar." className="min-h-32" />
        ) : readers.length === 0 ? (
          <EmptyState title="Belum ada pembaca" description="Daftar pembaca akan tampil setelah pengumuman dibuka oleh pengguna." className="min-h-32" />
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {readers.map((reader, i) => (
              <div
                key={reader.userId}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm transition-colors hover:bg-muted/35"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <Badge variant="outline" className="tabular-nums">
                    {i + 1}
                  </Badge>
                  {reader.namaLengkap ?? reader.userId}
                </span>
                <div className="flex items-center gap-2">
                  {reader.acknowledgedAt ? (
                    <Badge variant="secondary" className="text-[11px]">
                      Konfirmasi
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px]">
                      Baca
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTanggalWaktuJakarta(
                      reader.acknowledgedAt ?? reader.readAt,
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
