"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  guestNavItems,
  baseNavItems,
  organizerNavItems,
  adminNavItems,
  type NavItem,
} from "./navItems";
import { useAuthStore } from "@/store/useAuthStore";
import { isAdmin } from "@/lib/roles";
import { PlusCircle, MoreVertical, Compass } from "lucide-react";

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.path;

  return (
    <Link
      href={item.path}
      title={collapsed ? item.name : undefined}
      className={cn(
        "flex items-center rounded-xl font-medium transition-all duration-200 whitespace-nowrap overflow-hidden",
        collapsed ? "justify-center px-0 py-3" : "gap-4 px-4 py-3",
        isActive
          ? "bg-primary text-white font-semibold shadow-md shadow-primary/10"
          : "text-slate-600 dark:text-slate-400 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span
        className={cn(
          "transition-all duration-300",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {item.name}
      </span>
    </Link>
  );
}

export function SideNavBar() {
  const pathname = usePathname();
  const { user, hasClubs } = useAuthStore();
  const isAuthenticated = !!user;
  const isHomepage = pathname === "/";

  // On homepage the sidebar starts collapsed and expands on hover
  const canCollapse = isHomepage;
  const [hovered, setHovered] = useState(false);
  const collapsed = canCollapse && !hovered;

  // Select the right nav items but filter out Profile (shown separately)
  const coreNavItems = isAuthenticated
    ? baseNavItems.filter(
        (item) =>
          item.path !== "/profile" &&
          item.path !== "/create-event" &&
          item.path !== "/notifications"
      )
    : guestNavItems;
  const showOrganizer = isAuthenticated && hasClubs;
  const showAdmin = isAuthenticated && user && isAdmin(user);

  const sidebarWidth = collapsed ? "w-20" : "w-72";

  return (
    <>
      {/* Desktop Side Navigation */}
      <aside
        onMouseEnter={() => canCollapse && setHovered(true)}
        onMouseLeave={() => canCollapse && setHovered(false)}
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300 overflow-hidden",
          sidebarWidth,
          collapsed ? "p-3" : "p-6",
          "bg-white/85 dark:bg-card/85 backdrop-blur-2xl",
          "border-r border-primary/8 dark:border-border/40"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center mb-10 whitespace-nowrap overflow-hidden", collapsed ? "justify-center px-0" : "gap-3 px-2")}>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div
              className={cn(
                "transition-all duration-300 overflow-hidden",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-foreground leading-none">
                Uni-Verse
              </h1>
              <p className="text-xs font-semibold text-primary/80 uppercase tracking-wider mt-1">
                McGill University
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {coreNavItems.map((item) => (
            <NavLink key={item.path} item={item} pathname={pathname} collapsed={collapsed} />
          ))}

          {showOrganizer && (
            <>
              {collapsed ? (
                <div className="pt-4 border-t border-border/40 mt-2" />
              ) : (
                <div className="pt-6 pb-2 px-4 text-xs font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Organizer
                </div>
              )}
              {organizerNavItems.map((item) => (
                <NavLink key={item.path} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          )}

          {showAdmin && (
            <>
              {collapsed ? (
                <div className="pt-4 border-t border-border/40 mt-2" />
              ) : (
                <div className="pt-6 pb-2 px-4 text-xs font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Moderation
                </div>
              )}
              {adminNavItems.map((item) => (
                <NavLink key={item.path} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto space-y-4">
          {/* Create Event CTA */}
          {isAuthenticated && (
            <div className={cn("transition-all duration-300 overflow-hidden", collapsed ? "px-0" : "")}>
              {collapsed ? (
                <Link
                  href="/create-event"
                  title="Create Event"
                  className="flex items-center justify-center w-10 h-10 mx-auto bg-primary text-white rounded-xl hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                >
                  <PlusCircle className="h-5 w-5" />
                </Link>
              ) : (
                <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/10">
                  <p className="text-sm font-bold text-slate-800 dark:text-foreground mb-1 whitespace-nowrap">
                    Hosting something?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground mb-3 whitespace-nowrap">
                    Share your club&apos;s next big event.
                  </p>
                  <Link
                    href="/create-event"
                    className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Create Event
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* User Profile */}
          {isAuthenticated && user && (
            <div className={cn("flex items-center overflow-hidden", collapsed ? "justify-center" : "gap-3 px-2")}>
              <Link href="/profile" className={cn("flex items-center", collapsed ? "" : "gap-3 flex-1 min-w-0")}>
                {user.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={user.name || "User"}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 ring-2 ring-primary/10">
                    {(user.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={cn(
                    "flex-1 min-w-0 transition-all duration-300 overflow-hidden",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  )}
                >
                  <p className="text-sm font-bold leading-none text-slate-900 dark:text-foreground truncate">
                    {user.name || "User"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                    {user.year || user.email}
                  </p>
                </div>
              </Link>
              <MoreVertical
                className={cn(
                  "h-4 w-4 text-slate-400 flex-shrink-0 transition-all duration-300",
                  collapsed ? "w-0 opacity-0" : "opacity-100"
                )}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Spacer — always uses the collapsed width so main content doesn't shift on hover */}
      <div className={cn("hidden lg:block flex-shrink-0 transition-all duration-300", canCollapse ? "w-20" : "w-72")} />
    </>
  );
}
