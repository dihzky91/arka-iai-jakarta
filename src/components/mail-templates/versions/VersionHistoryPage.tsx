"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { rollbackToVersion } from "@/server/actions/mail-templates/versions";
import type { EmailTemplate, EmailTemplateVersion } from "@/server/db/schema";

interface Props {
  template: EmailTemplate;
  versions: EmailTemplateVersion[];
}

export function VersionHistoryPage({ template, versions }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  async function handleRollback(versionId: string, versionNum: number) {
    setIsRollingBack(true);
    try {
      const result = await rollbackToVersion(template.id, versionId);
      if (result.success) {
        toast.success(`Berhasil rollback ke versi ${versionNum}. Versi baru: v${result.newVersion}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal rollback");
    } finally {
      setIsRollingBack(false);
    }
  }

  function formatDate(date: Date | string) {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/pengaturan/mail-templates/${template.id}`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Kembali ke Editor
        </Link>
      </Button>

      {/* Version List */}
      <div className="space-y-2">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada riwayat versi.
            </p>
          </div>
        ) : (
          versions.map((version) => {
            const isActive = version.version === template.version;
            const isExpanded = expandedId === version.id;

            return (
              <div
                key={version.id}
                className={`rounded-lg border transition-colors ${
                  isActive ? "border-primary/50 bg-primary/5" : "bg-card"
                }`}
              >
                {/* Version Header */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Versi {version.version}
                      </span>
                      {isActive && (
                        <Badge variant="default" className="text-[10px]">
                          Aktif
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(version.changedAt)}</span>
                      {version.changeNote && (
                        <>
                          <span>•</span>
                          <span className="italic">{version.changeNote}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      Subject: {version.subject}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Preview toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : version.id)
                      }
                      className="h-8"
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>

                    {/* Rollback button (not for active version) */}
                    {!isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={isRollingBack}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Rollback
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Rollback ke Versi {version.version}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Template akan dikembalikan ke konten versi{" "}
                              {version.version}. Ini akan membuat versi baru
                              (non-destructive) — versi saat ini tidak dihapus.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleRollback(version.id, version.version)
                              }
                            >
                              Ya, Rollback
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Expanded Preview */}
                {isExpanded && (
                  <div className="border-t px-4 py-3">
                    <div className="rounded border bg-white overflow-auto max-h-[400px]">
                      <div
                        className="p-4 text-sm"
                        dangerouslySetInnerHTML={{
                          __html: version.compiledHtml,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Total {versions.length} versi tersimpan
      </p>
    </div>
  );
}
