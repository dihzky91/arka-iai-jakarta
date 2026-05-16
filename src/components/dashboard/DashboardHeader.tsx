import { Clock } from "lucide-react";
import { formatTanggalLengkapJakarta } from "@/lib/utils";

interface DashboardHeaderProps {
  userName: string | null;
}

function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );

  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  const greeting = getGreeting();
  const today = formatTanggalLengkapJakarta(new Date());
  const firstName = userName?.split(" ")[0] ?? "";

  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
        {greeting}
        {firstName ? `, ${firstName}!` : "!"}
      </h1>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {today} · Berikut ringkasan aktivitas yang perlu Anda perhatikan hari ini.
      </p>
    </header>
  );
}
