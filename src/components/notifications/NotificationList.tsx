"use client";

import { NotificationItem, type Notification } from "./NotificationItem";
import { Bell } from "lucide-react";

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}

export function NotificationList({ notifications, onMarkRead }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="rounded-full bg-muted p-4">
          <Bell className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold text-foreground">No notifications yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          When you get notifications about events, reminders, or updates, they&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}
