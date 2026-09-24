import type { User, UserRole } from "@/types";

/**
 * The one role predicate. It reads `roles` and nothing else, so it accepts any
 * bearer of that property: a full `User`, or the request context's profile
 * slice (`hasRole(ctx.profile, "admin")`).
 */
export const hasRole = (user: Pick<User, "roles">, role: UserRole): boolean =>
  user.roles.includes(role);

export const isAdmin = (user: User): boolean => hasRole(user, "admin");

export const isOrganizer = (user: User): boolean =>
  hasRole(user, "club_organizer");
