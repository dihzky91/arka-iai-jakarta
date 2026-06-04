import { Bell } from "lucide-react";

export function NotificationEmptyState() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Tidak ada notifikasi</p>
      <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
        Notifikasi disposisi, surat, project, dan honorarium akan muncul di sini.
      </p>
    </div>
  );
}
