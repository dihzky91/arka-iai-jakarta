import type { Metadata } from "next";
import { CalendarDashboard } from "@/components/calendar/CalendarDashboard";
import {
  getCalendarEvents,
  backfillCalendarEvents,
} from "@/server/actions/calendar";
import { getSession } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Kalender | ARKA",
};

export default async function CalendarPage() {
  const session = await getSession();
  const userId = session?.user?.id as string | undefined;

  // Backfill data ujian/pengawas yang sudah ada ke calendar (hanya sekali)
  await backfillCalendarEvents();

  const events = await getCalendarEvents({
    userId,
    includePublic: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Kalender</h1>
        <p className="text-muted-foreground">
          Jadwal ujian, deadline disposisi, jadwal pengawas, dan event lainnya.
        </p>
      </div>

      <CalendarDashboard initialEvents={events} userId={userId} />
    </div>
  );
}
