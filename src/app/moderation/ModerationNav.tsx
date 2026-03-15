"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarClock,
  Building2,
  UserCheck,
  Users,
  Star,
  ScrollText,
  BarChart3,
} from "lucide-react";

const contentItems = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Event Queue", path: "/moderation/events", icon: CalendarClock },
  { name: "Club Approvals", path: "/moderation/clubs", icon: Building2 },
  { name: "Featured Events", path: "/moderation/featured", icon: Star },
];

const userItems = [
  { name: "Organizer Requests", path: "/moderation/organizer-requests", icon: UserCheck },
  { name: "User Management", path: "/moderation/users", icon: Users },
];

const systemItems = [
  { name: "Audit Log", path: "/moderation/audit-log", icon: ScrollText },
  { name: "Analytics", path: "/moderation/stats", icon: BarChart3 },
];

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof contentItems;
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.path === "/moderation"
            ? pathname === "/moderation"
            : pathname.startsWith(item.path);

        return (
          <Link
            key={item.path}
            href={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-zinc-800 text-white border-l-2 border-red-500"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function ModerationNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-zinc-900 text-zinc-400">
      {/* Brand — click to go home */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 hover:bg-zinc-800/50 transition-colors" title="Back to Uni-Verse">
        <Image src="/uni-verse_logo.png" alt="Uni-Verse" width={28} height={28} className="h-7 w-7 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-zinc-100 leading-tight">Uni-Verse</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Moderation</span>
        </div>
      </Link>

      <div className="h-px bg-zinc-800" />

      {/* Nav groups */}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <NavSection label="Content" items={contentItems} pathname={pathname} />
        <NavSection label="Users" items={userItems} pathname={pathname} />
        <NavSection label="System" items={systemItems} pathname={pathname} />
      </nav>

      {/* Status footer */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs text-zinc-500">System Status: Online</span>
        </div>
      </div>
    </aside>
  );
}
