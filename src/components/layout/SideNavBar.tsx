"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { guestNavItems, authenticatedNavItems, adminNavItems } from "./navItems";
import { useAuthStore } from "@/store/useAuthStore";

export function SideNavBar() {
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAuthenticated = !!user;

  const navItems = isAuthenticated ? authenticatedNavItems : guestNavItems;

  return (
    <>
      {/* Desktop Side Navigation Bar - HIDDEN ON MOBILE */}
      <div
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 h-full bg-card transition-all duration-300 ease-out z-40 shadow-sm",
          isHovered ? "w-64" : "w-20"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col h-full">
          {/* User Info - Top (only shown when authenticated) */}
          {isAuthenticated && (
            <div className="p-3 pt-2 pb-0">
              <Link
                href="/profile"
                className={cn(
                  "flex items-center p-2 rounded-lg transition-colors hover:bg-muted",
                  pathname === "/profile" && "bg-primary/10"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0",
                    !isHovered && "mx-auto"
                  )}
                >
                  <User className="w-5 h-5 text-primary" />
                </div>
                {isHovered && (
                  <div className="ml-3 flex-1 min-w-0 animate-in fade-in duration-300">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                )}
              </Link>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="flex-1 px-3 space-y-1 py-4">
            {navItems.filter((item) => item.path !== "/profile").map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center px-3 py-3 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 flex-shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                      isHovered ? "mr-3" : "mx-auto"
                    )}
                  />
                  <span
                    className={cn(
                      "whitespace-nowrap overflow-hidden transition-all duration-300",
                      isHovered ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Admin Nav Items */}
            {user?.roles?.includes("admin") && (
              <>
                <div className="pt-4 pb-1">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 transition-all duration-300",
                      isHovered ? "opacity-100" : "opacity-0"
                    )}
                  >
                    Admin
                  </span>
                </div>
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={cn(
                        "flex items-center px-3 py-3 rounded-xl transition-all duration-200 group",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5 flex-shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                          isHovered ? "mr-3" : "mx-auto"
                        )}
                      />
                      <span
                        className={cn(
                          "whitespace-nowrap overflow-hidden transition-all duration-300",
                          isHovered ? "opacity-100 w-auto" : "opacity-0 w-0"
                        )}
                      >
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Spacer to push content */}
      <div
        className={cn(
          "hidden lg:block transition-all duration-300 flex-shrink-0",
          isHovered ? "w-64" : "w-20"
        )}
      />
    </>
  );
}