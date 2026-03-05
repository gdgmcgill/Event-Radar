# Domain Components — Cleanup Summary

Removed `console.error` from `SignInButton` and `SignOutButton`. Removed `console.warn` and unused imports (`Badge`, `Upload`, `X`) from `EditEventModal`. Tightened `any` to `unknown` in `InterestsCard` and `RedocUI`. All other components (`ClubDashboard`, `FollowButton`, `OrganizerRequestDialog`, `AvatarCropModal`, `NotificationBell`, `AuthProvider`) were audited and required no changes — rollbacks, URL revocation, polling cleanup, and subscription guards were already correct.
