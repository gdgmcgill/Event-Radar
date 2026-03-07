"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle, XCircle, Bell, UserPlus, Users, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Notification } from "@/types";

const typeConfig: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  event_reminder_24h: {
    icon: Clock,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  event_reminder_1h: {
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  event_approved: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  event_rejected: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  new_follower: {
    icon: UserPlus,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  new_friend: {
    icon: Users,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  event_invite: {
    icon: Send,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const config = typeConfig[notification.type] || {
    icon: Bell,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.read) onMarkRead(notification.id);
  };

  const inner = (
    <div
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-xl text-left transition-colors",
        notification.read
          ? "bg-card/50 opacity-70"
          : "bg-card hover:bg-muted/50 shadow-sm border border-border/40"
      )}
    >
      <div className={cn("flex items-center justify-center h-10 w-10 rounded-xl shrink-0", config.bgColor)}>
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-semibold text-foreground", !notification.read && "font-bold")}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>
    </div>
  );

  if (notification.event_id) {
    return (
      <Link href={`/events/${notification.event_id}`} onClick={handleClick} className="block w-full">
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
