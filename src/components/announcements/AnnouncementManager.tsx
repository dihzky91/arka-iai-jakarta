"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  BookOpen,
  CheckCheck,
  ChevronDown,
  Copy,
  Edit,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  acknowledgeAnnouncement,
  deleteAnnouncement,
  duplicateAnnouncement,
  markAllAnnouncementsAsRead,
  markAnnouncementAsRead,
  type AnnouncementInboxRow,
  type AnnouncementManageRow,
} from "@/server/actions/announcements";
import { formatTanggal, formatTanggalWaktuJakarta } from "@/lib/utils";
import {
  announcementHtmlToText,
  sanitizeAnnouncementHtml,
} from "@/lib/html/announcementHtml";
import { AnnouncementDisplay } from "@/components/ui/announcement-display";
import { AnnouncementForm } from "./AnnouncementForm";
import { AnnouncementReadersDialog } from "./AnnouncementReadersDialog";

type FormState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; row: AnnouncementManageRow };

type ReadDialogState = {
  open: boolean;
  row: AnnouncementInboxRow | null;
};

interface AnnouncementManagerProps {
  canManage: boolean;
  initialInbox: AnnouncementInboxRow[];
  initialManage: AnnouncementManageRow[];
  divisiOptions: Array<{ id: number; nama: string }>;
}

function isActiveAnnouncement(startDate: string, endDate: string) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return startDate <= today && endDate >= today;
}

function renderAudienceLabel(
  audience: AnnouncementInboxRow["audience"] | AnnouncementManageRow["audience"],
) {
  if (audience.all) return "Semua pengguna internal";
  const parts: string[] = [];
  if (audience.roles.length > 0) parts.push(`Role ${audience.roles.join(", ")}`);
  if (audience.divisiIds.length > 0) parts.push(`${audience.divisiIds.length} divisi`);
  return parts.join(" • ") || "Target terbatas";
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function AnnouncementManager({
  canManage,
  initialInbox,
  initialManage,
  divisiOptions,
}: AnnouncementManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementManageRow | null>(null);
  const [readDialog, setReadDialog] = useState<ReadDialogState>({ open: false, row: null });
  const [readersTarget, setReadersTarget] = useState<AnnouncementManageRow | null>(null);
  const [inboxRows, setInboxRows] = useState(initialInbox);
  const [isInboxOpen, setIsInboxOpen] = useState(!canManage);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isReading, startReadTransition] = useTransition();
  const [isAcknowledging, startAcknowledgeTransition] = useTransition();
  const [isMarkingAll, startMarkAllTransition] = useTransition();
  const [isDuplicating, startDuplicateTransition] = useTransition();

  const unreadCount = useMemo(
    () => inboxRows.filter((row) => !row.isRead).length,
    [inboxRows],
  );
  const pendingCount = useMemo(
    () => inboxRows.filter((row) => !row.isRead || row.needsAcknowledgement).length,
    [inboxRows],
  );

  const filteredInbox = useMemo(
    () =>
      onlyUnread
        ? inboxRows.filter((row) => !row.isRead || row.needsAcknowledgement)
        : inboxRows,
    [inboxRows, onlyUnread],
  );
  const activeReadRow = useMemo(() => {
    if (!readDialog.row) return null;
    return inboxRows.find((row) => row.id === readDialog.row?.id) ?? readDialog.row;
  }, [inboxRows, readDialog.row]);

  const manageColumns = useMemo<ColumnDef<AnnouncementManageRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Judul",
        cell: ({ row }) => (
          <div className="min-w-55">
            <div className="flex items-center gap-1.5">
              {row.original.isPinned ? (
                <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : null}
              <p className="font-medium text-foreground">{row.original.title}</p>
              {row.original.requiresAck ? (
                <Badge variant="outline" className="text-[11px]">
                  Wajib Konfirmasi
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {announcementHtmlToText(row.original.description)}
            </p>
          </div>
        ),
      },
      {
        id: "periode",
        header: "Periode",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatTanggal(row.original.startDate)} -{" "}
            {formatTanggal(row.original.endDate)}
          </span>
        ),
      },
      {
        id: "audiens",
        header: "Audiens",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {renderAudienceLabel(row.original.audience)}
          </span>
        ),
      },
      {
        id: "lampiran",
        header: "Lampiran",
        cell: ({ row }) => (
          <Badge variant="outline" className="tabular-nums">
            {row.original.attachments.length}
          </Badge>
        ),
      },
      {
        accessorKey: "readCount",
        header: "Dibaca",
        cell: ({ row }) => (
          <Badge variant="outline" className="tabular-nums">
            {row.original.readCount}
          </Badge>
        ),
      },
      {
        accessorKey: "acknowledgedCount",
        header: "Konfirmasi",
        cell: ({ row }) =>
          row.original.requiresAck ? (
            <Badge variant="outline" className="tabular-nums">
              {row.original.acknowledgedCount}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const active = isActiveAnnouncement(
            row.original.startDate,
            row.original.endDate,
          );
          if (row.original.status === "draft") {
            return <Badge variant="secondary">Draft</Badge>;
          }
          return active ? (
            <Badge>Aktif</Badge>
          ) : (
            <Badge variant="secondary">Nonaktif</Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Aksi</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setFormState({ open: true, mode: "edit", row: row.original })
                  }
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Ubah
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReadersTarget(row.original)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Lihat Pembaca
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isDuplicating}
                  onClick={() => handleDuplicate(row.original.id)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplikat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [isDuplicating],
  );

  function openReadDialog(row: AnnouncementInboxRow) {
    setReadDialog({ open: true, row });
    if (row.isRead) return;
    startReadTransition(async () => {
      const result = await markAnnouncementAsRead({ id: row.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInboxRows((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, isRead: true, readAt: new Date() } : item,
        ),
      );
    });
  }

  function handleMarkAll() {
    startMarkAllTransition(async () => {
      const result = await markAllAnnouncementsAsRead();
      if (!result.ok) {
        toast.error("Gagal menandai semua terbaca.");
        return;
      }
      setInboxRows((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: new Date() })));
      toast.success(
        result.count > 0
          ? `${result.count} pengumuman ditandai terbaca.`
          : "Semua sudah terbaca.",
      );
    });
  }

  function handleAcknowledge(announcementId: string) {
    startAcknowledgeTransition(async () => {
      const result = await acknowledgeAnnouncement({ id: announcementId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInboxRows((prev) =>
        prev.map((item) =>
          item.id === announcementId
            ? {
                ...item,
                isRead: true,
                readAt: item.readAt ?? new Date(),
                isAcknowledged: true,
                acknowledgedAt: item.acknowledgedAt ?? new Date(),
                needsAcknowledgement: false,
              }
            : item,
        ),
      );
      toast.success("Konfirmasi baca berhasil disimpan.");
    });
  }

  function handleDuplicate(id: string) {
    startDuplicateTransition(async () => {
      const result = await duplicateAnnouncement({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pengumuman berhasil diduplikat sebagai draft.");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      const result = await deleteAnnouncement({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pengumuman berhasil dihapus.");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Inbox */}
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Inbox
                <Badge variant={pendingCount > 0 ? "default" : "secondary"}>
                  {pendingCount} butuh aksi
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Informasi terbaru untuk peran atau divisi Anda.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInboxOpen((prev) => !prev)}
                aria-expanded={isInboxOpen}
              >
                {isInboxOpen ? "Sembunyikan inbox" : "Tampilkan inbox"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isInboxOpen ? "rotate-180" : ""}`}
                />
              </Button>
              {unreadCount > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAll}
                  disabled={isMarkingAll}
                  className={isInboxOpen ? "" : "hidden"}
                >
                  {isMarkingAll ? "Memproses..." : "Tandai semua terbaca"}
                </Button>
              ) : null}
              {inboxRows.length > 0 ? (
                <Button
                  size="sm"
                  variant={onlyUnread ? "default" : "outline"}
                  onClick={() => setOnlyUnread((v) => !v)}
                  className={isInboxOpen ? "" : "hidden"}
                >
                  {onlyUnread ? "Tampilkan semua" : "Butuh aksi"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        {isInboxOpen ? (
          <CardContent className="pt-5">
            {filteredInbox.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={onlyUnread ? "Tidak ada pengumuman yang butuh aksi" : "Belum ada pengumuman aktif"}
                description={onlyUnread ? "Semua pengumuman sudah terbaca atau tidak membutuhkan konfirmasi." : "Pengumuman yang ditujukan untuk peran atau divisi Anda akan tampil di sini."}
              />
            ) : (
              <div className="space-y-3">
                {filteredInbox.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openReadDialog(row)}
                    className="w-full rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/35 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {row.isPinned ? (
                            <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                          ) : null}
                          <p className="font-medium text-foreground">{row.title}</p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {announcementHtmlToText(row.description)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatTanggal(row.startDate)} - {formatTanggal(row.endDate)}
                        </p>
                        {row.attachments.length > 0 ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3.5 w-3.5" />
                            {row.attachments.length} lampiran
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{renderAudienceLabel(row.audience)}</Badge>
                        {row.requiresAck ? (
                          <Badge variant={row.isAcknowledged ? "secondary" : "default"}>
                            {row.isAcknowledged ? "Terkonfirmasi" : "Perlu Konfirmasi"}
                          </Badge>
                        ) : (
                          <Badge variant={row.isRead ? "secondary" : "default"}>
                            {row.isRead ? "Terbaca" : "Baru"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>

      {/* Kelola */}
      {canManage ? (
        <Card className="rounded-[24px]">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Kelola</CardTitle>
                <CardDescription className="mt-1">
                  Buat, ubah, dan pantau status baca.
                </CardDescription>
              </div>
              <Button onClick={() => setFormState({ open: true, mode: "create" })}>
                <Plus className="h-4 w-4" />
                Buat Pengumuman
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={manageColumns}
              data={initialManage}
              searchColumnId="title"
              searchPlaceholder="Cari judul pengumuman..."
              emptyMessage="Belum ada pengumuman dibuat."
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Form create/edit */}
      <AnnouncementForm
        open={formState.open}
        onOpenChange={(open) => (open ? null : setFormState({ open: false }))}
        mode={formState.open ? formState.mode : "create"}
        initialData={formState.open && formState.mode === "edit" ? formState.row : null}
        divisiOptions={divisiOptions}
        onSuccess={() => router.refresh()}
      />

      {/* Readers analytics */}
      <AnnouncementReadersDialog
        announcementId={readersTarget?.id ?? null}
        announcementTitle={readersTarget?.title ?? ""}
        onOpenChange={(open) => { if (!open) setReadersTarget(null); }}
      />

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pengumuman?</DialogTitle>
            <DialogDescription>
              Pengumuman{" "}
              <span className="font-medium text-foreground">{deleteTarget?.title}</span>{" "}
              akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read detail */}
      <Dialog
        open={readDialog.open}
        onOpenChange={(open) =>
          setReadDialog({ open, row: open ? readDialog.row : null })
        }
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeReadRow?.title ?? "Detail Pengumuman"}</DialogTitle>
            <DialogDescription>
              {activeReadRow
                ? `${formatTanggal(activeReadRow.startDate)} - ${formatTanggal(activeReadRow.endDate)} • ${renderAudienceLabel(activeReadRow.audience)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <AnnouncementDisplay
                html={sanitizeAnnouncementHtml(activeReadRow?.description ?? "")}
              />
            </div>
            {activeReadRow?.requiresAck ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Konfirmasi Baca</p>
                  <p className="text-xs text-muted-foreground">
                    {activeReadRow.isAcknowledged
                      ? "Anda sudah mengonfirmasi telah membaca pengumuman ini."
                      : "Pengumuman ini mewajibkan konfirmasi baca."}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAcknowledge(activeReadRow.id)}
                  disabled={isAcknowledging || activeReadRow.isAcknowledged}
                >
                  <CheckCheck className="h-4 w-4" />
                  {activeReadRow.isAcknowledged
                    ? "Sudah Dikonfirmasi"
                    : isAcknowledging
                      ? "Menyimpan..."
                      : "Saya Sudah Membaca"}
                </Button>
              </div>
            ) : null}
            {activeReadRow?.attachments.length ? (
              <div className="space-y-2 rounded-2xl border border-border/60 bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lampiran
                </p>
                {activeReadRow.attachments.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-foreground">{item.fileName}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(item.size) ?? "Buka"}
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Dibuat oleh: {activeReadRow?.createdByName ?? "Admin Sistem"}</span>
              <span>•</span>
              <span>
                {activeReadRow ? formatTanggalWaktuJakarta(activeReadRow.createdAt) : ""}
              </span>
              {isReading ? (
                <>
                  <span>•</span>
                  <span>Menandai terbaca...</span>
                </>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
