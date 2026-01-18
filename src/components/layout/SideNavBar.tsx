"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { guestNavItems, authenticatedNavItems } from "./navItems";
import { useUser } from "@/hooks/useUser";

export function SideNavBar() {
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const isAuthenticated = !!user;

  const navItems = isAuthenticated ? authenticatedNavItems : guestNavItems;

  return (
    <>
      {/* Desktop Side Navigation Bar - HIDDEN ON MOBILE */}
      <div
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 h-full bg-card border-r border-border transition-all duration-300 ease-out z-40 pt-16 shadow-sm",
          isHovered ? "w-64" : "w-20"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col h-full py-6">
          {/* Navigation Items */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
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
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
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
          </nav>

          {/* User Section - Bottom */}
          {isAuthenticated && (
            <div className="p-3 mt-auto border-t border-border">
              {isHovered ? (
                <div className="space-y-4 px-1 animate-in fade-in duration-300">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.full_name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={() => console.log("Sign out clicked")}
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center" title={user?.email}>
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <button
                    onClick={() => console.log("Sign out clicked")}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div
        className={cn(
          "hidden lg:block transition-all duration-300 flex-shrink-0",
          isHovered ? "w-64" : "w-20"
        )}
      />
    </>
  );
}
