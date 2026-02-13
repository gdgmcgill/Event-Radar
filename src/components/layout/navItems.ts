import {
  Home,
  Search,
  Calendar,
  Tag,
  Bookmark,
  Bell,
  Plus,
  Info,
  User,
  LayoutDashboard,
  FileQuestion,
  List,
  Users,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

export const guestNavItems: NavItem[] = [
  { name: "Home", path: "/", icon: Home },
  { name: "Search", path: "/search", icon: Search },
  { name: "Calendar", path: "/calendar", icon: Calendar },
  { name: "Categories", path: "/categories", icon: Tag },
  { name: "About", path: "/about", icon: Info },
];

export const authenticatedNavItems: NavItem[] = [
  { name: "Profile", path: "/profile", icon: User },
  { name: "Home", path: "/", icon: Home },
  { name: "Search", path: "/search", icon: Search },
  { name: "Calendar", path: "/calendar", icon: Calendar },
  { name: "Categories", path: "/categories", icon: Tag },
  { name: "My Events", path: "/my-events", icon: Bookmark },
  { name: "Create Event", path: "/create-event", icon: Plus },
  { name: "Notifications", path: "/notifications", icon: Bell },
];

export const adminNavItems: NavItem[] = [
  { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { name: "Pending", path: "/admin/pending", icon: FileQuestion },
  { name: "All Events", path: "/admin/events", icon: List },
  { name: "Users", path: "/admin/users", icon: Users },
  { name: "Clubs", path: "/admin/clubs", icon: Building2 },
];