"use client";

import { useState, useTransition } from "react";
import { Award, ExternalLink, Loader2, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getProjectCertificateInfo,
  type ProjectCertificateInfo,
} from "@/server/actions/projects";

export function CertificateSection({
  projectId,
  initialInfo,
}: {
  projectId: string;
  initialInfo?: ProjectCertificateInfo | null;
}) {
  const [info, setInfo] = useState<ProjectCertificateInfo | null | undefined>(
    initialInfo,
  );
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getProjectCertificateInfo(projectId);
      setInfo(result);
    });
  }

  if (!info) return null;

  const canGenerate =
    info.eventId != null &&
    info.status === "completed";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
            <Award className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">Sertifikat</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
        </Button>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {info.eventName ? (
          <div>
            <p className="text-xs text-muted-foreground">Kegiatan</p>
            <p className="font-medium">{info.eventName}</p>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{info.participantCount} peserta</span>
        </div>

        {info.participantCount > 0 ? (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs"
          >
            Sertifikat: {info.participantCount} diterbitkan
          </Badge>
        ) : null}
      </div>

      {info.participantCount > 0 ? (
        <div className="mt-3">
          <Button asChild variant="outline" size="sm" className="w-full text-xs">
            <a
              href={`/sertifikat/kegiatan/${info.eventId}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3 w-3" />
              Buka Modul Sertifikat →
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
