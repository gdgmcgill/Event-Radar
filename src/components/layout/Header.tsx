"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { SignInButton } from "@/components/auth/SignInButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Menu, X, PlusCircle } from "lucide-react";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import {
  guestNavItems,
  baseNavItems,
  organizerNavItems,
  adminNavItems,
  type NavItem,
} from "./navItems";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/lib/roles";

function MobileNavLink({
  item,
  pathname,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.path;

  return (
    <Link
      href={item.path}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
        isActive
          ? "bg-primary text-white font-semibold shadow-md shadow-primary/10"
          : "text-slate-600 dark:text-slate-400 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm">{item.name}</span>
    </Link>
  );
}

function MobileNavSection({
  items,
  label,
  pathname,
  onClose,
}: {
  items: NavItem[];
  label?: string;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <>
      {label && (
        <div className="border-t border-slate-200/60 dark:border-border/40 mt-2 pt-4 pb-1 px-4">
          <span className="text-[11px] font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-widest">
            {label}
          </span>
        </div>
      )}
      {items.map((item) => (
        <MobileNavLink
          key={item.path}
          item={item}
          pathname={pathname}
          onClose={onClose}
        />
      ))}
    </>
  );
}

export function Header() {
  const { user, loading, hasClubs } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isAuthenticated = !!user;

  const navItems = isAuthenticated
    ? baseNavItems.filter(
        (item) =>
          item.path !== "/profile" &&
          item.path !== "/create-event" &&
          item.path !== "/notifications"
      )
    : guestNavItems;
  const showOrganizer = isAuthenticated && hasClubs;
  const showAdmin = isAuthenticated && user && isAdmin(user);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-border/40 bg-white/90 dark:bg-card/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Left: Burger + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "p-2 rounded-xl transition-all duration-200",
                isMobileMenuOpen
                  ? "bg-primary text-white shadow-md shadow-primary/10"
                  : "text-slate-600 dark:text-slate-400 hover:bg-primary/5 hover:text-primary"
              )}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <Link
              href="/"
              className="flex items-center gap-3 transition-opacity hover:opacity-90"
            >
              <Image
                src="/uni-verse_logo.png"
                alt="Uni-Verse"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <div>
                <h1 className="text-base font-black uppercase tracking-widest text-slate-900 dark:text-foreground leading-none">
                  UNI-VERSE
                </h1>
                <p className="text-[9px] font-medium text-slate-400 dark:text-muted-foreground uppercase tracking-widest mt-0.5">
                  McGill University
                </p>
              </div>
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {loading ? (
              <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
            ) : isAuthenticated ? (
              <>
                <NotificationBell />
                <ThemeToggle />
                <SignOutButton compact title="Sign out" />
              </>
            ) : (
              <>
                <ThemeToggle />
                <SignInButton variant="default" />
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="border-t border-slate-200/60 dark:border-border/40 bg-white/95 dark:bg-card/95 backdrop-blur-2xl">
            <nav
              id="mobile-nav"
              aria-label="Mobile navigation"
              className="flex flex-col gap-1 px-3 py-4 max-h-[calc(100vh-4rem)] overflow-y-auto"
            >
              <MobileNavSection
                items={navItems}
                pathname={pathname}
                onClose={closeMobileMenu}
              />

              {showOrganizer && (
                <MobileNavSection
                  items={organizerNavItems}
                  label="Organizer"
                  pathname={pathname}
                  onClose={closeMobileMenu}
                />
              )}

              {showAdmin && (
                <MobileNavSection
                  items={adminNavItems}
                  label="Moderation"
                  pathname={pathname}
                  onClose={closeMobileMenu}
                />
              )}

              {/* Create Event + Profile — matching sidebar bottom section */}
              {isAuthenticated && (
                <div className="border-t border-slate-200/60 dark:border-border/40 mt-2 pt-4 space-y-2">
                  <Link
                    href="/create-event"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 px-4 hover:brightness-110 shadow-lg shadow-primary/20"
                  >
                    <PlusCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">Create Event</span>
                  </Link>

                  {user && (
                    <Link
                      href="/profile"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/5 transition-colors"
                    >
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={user.name || "User"}
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/10"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm ring-2 ring-primary/10">
                          {(user.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-none text-slate-900 dark:text-foreground truncate">
                          {user.name || "User"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground truncate mt-0.5">
                          {user.year || user.email}
                        </p>
                      </div>
                    </Link>
                  )}

                  <SignOutButton variant="outline" className="w-full rounded-xl" />
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 top-16"
          onClick={closeMobileMenu}
        />
      )}
    </>
  );
}
