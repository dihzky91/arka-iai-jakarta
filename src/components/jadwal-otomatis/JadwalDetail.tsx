"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsAppClassActions } from "@/components/jadwal-otomatis/WhatsAppClassActions";
import { InstructorAssignmentSummary } from "./jadwal-detail/InstructorAssignmentSummary";
import { AssignInstrukturSection } from "./jadwal-detail/AssignInstrukturSection";
import { JadwalSesiSection } from "./jadwal-detail/JadwalSesiSection";
import type { JadwalDetailProps } from "./jadwal-detail/types";
import { STATUS_COLORS, formatDate } from "./jadwal-detail/types";

export function JadwalDetail({
  kelas,
  sessions,
  assignments,
  instructors,
  materiBlocks,
  canManage,
  honorariumSnapshot,
  whatsappTemplates,
  whatsappLogs,
  whatsappBotEnabled,
  mode = "full",
}: JadwalDetailProps) {
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [sessions],
  );

  const sessionCount = sortedSessions.filter((s) => !s.isExamDay).length;
  const examCount = sortedSessions.filter((s) => s.isExamDay).length;

  const sessionBlocks = useMemo(() => {
    const blocks = new Set<string>(materiBlocks);
    for (const session of sortedSessions) {
      if (session.materiName && !session.isExamDay) blocks.add(session.materiName);
    }
    return [...blocks];
  }, [sortedSessions, materiBlocks]);

  return (
    <div className="space-y-6">
      {/* INFORMASI KELAS */}
      {(mode === "full" || mode === "informasi") && (
        <>
          <Card className="rounded-[24px]">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Informasi Kelas</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Program</p>
                  <p className="font-medium">{kelas.programName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipe Kelas</p>
                  <p className="font-medium">{kelas.classTypeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Mulai</p>
                  <p className="font-medium">{formatDate(kelas.startDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Selesai</p>
                  <p className="font-medium">{kelas.endDate ? formatDate(kelas.endDate) : "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Metode</p>
                  <Badge variant={kelas.mode === "online" ? "secondary" : "default"}>
                    {kelas.mode === "online" ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lokasi</p>
                  <p className="font-medium">{kelas.lokasi ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={STATUS_COLORS[kelas.status] ?? "outline"}>{kelas.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sesi</p>
                  <p className="font-medium">{sessionCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Ujian</p>
                  <p className="font-medium">{examCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <WhatsAppClassActions
            kelas={kelas}
            sessions={sessions}
            assignments={assignments}
            instructors={instructors}
            honorariumSnapshot={honorariumSnapshot}
            canManage={canManage}
            templates={whatsappTemplates}
            logs={whatsappLogs}
            whatsappBotEnabled={whatsappBotEnabled}
          />
        </>
      )}

      {/* INSTRUKTUR */}
      {(mode === "full" || mode === "instruktur") && canManage ? (
        <>
          <InstructorAssignmentSummary
            assignments={assignments}
            sessions={sortedSessions}
            sessionBlocks={sessionBlocks}
          />
          <AssignInstrukturSection
            kelasId={kelas.id}
            programId={kelas.programId}
            sessions={sessions}
            assignments={assignments}
            instructors={instructors}
            sessionBlocks={sessionBlocks}
          />
        </>
      ) : null}

      {/* JADWAL SESI */}
      {(mode === "full" || mode === "jadwal") && (
        <JadwalSesiSection
          kelas={kelas}
          sessions={sessions}
          assignments={assignments}
          instructors={instructors}
          canManage={canManage}
        />
      )}
    </div>
  );
}
