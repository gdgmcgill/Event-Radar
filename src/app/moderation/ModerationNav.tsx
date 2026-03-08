"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileQuestion,
  AlertTriangle,
  Users,
  History,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Event Queue", path: "/moderation/pending", icon: FileQuestion },
  { name: "Reported Content", path: "/moderation/events", icon: AlertTriangle },
  { name: "User Management", path: "/moderation/users", icon: Users },
  { name: "Mod Logs", path: "/moderation/audit-log", icon: History },
];

export function ModerationNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-red-600/10 bg-white p-4 hidden lg:flex flex-col justify-between shrink-0">
      <div className="flex flex-col gap-6">
        <div className="px-2">
          <h1 className="text-slate-900 text-base font-bold">McGill University</h1>
          <p className="text-red-600 text-xs font-semibold uppercase tracking-wider">Moderation Portal</p>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all text-sm",
                  isActive
                    ? "bg-red-600 text-white shadow-sm shadow-red-600/20"
                    : "text-slate-600 hover:bg-red-600/10 hover:text-red-600"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-2">
        <div className="rounded-xl bg-slate-50 p-4 border border-red-600/5">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">System Status</p>
          <div className="flex items-center gap-2">
            <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium">All systems normal</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
