import {
  AlertCircle,
  AtSign,
  Banknote,
  FileCheck,
  FileCheck2,
  FileX,
  FolderKanban,
  Inbox,
  Mail,
  Settings,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Notification } from "@/server/db/schema";

type NotificationType = Notification["type"];

const ICON_CONFIG: Record<NotificationType, {
  icon: LucideIcon;
  surfaceClassName: string;
  iconClassName: string;
}> = {
  disposisi_baru: {
    icon: Mail,
    surfaceClassName: "bg-blue-50 dark:bg-blue-950/30",
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
  disposisi_deadline: {
    icon: AlertCircle,
    surfaceClassName: "bg-amber-50 dark:bg-amber-950/30",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  surat_keluar_approval: {
    icon: FileCheck,
    surfaceClassName: "bg-violet-50 dark:bg-violet-950/30",
    iconClassName: "text-violet-600 dark:text-violet-400",
  },
  surat_keluar_revisi: {
    icon: FileX,
    surfaceClassName: "bg-red-50 dark:bg-red-950/30",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  surat_keluar_selesai: {
    icon: FileCheck2,
    surfaceClassName: "bg-emerald-50 dark:bg-emerald-950/30",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  surat_masuk_baru: {
    icon: Inbox,
    surfaceClassName: "bg-cyan-50 dark:bg-cyan-950/30",
    iconClassName: "text-cyan-600 dark:text-cyan-400",
  },
  project_invitation: {
    icon: UserPlus,
    surfaceClassName: "bg-indigo-50 dark:bg-indigo-950/30",
    iconClassName: "text-indigo-600 dark:text-indigo-400",
  },
  mention: {
    icon: AtSign,
    surfaceClassName: "bg-pink-50 dark:bg-pink-950/30",
    iconClassName: "text-pink-600 dark:text-pink-400",
  },
  project_update: {
    icon: FolderKanban,
    surfaceClassName: "bg-teal-50 dark:bg-teal-950/30",
    iconClassName: "text-teal-600 dark:text-teal-400",
  },
  honorarium_status: {
    icon: Banknote,
    surfaceClassName: "bg-emerald-50 dark:bg-emerald-950/30",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  system: {
    icon: Settings,
    surfaceClassName: "bg-muted",
    iconClassName: "text-muted-foreground",
  },
};

export function NotificationIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const config = ICON_CONFIG[type] ?? ICON_CONFIG.system;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        config.surfaceClassName,
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", config.iconClassName)} />
    </span>
  );
}
