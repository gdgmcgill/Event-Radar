import {
  Home,
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
  ClipboardList,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

/** Visible to unauthenticated visitors */
export const guestNavItems: NavItem[] = [
  { name: "Home", path: "/", icon: Home },
  { name: "Calendar", path: "/calendar", icon: Calendar },
  { name: "Categories", path: "/categories", icon: Tag },
  { name: "About", path: "/about", icon: Info },
];

/** Visible to every authenticated user (replaces authenticatedNavItems) */
export const baseNavItems: NavItem[] = [
  { name: "Profile", path: "/profile", icon: User },
  { name: "Home", path: "/", icon: Home },
  { name: "Calendar", path: "/calendar", icon: Calendar },
  { name: "Categories", path: "/categories", icon: Tag },
  { name: "My Events", path: "/my-events", icon: Bookmark },
  { name: "Create Event", path: "/create-event", icon: Plus },
  { name: "Notifications", path: "/notifications", icon: Bell },
];

/** Extra items for club organizers */
export const organizerNavItems: NavItem[] = [
  { name: "My Clubs", path: "/my-clubs", icon: Building2 },
];

/** Extra items for admins — now under /moderation/* */
export const adminNavItems: NavItem[] = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
  { name: "Pending", path: "/moderation/pending", icon: FileQuestion },
  { name: "All Events", path: "/moderation/events", icon: List },
  { name: "Users", path: "/moderation/users", icon: Users },
  { name: "Organizer Requests", path: "/moderation/organizer-requests", icon: ClipboardList },
  { name: "Stats", path: "/moderation/stats", icon: BarChart3 },
];
