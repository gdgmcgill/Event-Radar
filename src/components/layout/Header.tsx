"use client";

/**
 * Main navigation header component
 * TODO: Implement responsive mobile menu, active link highlighting, and user menu
 */

import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/SignInButton";
import { Menu, Calendar, User, LogOut } from "lucide-react";

export function Header() {
  const { user, loading } = useUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Calendar className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Uni-Verse</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Events
          </Link>
          {user && (
            <Link
              href="/my-events"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              My Events
            </Link>
          )}
          {/* TODO: Add admin link if user is admin */}
        </nav>

        {/* Auth Section */}
        <div className="flex items-center space-x-4">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <div className="flex items-center space-x-4">
              {/* TODO: Add user menu dropdown */}
              <span className="hidden md:inline text-sm text-muted-foreground">
                {user.full_name || user.email}
              </span>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <SignInButton />
          )}

          {/* Mobile Menu Button */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* TODO: Add mobile menu drawer/sheet */}
    </header>
  );
}




