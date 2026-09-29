"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { SignInButton } from "@/components/auth/SignInButton";
import { Footer } from "./Footer";
import ThemeToggle from "./ThemeToggle";
import { productNavigation, secondaryAction, shellBoundary } from "./productNavigation";

export function EditorialShell({
  children,
  preview,
}: {
  children: React.ReactNode;
  preview: boolean;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const links = productNavigation.filter(
    (item) => item.audience === "public" || user
  );
  const renderLinks = () =>
    links.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={pathname === item.href ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted ${pathname === item.href ? "text-primary" : "text-muted-foreground"}`}
      >
        {item.label}
      </Link>
    ));
  return (
    <div className="min-h-screen" data-shell={shellBoundary(pathname)}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      {preview && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
          Admin preview · Discovery is not enabled for the public.
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/discover"
            onClick={() => setOpen(false)}
            className="shrink-0 text-lg font-black tracking-[-0.06em] sm:text-xl"
          >
            UNI<span className="text-primary">—</span>VERSE
            <span className="text-primary">.</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {renderLinks()}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={secondaryAction.href}
              className="hidden items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted md:inline-flex"
            >
              {secondaryAction.label}
            </Link>
            <ThemeToggle />
            {!user && <SignInButton variant="default" compact />}
            {user?.roles?.includes("admin") && (
              <Link
                className="hidden items-center gap-1 text-xs font-medium md:flex"
                href="/moderation/opportunities"
              >
                Curate <ArrowUpRight size={14} />
              </Link>
            )}
            <button
              type="button"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="mobile-product-nav"
              onClick={() => setOpen(!open)}
              className="rounded-md p-2 hover:bg-muted md:hidden"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-product-nav"
            aria-label="Mobile navigation"
            className="flex flex-col border-t border-border px-4 py-3 md:hidden"
          >
            {renderLinks()}
            <Link
              href={secondaryAction.href}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium"
            >
              {secondaryAction.label}
            </Link>
            {user?.roles?.includes("admin") && (
              <Link
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm"
                href="/moderation/opportunities"
              >
                Curate opportunities
              </Link>
            )}
          </nav>
        )}
      </header>
      <main id="main-content" className="min-w-0">
        {children}
      </main>
      <Footer />
    </div>
  );
}
