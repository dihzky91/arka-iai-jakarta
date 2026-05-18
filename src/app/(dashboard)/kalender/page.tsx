import type { Metadata } from "next";
import { CalendarDashboard } from "@/components/calendar/CalendarDashboard";
import { getCalendarEvents } from "@/server/actions/calendar";
import { getSession } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Kalender | ARKA",
};

export default async function CalendarPage() {
  const session = await getSession();
  const userId = session?.user?.id as string | undefined;

  // Only fetch events within a reasonable range (3 months back + 3 months ahead)
  // instead of loading ALL events from the database
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - 3);
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 3);

  const events = await getCalendarEvents({
    userId,
    includePublic: true,
    startDate,
    endDate,
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
