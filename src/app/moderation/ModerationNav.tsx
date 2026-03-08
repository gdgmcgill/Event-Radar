"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileQuestion,
  List,
  Users,
  ClipboardList,
  BarChart3,
  Building2,
  ScrollText,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Pending", path: "/moderation/pending", icon: FileQuestion },
  { name: "All Events", path: "/moderation/events", icon: List },
  { name: "Users", path: "/moderation/users", icon: Users },
  { name: "Organizer Requests", path: "/moderation/organizer-requests", icon: ClipboardList },
  { name: "Clubs", path: "/moderation/clubs", icon: Building2 },
  { name: "Stats", path: "/moderation/stats", icon: BarChart3 },
  { name: "Audit Log", path: "/moderation/audit-log", icon: ScrollText },
];

export function ModerationNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Moderation navigation" className="flex items-center gap-1 overflow-x-auto border-b border-border pb-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
