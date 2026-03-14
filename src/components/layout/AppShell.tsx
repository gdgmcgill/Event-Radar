"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SideNavBar } from "./SideNavBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { SignInButton } from "@/components/auth/SignInButton";
import { useAuthStore } from "@/store/useAuthStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAuthenticated = !!user;
  const isLanding = pathname === "/landing";
  const isModeration = pathname.startsWith("/moderation");
  const isHomepage = pathname === "/";
  const isEventDetail = /^\/events\/[^/]+$/.test(pathname);

  if (isLanding || isModeration) {
    return (
      <div className="flex min-h-screen">
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <SideNavBar />
      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        {/* Header is mobile-only — sidebar handles desktop nav */}
        <div className="lg:hidden">
          <Header />
        </div>
        {/* Desktop top-right quick access so profile stays visible on home */}
        <div className="hidden lg:flex absolute top-5 right-6 z-50">
          {isAuthenticated && user ? (
            <Link
              href="/profile"
              title="My Profile"
              className="flex items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-slate-300 transition-all duration-200 hover:ring-primary/50 dark:bg-slate-950 dark:ring-slate-700"
            >
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name || "Profile"}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full bg-white object-cover dark:bg-slate-950"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {(user.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <SignInButton variant="default" />
          )}
        </div>
        <main
          id="main-content"
          className={isHomepage || isEventDetail ? "flex-1" : "flex-1 p-6"}
        >
          {children}
        </main>
        {!isHomepage && !isEventDetail && <Footer />}
      </div>
    </div>
  );
}
