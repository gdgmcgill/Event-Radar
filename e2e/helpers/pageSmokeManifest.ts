import { IDS, type PersonaKey } from "../fixtures";
import { MISSING_ID } from "./authorizationProbes";
export interface PageSmoke {
  persona: PersonaKey;
  path?: string;
  finalPath?: string;
  anonymousPath?: string;
  anonymousSignIn?: boolean;
  fixture?: "experiment";
  text?: string;
  notFound?: boolean;
}
const admin: PageSmoke = { persona: "admin", anonymousPath: "/" };
const moderationAdmin: PageSmoke = { persona: "admin", anonymousPath: "/admin-login" };
const privatePage: PageSmoke = { persona: "onboarded_student", anonymousPath: "/", anonymousSignIn: true };
const publicPage: PageSmoke = { persona: "onboarded_student" };
/** Every live page is explicit, including historical inventory corrections. */
export const PAGE_SMOKES: Record<string, PageSmoke> = {
  "/": publicPage,
  "/about": publicPage,
  "/admin-login": publicPage,
  "/admin/experiments": admin,
  "/admin/experiments/[id]": { ...admin, path: `/admin/experiments/${MISSING_ID}`, fixture: "experiment", text: "M0 smoke experiment" },
  "/banned": { persona: "banned_permanent", anonymousPath: "/landing", text: "Account Suspended" },
  "/calendar": publicPage,
  "/clubs": publicPage,
  "/clubs/[id]": { ...publicPage, path: `/clubs/${IDS.approvedClub}`, text: "Seed Approved Club" },
  "/clubs/create": publicPage,
  "/contributors": publicPage,
  "/create-event": { ...privatePage, persona: "club_owner" },
  "/docs": admin,
  "/discover": { ...publicPage, notFound: true },
  "/saved": { ...publicPage, notFound: true },
  "/opportunities/[id]": { ...publicPage, path: `/opportunities/${MISSING_ID}`, notFound: true },
  "/moderation/opportunities": moderationAdmin,
  "/events/[id]": { ...publicPage, path: `/events/${IDS.approvedEvent}`, text: "Seed Approved Event" },
  "/feedback": publicPage,
  "/friends": privatePage,
  "/health": admin,
  "/help": publicPage,
  "/invites/[token]": { ...privatePage, path: `/invites/${MISSING_ID}`, text: "Invalid Invitation" },
  "/landing": publicPage,
  "/moderation": moderationAdmin,
  "/moderation/appeals": moderationAdmin,
  "/moderation/audit-log": moderationAdmin,
  "/moderation/clubs": moderationAdmin,
  "/moderation/events": moderationAdmin,
  "/moderation/featured": moderationAdmin,
  "/moderation/organizer-requests": moderationAdmin,
  "/moderation/organizers": moderationAdmin,
  "/moderation/pending": moderationAdmin,
  "/moderation/reports": moderationAdmin,
  "/moderation/stats": moderationAdmin,
  "/moderation/users": moderationAdmin,
  "/my-clubs": { ...privatePage, persona: "club_owner", finalPath: "/clubs" },
  "/my-clubs/[id]": { ...privatePage, persona: "club_owner", path: `/my-clubs/${IDS.approvedClub}` },
  "/my-events": privatePage,
  "/notifications": privatePage,
  "/onboarding": { persona: "mid_onboarding_student", anonymousPath: "/" },
  "/people": publicPage,
  "/privacy": publicPage,
  "/profile": privatePage,
  "/settings": { ...privatePage, finalPath: "/profile" },
  "/terms": publicPage,
  "/users/[id]": { ...publicPage, persona: "club_owner", path: `/users/${IDS.onboarded_student}`, text: "Event attendance is private" },
};
