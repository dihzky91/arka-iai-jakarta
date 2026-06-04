"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { groupNotificationsByTime } from "@/lib/format-relative-time";
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/server/actions/notifications";
import type { Notification } from "@/server/db/schema";

import { NotificationEmptyState } from "./NotificationEmptyState";
import { NotificationItem } from "./NotificationItem";

interface NotificationBellProps {
  userId: string;
}

const PANEL_ITEM_LIMIT = 15;

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        getNotifications({ limit: PANEL_ITEM_LIMIT }),
        getUnreadNotificationCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      // Session expired atau belum login: interval berikutnya akan retry.
      console.warn("[NotificationBell] Failed to fetch notifications:", err);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, userId]);

  const groupedNotifications = useMemo(
    () => groupNotificationsByTime(notifications),
    [notifications],
  );

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    await fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    await fetchNotifications();
  };

  const handleDelete = async (id: string) => {
    const deletedNotification = notifications.find((notification) => notification.id === id);

    await deleteNotification(id);
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));

    if (deletedNotification && !deletedNotification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleOpenNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    if (notification.entitasType && notification.entitasId) {
      const routes: Record<string, string> = {
        disposisi: "/disposisi",
        honorarium_batch: "/jadwal-otomatis/honorarium",
        project: "/projects",
        surat_keluar: "/surat-keluar",
        surat_masuk: "/surat-masuk",
      };
      const baseRoute = routes[notification.entitasType];

      if (baseRoute) {
        router.push(`${baseRoute}/${notification.entitasId}`);
      }
    }

    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Buka notifikasi">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[calc(100vw-2rem)] overflow-hidden p-0 sm:w-96"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <h2 className="text-base font-medium leading-none">Notifikasi</h2>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 py-0 text-xs"
              onClick={() => void handleMarkAllAsRead()}
            >
              Tandai semua dibaca
            </Button>
          )}
        </div>

        <ScrollArea className="h-[28rem] max-h-[calc(100vh-10rem)]">
          {notifications.length === 0 ? (
            <NotificationEmptyState />
          ) : (
            <div>
              {groupedNotifications.map((group) => (
                <section key={group.key}>
                  <div className="px-4 pb-1.5 pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onOpen={(selectedNotification) => void handleOpenNotification(selectedNotification)}
                      onMarkAsRead={(id) => void handleMarkAsRead(id)}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border/60 px-4 py-3">
          <Button
            asChild
            variant="link"
            className="h-auto px-0 py-0 text-sm font-medium"
          >
            <Link href="/notifikasi" onClick={() => setOpen(false)}>
              Lihat semua notifikasi →
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
