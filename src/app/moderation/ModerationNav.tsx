"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarClock,
  Building2,
  MessageSquare,
  UserCheck,
  Users,
  Contact2,
  Star,
  ScrollText,
  BarChart3,
  Flag,
  BookOpen,
  Inbox,
} from "lucide-react";

const contentItems = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Pending Review", path: "/moderation/pending", icon: ClipboardCheck },
  { name: "Event Queue", path: "/moderation/events", icon: CalendarClock },
  { name: "Opportunities", path: "/moderation/opportunities", icon: Star },
  { name: "Resources", path: "/moderation/resources", icon: BookOpen },
  { name: "Submissions", path: "/moderation/submissions", icon: Inbox },
  { name: "Club Approvals", path: "/moderation/clubs", icon: Building2 },
  { name: "Appeals", path: "/moderation/appeals", icon: MessageSquare },
  { name: "Reports", path: "/moderation/reports", icon: Flag },
  { name: "Featured Events", path: "/moderation/featured", icon: Star },
];

const userItems = [
  { name: "Organizer Requests", path: "/moderation/organizer-requests", icon: UserCheck },
  { name: "User Management", path: "/moderation/users", icon: Users },
  { name: "Organizers", path: "/moderation/organizers", icon: Contact2 },
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
      <div className="border-t border-border mt-1 pt-4 pb-1 px-4">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
      </div>
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
              "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
              isActive
                ? "bg-primary text-white font-semibold shadow-md shadow-primary/10"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function ModerationNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className="flex w-full flex-col border-b border-border bg-card/90 p-4 backdrop-blur-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-60 lg:border-b-0 lg:border-r">
      {/* Brand */}
      <Link
        href="/"
        className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
        title="Back to Uni-Verse"
      >
        <Image
          src="/brand/logo/uni-verse-logo-primary.png"
          alt="Uni-Verse"
          width={36}
          height={36}
          className="h-9 w-9 rounded-lg object-contain"
        />
        <div className="flex flex-col">
          <h1 className="text-lg font-black uppercase tracking-widest text-foreground leading-none">
            UNI-VERSE
          </h1>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
            Moderation
          </p>
        </div>
      </Link>

      <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm lg:hidden" aria-expanded={open} aria-controls="moderation-navigation" onClick={() => setOpen(!open)}>{open ? "Close moderation menu" : "Moderation menu"}</button>
      {/* Nav groups */}
      <nav id="moderation-navigation" onClick={() => setOpen(false)} className={`${open ? "flex" : "hidden"} flex-1 flex-col gap-4 overflow-y-auto lg:flex`}>
        <NavSection label="Content" items={contentItems} pathname={pathname} />
        <NavSection label="Users" items={userItems} pathname={pathname} />
        <NavSection label="System" items={systemItems} pathname={pathname} />
      </nav>

      {/* Status footer */}
      <div className="hidden px-4 py-4 border-t border-border mt-2 lg:block">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs text-muted-foreground">System Status: Online</span>
        </div>
      </div>
    </aside>
  );
}
