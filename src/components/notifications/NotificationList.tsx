"use client";

import { NotificationItem, getTimeGroup } from "./NotificationItem";
import type { Notification } from "@/types";
import { Bell } from "lucide-react";

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onAcceptFriendRequest?: (id: string) => void;
  onDeclineFriendRequest?: (id: string) => void;
}

/** Group notifications by time section and preserve order */
function groupByTime(
  notifications: Notification[]
): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};
  const order: string[] = [];

  for (const n of notifications) {
    const group = getTimeGroup(n.created_at);
    if (!groups[group]) {
      groups[group] = [];
      order.push(group);
    }
    groups[group].push(n);
  }

  return order.map((label) => ({ label, items: groups[label] }));
}

export function NotificationList({
  notifications,
  onMarkRead,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4">
          <Bell className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          No notifications yet
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          When you get notifications about events, reminders, or updates,
          they&apos;ll show up here.
        </p>
      </div>
    );
  }

  const sections = groupByTime(notifications);

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.label}>
          <h3 className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">
            {section.label}
          </h3>
          <div className="flex flex-col gap-3">
            {section.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
                onAcceptFriendRequest={onAcceptFriendRequest}
                onDeclineFriendRequest={onDeclineFriendRequest}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
