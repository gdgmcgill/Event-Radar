"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { guestNavItems, authenticatedNavItems } from "./navItems";
import { useUser } from "@/hooks/useUser";

// useUser will provide real user state; leave a null mock for now

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
          "hidden lg:block fixed top-0 left-0 h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-50 shadow-lg",
          isHovered ? "w-64" : "w-20"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col h-full">
          {/* Navigation Items */}
          <nav className="flex-1 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center px-4 py-3 mx-2 my-1 rounded-lg transition-all",
                    isActive
                      ? "bg-primary text-white font-semibold"
                      : "text-gray-700 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 flex-shrink-0",
                      isHovered ? "mr-3" : "mx-auto"
                    )}
                  />
                  {isHovered && <span className="whitespace-nowrap">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Section - Bottom (only show logout if authenticated) */}
          {isAuthenticated && (
            <div className="border-t border-gray-200 p-4">
              {isHovered ? (
                <div className="space-y-3">
                  {/* User Info */}
                  <div className="px-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {user?.full_name || user?.email || "User"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user?.email || "user@mcgill.ca"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <button
                    onClick={() => console.log("Sign out clicked")}
                    className="w-full flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => console.log("Sign out clicked")}
                  className="w-full p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5 mx-auto" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spacer to prevent content from going under the navbar */}
      <div
        className={cn(
          "hidden lg:block transition-all duration-300 flex-shrink-0",
          isHovered ? "w-64" : "w-20"
        )}
      />
    </>
  );
}