"use client";

import { Check, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { Notification } from "@/server/db/schema";

import { NotificationIcon } from "./NotificationIcon";

function renderMessage(message: string) {
  return message.split(/(\*\*[^*]+\*\*)/).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

type NotificationItemProps = {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
};

export function NotificationItem({
  notification,
  onOpen,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const isUnread = !notification.isRead;

  return (
    <div
      className={cn(
        "group relative cursor-pointer border-b border-border/40 px-4 py-3 transition-colors animate-in fade-in-0",
        "hover:bg-muted/40 focus-within:bg-muted/40",
        isUnread && "bg-primary/5",
      )}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(notification);
        }
      }}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          {isUnread && (
            <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-popover" />
          )}
          <NotificationIcon type={notification.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium leading-5",
                !isUnread && "text-muted-foreground",
              )}
            >
              {notification.title}
            </p>
            <span className="shrink-0 pt-0.5 text-[11px] leading-4 text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {renderMessage(notification.message)}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
          {isUnread && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 rounded-lg"
              aria-label="Tandai dibaca"
              onClick={(event) => {
                event.stopPropagation();
                onMarkAsRead(notification.id);
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
            aria-label="Hapus notifikasi"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(notification.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-8 w-8 rounded-lg"
                aria-label="Aksi notifikasi"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isUnread && (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                >
                  <Check className="h-4 w-4" />
                  Tandai dibaca
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(notification.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
