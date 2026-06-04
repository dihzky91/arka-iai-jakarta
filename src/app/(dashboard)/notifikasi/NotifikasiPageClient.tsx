"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Filter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupNotificationsByTime } from "@/lib/format-relative-time";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/server/actions/notifications";
import type { Notification } from "@/server/db/schema";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { NotificationEmptyState } from "@/components/notifications/NotificationEmptyState";

type FilterMode = "all" | "unread" | "read";

interface NotifikasiPageClientProps {
  initialData: Notification[];
}

export function NotifikasiPageClient({ initialData }: NotifikasiPageClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initialData);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [isPending, startTransition] = useTransition();

  const filteredNotifications = useMemo(() => {
    if (filterMode === "unread") return notifications.filter((n) => !n.isRead);
    if (filterMode === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, filterMode]);

  const groupedNotifications = useMemo(
    () => groupNotificationsByTime(filteredNotifications),
    [filteredNotifications],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function refresh() {
    startTransition(async () => {
      const fresh = await getNotifications({ limit: 50 });
      setNotifications(fresh);
    });
  }

  function handleMarkAsRead(id: string) {
    startTransition(async () => {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n)),
      );
    });
  }

  function handleMarkAllAsRead() {
    startTransition(async () => {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date() })));
      toast.success("Semua notifikasi ditandai dibaca.");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    });
  }

  function handleOpen(notification: Notification) {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }

    if (notification.entitasType && notification.entitasId) {
      const routes: Record<string, string> = {
        disposisi: "/disposisi",
        surat_keluar: "/surat-keluar",
        surat_masuk: "/surat-masuk",
        honorarium_batch: "/jadwal-otomatis/honorarium",
        project: "/projects",
      };
      const baseRoute = routes[notification.entitasType];
      if (baseRoute) {
        router.push(`${baseRoute}/${notification.entitasId}`);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="unread">Belum Dibaca ({unreadCount})</SelectItem>
              <SelectItem value="read">Sudah Dibaca</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </Button>
        )}
      </div>

      {/* Content */}
      <Card className="rounded-[24px]">
        <CardContent className="p-0">
          {filteredNotifications.length === 0 ? (
            <NotificationEmptyState />
          ) : (
            <div>
              {groupedNotifications.map((group) => (
                <section key={group.key}>
                  <div className="px-5 pb-1.5 pt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onOpen={handleOpen}
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
