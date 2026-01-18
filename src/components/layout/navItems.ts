import React from "react";
import {
  Home,
  Search,
  Calendar,
  Tag,
  Bookmark,
  Bell,
  Plus,
  Info,
} from "lucide-react";

export type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export const guestNavItems: NavItem[] = [
  { name: "Home", path: "/", icon: Home },
  { name: "Search", path: "/search", icon: Search },
  { name: "Calendar", path: "/calendar", icon: Calendar },
  { name: "Categories", path: "/categories", icon: Tag },
  { name: "About", path: "/about", icon: Info },
];

export const authenticatedNavItems: NavItem[] = [
  { name: "Home", path: "/", icon: Home },
  { name: "Search", path: "/search", icon: Search },
  { name: "Calendar", path: "/calendar", icon: Calendar },
  { name: "Categories", path: "/categories", icon: Tag },
  { name: "My Events", path: "/my-events", icon: Bookmark },
  { name: "Create Event", path: "/create-event", icon: Plus },
  { name: "Notifications", path: "/notifications", icon: Bell },
];

export default {
  guestNavItems,
  authenticatedNavItems,
};
