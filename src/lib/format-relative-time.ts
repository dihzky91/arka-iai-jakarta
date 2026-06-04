import {
  APP_TIME_ZONE,
  addDaysToIsoDate,
  getTodayIsoInJakarta,
  getWeekdayInJakarta,
} from "@/lib/utils";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

type NotificationLike = {
  createdAt: string | Date;
};

export type NotificationTimeGroup = {
  key: "today" | "yesterday" | "this_week" | "older";
  label: "Hari Ini" | "Kemarin" | "Minggu Ini" | "Lebih Lama";
};

export type GroupedNotifications<T extends NotificationLike> = NotificationTimeGroup & {
  notifications: T[];
};

const GROUPS: NotificationTimeGroup[] = [
  { key: "today", label: "Hari Ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "this_week", label: "Minggu Ini" },
  { key: "older", label: "Lebih Lama" },
];

function toDate(date: string | Date): Date {
  return typeof date === "string" ? new Date(date) : date;
}

function getJakartaIsoDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toDate(date));
}

function isoDateToDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / 86_400_000);
}

export function formatRelativeTime(date: string | Date, now = new Date()): string {
  const target = toDate(date);
  const diffMs = Math.max(0, now.getTime() - target.getTime());

  if (diffMs < MINUTE_MS) {
    return "Baru saja";
  }

  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)}m lalu`;
  }

  if (diffMs < 24 * HOUR_MS) {
    return `${Math.floor(diffMs / HOUR_MS)}j lalu`;
  }

  const nowDay = isoDateToDayNumber(getJakartaIsoDate(now));
  const targetDay = isoDateToDayNumber(getJakartaIsoDate(target));
  const dayDiff = Math.max(0, nowDay - targetDay);

  if (dayDiff === 1) {
    return "Kemarin";
  }

  if (dayDiff >= 2 && dayDiff <= 6) {
    return `${dayDiff}h lalu`;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: APP_TIME_ZONE,
  }).format(target);
}

export function groupNotificationsByTime<T extends NotificationLike>(
  notifications: T[],
  now = new Date(),
): GroupedNotifications<T>[] {
  const today = getTodayIsoInJakarta(now);
  const yesterday = addDaysToIsoDate(today, -1);
  const mondayOffset = getWeekdayInJakarta(now) === 0 ? -6 : 1 - getWeekdayInJakarta(now);
  const weekStart = addDaysToIsoDate(today, mondayOffset);

  const grouped = new Map<NotificationTimeGroup["key"], T[]>(
    GROUPS.map((group) => [group.key, []]),
  );

  for (const notification of notifications) {
    const notificationDate = getJakartaIsoDate(notification.createdAt);

    if (notificationDate >= today) {
      grouped.get("today")?.push(notification);
    } else if (notificationDate >= yesterday) {
      grouped.get("yesterday")?.push(notification);
    } else if (notificationDate >= weekStart) {
      grouped.get("this_week")?.push(notification);
    } else {
      grouped.get("older")?.push(notification);
    }
  }

  return GROUPS.map((group) => ({
    ...group,
    notifications: grouped.get(group.key) ?? [],
  })).filter((group) => group.notifications.length > 0);
}
