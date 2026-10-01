/** One definition for mobile and desktop. Only shipped destinations belong here. */
export const productNavigation = [
  { label: "Discover", href: "/discover", audience: "public" },
  { label: "Resources", href: "/resources", audience: "public" },
  { label: "For companies", href: "/for-companies", audience: "public" },
  { label: "Clubs", href: "/clubs", audience: "public" },
  { label: "About", href: "/about", audience: "public" },
  { label: "Saved", href: "/saved", audience: "account" },
  { label: "Profile", href: "/profile", audience: "account" },
] as const;

/** Rendered as an outlined button in `EditorialShell`, desktop and mobile.
 * `/submit` is the public submission form (P1-09). */
export const secondaryAction = { label: "Submit", href: "/submit" } as const;

export function shellBoundary(
  pathname: string
): "editorial" | "account" | "recruiter" | "moderation" {
  if (pathname.startsWith("/moderation")) return "moderation";
  if (pathname === "/recruiting" || pathname.startsWith("/recruiting/"))
    return "recruiter";
  if (
    [
      "/profile",
      "/saved",
      "/onboarding",
      "/calendar",
      "/my-events",
      "/notifications",
    ].includes(pathname)
  )
    return "account";
  return "editorial";
}
