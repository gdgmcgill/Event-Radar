import {
  Home,
  Calendar,
  Bell,
  Plus,
  Info,
  User,
  LayoutDashboard,
  Users,
  Building2,
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
  { name: "Clubs", path: "/clubs", icon: Building2 },
  { name: "About", path: "/about", icon: Info },
];

/** Visible to every authenticated user (replaces authenticatedNavItems) */
export const baseNavItems: NavItem[] = [
  { name: "Profile", path: "/profile", icon: User },
  { name: "Home", path: "/", icon: Home },
  { name: "My Events", path: "/calendar", icon: Calendar },
  { name: "Clubs", path: "/clubs", icon: Building2 },
  { name: "Friends", path: "/friends", icon: Users },
  { name: "Create Event", path: "/create-event", icon: Plus },
  { name: "Notifications", path: "/notifications", icon: Bell },
];

/** Extra items for club organizers */
export const organizerNavItems: NavItem[] = [
  { name: "My Clubs", path: "/my-clubs", icon: Building2 },
];

/** Extra items for admins — only Dashboard; sub-pages use /moderation's own nav */
export const adminNavItems: NavItem[] = [
  { name: "Dashboard", path: "/moderation", icon: LayoutDashboard },
];
