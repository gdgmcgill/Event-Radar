import type { User, UserRole } from "@/types";

export const hasRole = (user: User, role: UserRole): boolean =>
  user.roles.includes(role);

export const isAdmin = (user: User): boolean => hasRole(user, "admin");

export const isOrganizer = (user: User): boolean =>
  hasRole(user, "club_organizer");
