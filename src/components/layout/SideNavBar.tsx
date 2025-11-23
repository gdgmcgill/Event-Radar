"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Calendar,
  Tag,
  Bookmark,
  Bell,
  User,
  LogOut,
  LogIn,
  Info,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock user - replace with actual auth later
const MOCK_USER: { name?: string; email?: string } | null = null;
// const MOCK_USER: { name?: string; email?: string } | null = { name: "John Doe", email: "john@mcgill.ca" };

export function SideNavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isAuthenticated = !!MOCK_USER;

  // Navigation items for guest users
  const guestNavItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Search", path: "/search", icon: Search },
    { name: "Calendar", path: "/calendar", icon: Calendar },
    { name: "Categories", path: "/categories", icon: Tag },
    { name: "About", path: "/about", icon: Info },
  ];

  // Navigation items for authenticated users
  const authenticatedNavItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Search", path: "/search", icon: Search },
    { name: "Calendar", path: "/calendar", icon: Calendar },
    { name: "Categories", path: "/categories", icon: Tag },
    { name: "My Events", path: "/my-events", icon: Bookmark },
    { name: "Create Event", path: "/create-event", icon: Plus },
    { name: "Notifications", path: "/notifications", icon: Bell },
  ];

  const navItems = isAuthenticated ? authenticatedNavItems : guestNavItems;

  return (
    <>
      {/* Desktop Side Navigation Bar - RIGHT SIDE, HIDDEN ON MOBILE */}
      <div className="hidden lg:block fixed top-0 right-0 h-full bg-white border-l border-gray-200 w-20 z-50 shadow-lg">
        <div className="flex flex-col h-full">
          {/* Navigation Items */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center px-4 py-3 mx-2 my-1 rounded-lg transition-all group relative",
                    isActive
                      ? "bg-primary text-white font-semibold"
                      : "text-gray-700 hover:bg-primary/10 hover:text-primary"
                  )}
                  title={item.name}
                >
                  <Icon className="w-5 h-5 mx-auto flex-shrink-0" />

                  {/* Tooltip on hover - appears on LEFT side */}
                  <div className="absolute right-full mr-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Section - Bottom */}
          <div className="border-t border-gray-200 p-4">
            {isAuthenticated ? (
              <button
                onClick={() => console.log("Sign out clicked")}
                className="w-full p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors group relative"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5 mx-auto" />

                {/* Tooltip */}
                <div className="absolute right-full mr-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 bottom-0 pointer-events-none">
                  Sign Out
                </div>
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="w-full p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors group relative"
                title="Sign In with McGill"
              >
                <LogIn className="w-5 h-5 mx-auto" />

                {/* Tooltip */}
                <div className="absolute right-full mr-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 bottom-0 pointer-events-none">
                  Sign In with McGill
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Spacer for desktop to prevent content from going under the navbar */}
      <div className="hidden lg:block w-20 flex-shrink-0" />
    </>
  );
}