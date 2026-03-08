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

// Category derived from notification type
type NotificationCategory = "event" | "social" | "clubs";

function getCategory(type: string): NotificationCategory {
  if (
    type.startsWith("event_") ||
    type === "event_reminder_24h" ||
    type === "event_reminder_1h"
  )
    return "event";
  if (
    type === "new_follower" ||
    type === "new_friend" ||
    type === "friend_request"
  )
    return "social";
  if (type.startsWith("club_")) return "clubs";
  // Default based on keywords
  if (type.includes("club") || type.includes("group")) return "clubs";
  if (type.includes("friend") || type.includes("social") || type.includes("rsvp"))
    return "social";
  return "event";
}

const categoryBadge: Record<
  NotificationCategory,
  { label: string; className: string; mutedClassName: string }
> = {
  event: {
    label: "Event",
    className: "bg-red-600/10 text-red-600",
    mutedClassName: "bg-red-600/5 text-red-600/60",
  },
  social: {
    label: "Social",
    className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    mutedClassName:
      "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  clubs: {
    label: "Clubs",
    className:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    mutedClassName:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

const typeConfig: Record<
  string,
  { icon: LucideIcon; color: string; bgColor: string; shape: "rounded-lg" | "rounded-full" }
> = {
  event_reminder_24h: {
    icon: CalendarDays,
    color: "text-red-600",
    bgColor: "bg-red-600/10",
    shape: "rounded-lg",
  },
  event_reminder_1h: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-600/10",
    shape: "rounded-lg",
  },
  event_approved: {
    icon: CheckCircle,
    color: "text-red-600",
    bgColor: "bg-red-600/10",
    shape: "rounded-lg",
  },
  event_rejected: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-600/10",
    shape: "rounded-lg",
  },
  new_follower: {
    icon: UserPlus,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    shape: "rounded-full",
  },
  new_friend: {
    icon: Users,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    shape: "rounded-full",
  },
  friend_request: {
    icon: UserPlus,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    shape: "rounded-full",
  },
  event_invite: {
    icon: Send,
    color: "text-red-600",
    bgColor: "bg-red-600/10",
    shape: "rounded-lg",
  },
  club_announcement: {
    icon: Megaphone,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    shape: "rounded-lg",
  },
  club_update: {
    icon: Users,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    shape: "rounded-lg",
  },
};

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

/** Determine time group for section headers */
export function getTimeGroup(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // "New" = within last hour
  if (diffHours < 1) return "New";

  // "Earlier today" = same calendar day but older than 1 hour
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= todayStart) return "Earlier today";

  // "Yesterday"
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  if (date >= yesterdayStart) return "Yesterday";

  // Older
  return "Older";
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onAcceptFriendRequest?: (id: string) => void;
  onDeclineFriendRequest?: (id: string) => void;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
}: NotificationItemProps) {
  const config = typeConfig[notification.type] || {
    icon: Bell,
    color: "text-slate-500",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    shape: "rounded-lg" as const,
  };
  const Icon = config.icon;
  const category = getCategory(notification.type);
  const badge = categoryBadge[category];
  const isUnread = !notification.read;
  const isFriendRequest = notification.type === "friend_request";

  const handleClick = () => {
    if (isUnread) onMarkRead(notification.id);
  };

  const inner = (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-xl relative group transition-all cursor-pointer",
        isUnread
          ? "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-red-600/30"
          : "bg-transparent border border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20"
      )}
    >
      {/* Unread indicator dot */}
      {isUnread && (
        <div className="absolute right-4 top-4 size-2.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(237,29,49,0.5)]" />
      )}

      {/* Icon / Avatar */}
      <div
        className={cn(
          "size-12 flex items-center justify-center shrink-0 overflow-hidden",
          config.shape,
          isUnread ? config.bgColor : "",
          !isUnread && category === "clubs"
            ? "bg-emerald-100 dark:bg-emerald-900/30"
            : "",
          !isUnread && category === "event"
            ? "bg-red-600/5"
            : "",
          !isUnread && category === "social"
            ? "grayscale opacity-70"
            : ""
        )}
      >
        <Icon
          className={cn(
            "size-5",
            isUnread ? config.color : "",
            !isUnread && category === "event"
              ? "text-red-600/60"
              : "",
            !isUnread && category === "clubs"
              ? "text-emerald-600 dark:text-emerald-400"
              : "",
            !isUnread && category === "social"
              ? "text-blue-600 dark:text-blue-400"
              : ""
          )}
        />
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col pr-6 w-full",
          isFriendRequest ? "gap-3" : "gap-1"
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "font-semibold text-base",
                isUnread
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-700 dark:text-slate-300 font-medium"
              )}
            >
              {notification.title}
            </p>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap",
                isUnread ? badge.className : badge.mutedClassName
              )}
            >
              {badge.label}
            </span>
          </div>
          {notification.message && (
            <p
              className={cn(
                "text-sm leading-relaxed mt-0.5",
                isUnread
                  ? "text-slate-600 dark:text-slate-400"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              {notification.message}
            </p>
          )}
          <p className="text-slate-400 text-xs mt-1">
            {timeAgo(notification.created_at)}
          </p>
        </div>

        {/* Friend request actions */}
        {isFriendRequest && isUnread && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAcceptFriendRequest?.(notification.id);
              }}
              className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-600/90 transition-colors"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeclineFriendRequest?.(notification.id);
              }}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Decline
            </button>
          </div>
        )}
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
