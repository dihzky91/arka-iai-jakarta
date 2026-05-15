import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { ParticipantManager } from "@/components/sertifikat/ParticipantManager";
import {
  getEvent,
  getEventQuickStats,
} from "@/server/actions/sertifikat/events";
import { listByEvent } from "@/server/actions/sertifikat/participants";

export const metadata: Metadata = {
  title: "Detail Kegiatan Sertifikat | ARKA",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const [event, participantList, initialStats] = await Promise.all([
    getEvent(eventId),
    listByEvent(eventId),
    getEventQuickStats(eventId),
  ]);

  if (!event) notFound();

  return (
    <PageWrapper
      title="Detail Kegiatan"
      description="Kelola peserta, import data, dan QR verifikasi untuk kegiatan ini."
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/sertifikat/kegiatan">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Kegiatan
          </Link>
        </Button>
      </div>
      <ParticipantManager
        event={event}
        initialParticipants={participantList}
        initialStats={initialStats}
      />
    </PageWrapper>
  );
}
