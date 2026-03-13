"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bell,
  UserPlus,
  Users,
  Send,
  CalendarDays,
  Megaphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Notification } from "@/types";

const typeConfig: Record<
  string,
  { icon: LucideIcon; color: string; bgColor: string; readBgColor: string }
> = {
  event_reminder_24h: {
    icon: CalendarDays,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  event_reminder_1h: {
    icon: AlertCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  event_approved: {
    icon: CheckCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  event_rejected: {
    icon: XCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  new_follower: {
    icon: UserPlus,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  new_friend: {
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  event_invite: {
    icon: Send,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  club_announcement: {
    icon: Megaphone,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  club_update: {
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  new_event: {
    icon: CalendarDays,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  club_approved: {
    icon: CheckCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  club_rejected: {
    icon: XCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  organizer_approved: {
    icon: CheckCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
  organizer_rejected: {
    icon: XCircle,
    color: "text-primary",
    bgColor: "bg-primary/10",
    readBgColor: "bg-muted",
  },
};

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/** Determine time group for section headers */
export function getTimeGroup(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= todayStart) return "Today";

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  if (date >= yesterdayStart) return "Yesterday";

  return "Older";
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({
  notification,
  onMarkRead,
}: NotificationItemProps) {
  const config = typeConfig[notification.type] || {
    icon: Bell,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    readBgColor: "bg-muted",
  };
  const Icon = config.icon;
  const isUnread = !notification.read;

  const handleClick = () => {
    if (isUnread) onMarkRead(notification.id);
  };

  const inner = (
    <div
      className={cn(
        "relative flex gap-4 rounded-xl p-4 items-start transition-colors backdrop-blur-sm",
        isUnread
          ? "bg-card/50 border border-border hover:border-border/80"
          : "bg-card/30 border border-border/50 opacity-80 hover:opacity-100"
      )}
    >
      {/* Unread indicator dot — left side */}
      {isUnread && (
        <div className="absolute top-4 left-2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
      )}

      {/* Icon */}
      <div
        className={cn(
          "h-12 w-12 rounded-full flex items-center justify-center shrink-0 ml-2",
          isUnread ? config.bgColor : config.readBgColor
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            isUnread ? config.color : "text-muted-foreground"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center gap-1">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-base font-medium leading-normal",
                isUnread ? "text-foreground" : "text-foreground/80"
              )}
            >
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-sm text-muted-foreground leading-normal mt-0.5">
                {notification.message}
              </p>
            )}
          </div>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap ml-4 mt-0.5">
            {timeAgo(notification.created_at)}
          </span>
        </div>
      </div>
    </div>
  );

  if (notification.event_id) {
    return (
      <Link
        href={`/events/${notification.event_id}`}
        onClick={handleClick}
        className="block w-full"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="w-full text-left">
      {inner}
    </button>
  );
}
