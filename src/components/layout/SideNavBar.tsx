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
import { PlusCircle, Bell, ChevronRight } from "lucide-react";
import { useNotificationCount } from "@/hooks/useNotificationCount";

const EASE = "cubic-bezier(0.4,0,0.2,1)";

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
        "group flex items-center rounded-xl font-medium whitespace-nowrap overflow-hidden",
        "transition-[padding,background-color,color,box-shadow] duration-200",
        collapsed ? "justify-center p-3" : "px-4 py-3",
        isActive
          ? "bg-primary text-white font-semibold shadow-md shadow-primary/10"
          : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
      )}
      style={{ transitionTimingFunction: EASE }}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div
        className="overflow-hidden transition-[max-width,opacity,margin] duration-200"
        style={{
          maxWidth: collapsed ? 0 : 160,
          opacity: collapsed ? 0 : 1,
          marginLeft: collapsed ? 0 : 16,
          transitionTimingFunction: EASE,
        }}
      >
        <span>{item.name}</span>
      </div>
    </Link>
  );
}

function NotificationNavLink({
  pathname,
  collapsed,
}: {
  pathname: string;
  collapsed: boolean;
}) {
  const unreadCount = useNotificationCount();
  const isActive = pathname === "/notifications";

  return (
    <Link
      href="/notifications"
      title={collapsed ? "Notifications" : undefined}
      className={cn(
        "group relative flex items-center rounded-xl font-medium whitespace-nowrap overflow-hidden mb-2",
        "transition-[padding,background-color,color,box-shadow] duration-200",
        collapsed ? "justify-center p-3" : "px-4 py-3",
        isActive
          ? "bg-primary text-white font-semibold shadow-md shadow-primary/10"
          : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
      )}
      style={{ transitionTimingFunction: EASE }}
    >
      <div className="relative flex-shrink-0">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[10px] font-bold min-w-[16px] h-[16px] px-0.5",
              isActive
                ? "bg-white text-primary"
                : "bg-primary text-white"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
      <div
        className="overflow-hidden transition-[max-width,opacity,margin] duration-200"
        style={{
          maxWidth: collapsed ? 0 : 160,
          opacity: collapsed ? 0 : 1,
          marginLeft: collapsed ? 0 : 16,
          transitionTimingFunction: EASE,
        }}
      >
        <span>Notifications</span>
      </div>
    </Link>
  );
}

export function SideNavBar() {
  const pathname = usePathname();
  const { user, hasClubs } = useAuthStore();
  const isAuthenticated = !!user;
  const [hovered, setHovered] = useState(false);
  const collapsed = !hovered;

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

  return (
    <>
      {/* Desktop Side Navigation */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 overflow-hidden",
          "transition-[width,padding] duration-200",
          collapsed ? "w-[72px] py-5 px-1" : "w-72 p-6",
          "bg-card/90 backdrop-blur-2xl",
          "border-r border-border"
        )}
        style={{ transitionTimingFunction: EASE }}
      >
        {/* ── Logo ── */}
        <Link
          href="/"
          className={cn(
            "flex items-center whitespace-nowrap overflow-hidden rounded-xl mb-8",
            "transition-[padding] duration-200",
            collapsed ? "justify-center p-0" : "px-4 py-3"
          )}
          style={{ transitionTimingFunction: EASE }}
        >
          <Image
            src="/uni-verse_logo.png"
            alt="UNI-VERSE"
            width={64}
            height={64}
            className="flex-shrink-0 object-contain transition-[width,height] duration-200"
            style={{
              width: collapsed ? 36 : 36,
              height: collapsed ? 36 : 36,
              transitionTimingFunction: EASE,
            }}
          />
          <div
            className="overflow-hidden transition-[max-width,opacity,margin] duration-200"
            style={{
              maxWidth: collapsed ? 0 : 200,
              opacity: collapsed ? 0 : 1,
              marginLeft: collapsed ? 0 : 12,
              transitionTimingFunction: EASE,
            }}
          >
            <h1 className="text-lg font-black uppercase tracking-widest text-foreground leading-none">
              UNI-VERSE
            </h1>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
              McGill University
            </p>
          </div>
        </Link>

        {/* ── Notifications (prominent, above nav) ── */}
        {isAuthenticated && (
          <NotificationNavLink pathname={pathname} collapsed={collapsed} />
        )}

        {/* ── Navigation ── */}
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
          {coreNavItems.map((item) => (
            <NavLink key={item.path} item={item} pathname={pathname} collapsed={collapsed} />
          ))}

          {showOrganizer && (
            <>
              <div
                className="overflow-hidden whitespace-nowrap transition-[padding,opacity,border-color] duration-200"
                style={{ transitionTimingFunction: EASE }}
              >
                <div className={cn(
                  "border-t border-border mt-3",
                  "transition-[padding] duration-200",
                  collapsed ? "pt-3" : "pt-5 pb-1 px-4"
                )} style={{ transitionTimingFunction: EASE }}>
                  <span
                    className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest transition-opacity duration-200"
                    style={{
                      opacity: collapsed ? 0 : 1,
                      transitionTimingFunction: EASE,
                    }}
                  >
                    Organizer
                  </span>
                </div>
              </div>
              {organizerNavItems.map((item) => (
                <NavLink key={item.path} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          )}

          {showAdmin && (
            <>
              <div
                className="overflow-hidden whitespace-nowrap transition-[padding,opacity,border-color] duration-200"
                style={{ transitionTimingFunction: EASE }}
              >
                <div className={cn(
                  "border-t border-border mt-3",
                  "transition-[padding] duration-200",
                  collapsed ? "pt-3" : "pt-5 pb-1 px-4"
                )} style={{ transitionTimingFunction: EASE }}>
                  <span
                    className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest transition-opacity duration-200"
                    style={{
                      opacity: collapsed ? 0 : 1,
                      transitionTimingFunction: EASE,
                    }}
                  >
                    Moderation
                  </span>
                </div>
              </div>
              {adminNavItems.map((item) => (
                <NavLink key={item.path} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>

        {/* ── Bottom Section ── */}
        <div className="mt-auto pt-4 space-y-2">
          {/* Create Event */}
          {isAuthenticated && (
            <Link
              href="/create-event"
              title={collapsed ? "Create Event" : undefined}
              className={cn(
                "group flex items-center rounded-xl font-medium whitespace-nowrap overflow-hidden",
                "transition-[padding,background-color,color,box-shadow] duration-200",
                collapsed ? "justify-center p-3" : "px-4 py-3",
                pathname === "/create-event"
                  ? "bg-primary text-white font-semibold shadow-md shadow-primary/10"
                  : "text-primary hover:bg-primary/5 dark:hover:bg-primary/10"
              )}
              style={{ transitionTimingFunction: EASE }}
            >
              <PlusCircle className={cn("w-5 h-5 flex-shrink-0", pathname === "/create-event" && "text-white")} />
              <div
                className="overflow-hidden transition-[max-width,opacity,margin] duration-200"
                style={{
                  maxWidth: collapsed ? 0 : 160,
                  opacity: collapsed ? 0 : 1,
                  marginLeft: collapsed ? 0 : 16,
                  transitionTimingFunction: EASE,
                }}
              >
                <span>Create Event</span>
              </div>
            </Link>
          )}

          {/* User Profile */}
          {isAuthenticated && user && (
            <Link
              href="/profile"
              title={collapsed ? user.name || "Profile" : undefined}
              className={cn(
                "group flex items-center overflow-hidden rounded-xl",
                "hover:bg-primary/5 dark:hover:bg-primary/10",
                "transition-[padding,background-color] duration-200",
                collapsed ? "justify-center p-2" : "px-3 py-2.5"
              )}
              style={{ transitionTimingFunction: EASE }}
            >
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name || "User"}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/10 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 ring-2 ring-primary/10">
                  {(user.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className="min-w-0 flex-1 overflow-hidden transition-[max-width,opacity,margin] duration-200"
                style={{
                  maxWidth: collapsed ? 0 : 140,
                  opacity: collapsed ? 0 : 1,
                  marginLeft: collapsed ? 0 : 10,
                  transitionTimingFunction: EASE,
                }}
              >
                <p className="text-sm font-semibold leading-tight text-foreground truncate">
                  {user.name || "User"}
                </p>
                {(user.faculty || user.year) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[user.faculty, user.year].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div
                className="overflow-hidden transition-[max-width,opacity] duration-200"
                style={{
                  maxWidth: collapsed ? 0 : 16,
                  opacity: collapsed ? 0 : 0.4,
                  transitionTimingFunction: EASE,
                }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            </Link>
          )}
        </div>
      </aside>

      {/* Spacer — collapsed width so main content doesn't shift on hover */}
      <div className="hidden lg:block flex-shrink-0 w-[72px]" />
    </>
  );
}
