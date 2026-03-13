"use client";

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
  const isClubs = pathname === "/clubs";
  const isAbout = pathname === "/about";
  const isFriends = pathname === "/friends";

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
        {/* Desktop top-right sign-in for guests */}
        {!isAuthenticated && (
          <div className="hidden lg:flex absolute top-5 right-6 z-50">
            <SignInButton variant="default" />
          </div>
        )}
        <main
          id="main-content"
          className={isHomepage || isEventDetail || isClubs || isAbout || isFriends ? "flex-1" : "flex-1 p-6"}
        >
          {children}
        </main>
        {!isHomepage && !isEventDetail && <Footer />}
      </div>
    </div>
  );
}
