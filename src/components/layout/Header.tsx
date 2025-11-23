"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/SignInButton";
import { Menu, X } from "lucide-react";
import { guestNavItems, authenticatedNavItems } from "./navItems";
import { cn } from "@/lib/utils";

// (no local mock here) useUser provides auth state
// const MOCK_USER: { name?: string; email?: string } | null = { name: "John Doe", email: "john@mcgill.ca" };

export function Header() {
  const { user, loading } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isAuthenticated = !!user;
  // const isAuthenticated = !!MOCK_USER
  const navItems = isAuthenticated ? authenticatedNavItems : guestNavItems;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between h-16 px-4">
          {/* Left: Burger Menu (Mobile Only) + Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-primary/10 transition-colors text-gray-700 hover:text-primary"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* Title - left-aligned, next to burger on mobile */}
            <Link
              href="/"
              className="text-lg md:text-xl font-bold text-primary"
            >
              UNI-VERSE
            </Link>
          </div>

          {/* Right: Sign In with McGill (always visible) */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
            ) : isAuthenticated ? (
              <button
                onClick={() => console.log("Sign out clicked")}
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <SignInButton />
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown (Mobile Only) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <nav className="container px-4 py-4 grid grid-cols-4 gap-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg transition-all",
                      isActive
                        ? "bg-primary text-white"
                        : "text-gray-700 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Icon className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 top-16"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}