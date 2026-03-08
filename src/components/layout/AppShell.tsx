"use client";

import { usePathname } from "next/navigation";
import { SideNavBar } from "./SideNavBar";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/landing";
  const isModeration = pathname.startsWith("/moderation");

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
        <Header />
        <main id="main-content" className="flex-1 p-6">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
