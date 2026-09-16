/**
 * personas.ts — every fixed identity the seed creates, in one place.
 *
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * REFAC-07 clause 1 of 3: "fixed UUIDs". Every id below is a literal. Nothing
 * here is generated, looked up, or derived from a counter, so a spec can
 * navigate to `/events/<id>` and be certain which row it landed on.
 *
 * THIS MODULE IS THE SINGLE DEFINITION OF PERSONA IDENTITY.
 *   `scripts/seed/load.ts` creates these accounts and rows; `e2e/auth.setup.ts`
 *   signs in with these same credentials. Neither re-declares an email, a
 *   password or an id. If the two ever disagree the harness fails loudly at
 *   setup rather than quietly testing the wrong user.
 *
 * THE KEYS COME FROM THE AUDIT, NOT FROM THIS PLAN.
 *   `.planning/audit/inventory/classification-rules.md § 2` defines a
 *   thirteen-persona taxonomy. Ten of them are seeded here under the audit's own
 *   keys, so Phase 7's certification matrix inherits this vocabulary instead of
 *   inventing a second one. Three are deliberately absent:
 *
 *     - `anonymous`            — has no account by definition; it is the absence
 *                                of a storage state, and the anonymous specs
 *                                simply declare none.
 *     - `non_mcgill_signin`    — an AUTH-FLOW case, not a data case. McGill
 *                                enforcement lives in `/auth/callback`, which
 *                                personas authenticated by cookie injection
 *                                never traverse. It is characterized by plan
 *                                03-02's unit suite and by nothing here.
 *     - `machine_no_credential` — the absence of a bearer secret. There is no
 *                                row that represents "no row".
 *
 *   These three are listed rather than omitted so a later reader does not have
 *   to work out whether their absence was a decision or an oversight.
 *
 * EVERY ADDRESS SATISFIES THE PRODUCT'S OWN RULE.
 *   `isMcGillEmail()` in `src/lib/utils.ts` is `/^[^@]+@(mail\.)?mcgill\.ca$/i`.
 *   All ten addresses below are `@mail.mcgill.ca`, so a persona that somehow did
 *   reach the callback would not be rejected by it, and no seeded address can be
 *   mistaken for a real McGill person's.
 *
 * THE PASSWORD IS LOUDLY LOCAL-ONLY.
 *   One shared literal, spelled so that it cannot be read as anything but
 *   fixture material, at `supabase/config.toml`'s `minimum_password_length = 6`
 *   or above. It unlocks ten synthetic accounts on a database that exists only
 *   inside a container on this machine. The guard in `./guard.ts` is what keeps
 *   that true.
 */

import { EventTag, type UserRole } from "../../src/types";
import { days, elapsed, iso, PINNED_NOW, upcoming } from "./clock";

/** Fixture material. Never a credential for anything that outlives a reset. */
export const SEED_PASSWORD = "seed-local-only-pw";

/** The audit's persona keys, in the order the setup project signs them in. */
export const PERSONA_KEYS = [
  "onboarded_student",
  "mid_onboarding_student",
  "club_member",
  "club_owner",
  "multi_club_organizer",
  "cross_club_attacker",
  "admin",
  "banned_permanent",
  "suspended_active",
  "suspension_expired",
] as const;

export type PersonaKey = (typeof PERSONA_KEYS)[number];

/**
 * Every fixed id in the seed. Literal, version-4-shaped, and grouped by kind.
 *
 * THE `5eed…` PREFIX IS A RESERVED NAMESPACE, NOT DECORATION.
 *   The pgTAP suite in `supabase/tests/database/` already owns the
 *   `00000000-0000-4000-8000-…` block for its own fixtures, and plan 03-05's
 *   RLS file inserts users `…0001`/`…0002`/`…0003`, club `…00c1`, event
 *   `…00a1` and membership `…00b1` inside its transaction. Seeding the same
 *   literals made `supabase test db` die on a duplicate primary key before the
 *   RLS assertions could run — caught by running the suite, not by reading it.
 *
 *   So the seed moved rather than the tests: every id here begins `5eed`, which
 *   is both outside that block and readable as "seed" at a glance. Any row in a
 *   local database whose id starts `5eed` came from this loader and from nothing
 *   else, which is also what makes the purge step able to be exact.
 */
export const IDS = {
  // — users ————————————————————————————————————————————————————————————————
  onboarded_student: "5eed0000-0000-4000-8000-000000000001",
  mid_onboarding_student: "5eed0000-0000-4000-8000-000000000002",
  club_member: "5eed0000-0000-4000-8000-000000000003",
  club_owner: "5eed0000-0000-4000-8000-000000000004",
  multi_club_organizer: "5eed0000-0000-4000-8000-000000000005",
  cross_club_attacker: "5eed0000-0000-4000-8000-000000000006",
  admin: "5eed0000-0000-4000-8000-000000000007",
  banned_permanent: "5eed0000-0000-4000-8000-000000000008",
  suspended_active: "5eed0000-0000-4000-8000-000000000009",
  suspension_expired: "5eed0000-0000-4000-8000-00000000000a",

  // — clubs —————————————————————————————————————————————————————————————————
  approvedClub: "5eed0000-0000-4000-8000-0000000000c1",
  secondApprovedClub: "5eed0000-0000-4000-8000-0000000000c2",
  otherClub: "5eed0000-0000-4000-8000-0000000000c3",
  pendingClub: "5eed0000-0000-4000-8000-0000000000c4",
  rejectedClub: "5eed0000-0000-4000-8000-0000000000c5",

  // — events ————————————————————————————————————————————————————————————————
  approvedEvent: "5eed0000-0000-4000-8000-0000000000e1",
  secondApprovedEvent: "5eed0000-0000-4000-8000-0000000000e2",
  pendingEvent: "5eed0000-0000-4000-8000-0000000000e3",
  rejectedEvent: "5eed0000-0000-4000-8000-0000000000e4",
  suspendedEvent: "5eed0000-0000-4000-8000-0000000000e5",

  // — join rows —————————————————————————————————————————————————————————————
  memberOfApproved: "5eed0000-0000-4000-8000-0000000000b1",
  ownerOfApproved: "5eed0000-0000-4000-8000-0000000000b2",
  organizerOfApproved: "5eed0000-0000-4000-8000-0000000000b3",
  organizerOfSecond: "5eed0000-0000-4000-8000-0000000000b4",
  attackerOfOther: "5eed0000-0000-4000-8000-0000000000b5",
  ownerOfPending: "5eed0000-0000-4000-8000-0000000000b6",
  rsvpGoing: "5eed0000-0000-4000-8000-0000000000d1",
  rsvpCancelled: "5eed0000-0000-4000-8000-0000000000d2",
} as const;

export interface SeedPersona {
  readonly key: PersonaKey;
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly roles: UserRole[];
  readonly onboarding_completed: boolean;
  readonly interest_tags: string[];
  readonly banned_at: string | null;
  readonly ban_expires_at: string | null;
  readonly ban_reason: string | null;
  readonly year: string;
  readonly faculty: string;
}

/**
 * The ten seeded personas.
 *
 * BAN STATE is the axis REFAC-07 names and the axis Phase 2 could not assert.
 * `src/proxy.ts` treats a user as banned when `banned_at` is set AND either
 * `ban_expires_at` is null or is still in the future, so the four states below
 * are the complete truth table for that expression:
 *
 *   not banned         banned_at null                           → passes
 *   banned_permanent   banned_at set, expiry null               → redirected
 *   suspended_active   banned_at set, expiry on HORIZON_FUTURE  → redirected
 *   suspension_expired banned_at set, expiry on HORIZON_PAST    → passes
 *
 * The two expiries sit on the HORIZONS rather than near the pinned now, because
 * the proxy compares them to the WALL clock. See the note in `clock.ts`: taken
 * from the pinned instant, the "active" suspension expired in real time and the
 * persona walked past the ban ring. That is the bug this row exists to catch.
 *
 * The last row is the interesting one: it is a user who LOOKS banned in the
 * table and must not be treated as banned by the ring.
 */
export const PERSONAS: readonly SeedPersona[] = [
  {
    key: "onboarded_student",
    id: IDS.onboarded_student,
    email: "seed.student@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Onboarded Student",
    roles: ["user"],
    onboarding_completed: true,
    interest_tags: [EventTag.ACADEMIC, EventTag.TECH],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "U2",
    faculty: "Science",
  },
  {
    key: "mid_onboarding_student",
    id: IDS.mid_onboarding_student,
    email: "seed.midonboarding@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Mid Onboarding Student",
    roles: ["user"],
    // The whole point of this persona: the guard path in src/proxy.ts. Its
    // storage state carries the `needs_onboarding` cookie as well as a session.
    onboarding_completed: false,
    interest_tags: [],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "U0",
    faculty: "Arts",
  },
  {
    key: "club_member",
    id: IDS.club_member,
    email: "seed.clubmember@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Club Member",
    roles: ["user"],
    onboarding_completed: true,
    interest_tags: [EventTag.SOCIAL],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "U1",
    faculty: "Engineering",
  },
  {
    key: "club_owner",
    id: IDS.club_owner,
    email: "seed.clubowner@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Club Owner",
    roles: ["user", "club_organizer"],
    onboarding_completed: true,
    interest_tags: [EventTag.CAREER],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "U3",
    faculty: "Management",
  },
  {
    key: "multi_club_organizer",
    id: IDS.multi_club_organizer,
    email: "seed.multiclub@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Multi Club Organizer",
    roles: ["user", "club_organizer"],
    onboarding_completed: true,
    interest_tags: [EventTag.MUSIC, EventTag.ARTS],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "U4",
    faculty: "Arts",
  },
  {
    key: "cross_club_attacker",
    id: IDS.cross_club_attacker,
    email: "seed.crossclub@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Cross Club Attacker",
    roles: ["user", "club_organizer"],
    onboarding_completed: true,
    interest_tags: [EventTag.SPORTS],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "U2",
    faculty: "Law",
  },
  {
    key: "admin",
    id: IDS.admin,
    email: "seed.admin@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Admin",
    roles: ["user", "admin"],
    onboarding_completed: true,
    interest_tags: [EventTag.NETWORKING],
    banned_at: null,
    ban_expires_at: null,
    ban_reason: null,
    year: "Graduate",
    faculty: "Science",
  },
  {
    key: "banned_permanent",
    id: IDS.banned_permanent,
    email: "seed.banned@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Banned Permanent",
    roles: ["user"],
    onboarding_completed: true,
    interest_tags: [],
    banned_at: iso(days(-30)),
    ban_expires_at: null,
    ban_reason: "Seeded permanent ban — fixture for the ban-enforcement ring.",
    year: "U2",
    faculty: "Science",
  },
  {
    key: "suspended_active",
    id: IDS.suspended_active,
    email: "seed.suspended@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Suspended Active",
    roles: ["user"],
    onboarding_completed: true,
    interest_tags: [],
    banned_at: iso(days(-3)),
    ban_expires_at: iso(upcoming(0)),
    ban_reason:
      "Seeded active suspension — expiry sits on HORIZON_FUTURE, so it is still " +
      "active whenever anyone runs this.",
    year: "U1",
    faculty: "Education",
  },
  {
    key: "suspension_expired",
    id: IDS.suspension_expired,
    email: "seed.unsuspended@mail.mcgill.ca",
    password: SEED_PASSWORD,
    name: "Seed Suspension Expired",
    roles: ["user"],
    onboarding_completed: true,
    interest_tags: [EventTag.FOOD],
    banned_at: iso(days(-14)),
    ban_expires_at: iso(elapsed(0)),
    ban_reason:
      "Seeded expired suspension — expiry sits on HORIZON_PAST. Looks banned in " +
      "the table; must NOT be treated as banned by the ring.",
    year: "U3",
    faculty: "Science",
  },
];

/** `{ persona key → { email, password } }`, consumed verbatim by the harness. */
export const PERSONA_CREDENTIALS: Record<
  PersonaKey,
  { email: string; password: string }
> = Object.fromEntries(
  PERSONAS.map((p) => [p.key, { email: p.email, password: p.password }])
) as Record<PersonaKey, { email: string; password: string }>;

export interface SeedClub {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  /** `clubs.status` is free text in the schema; these are the three it uses. */
  readonly status: "pending" | "approved" | "rejected";
  readonly created_by: string;
  readonly category: string;
  readonly description: string;
}

/** Three club statuses, five clubs — the axis REFAC-07 names explicitly. */
export const CLUBS: readonly SeedClub[] = [
  {
    key: "approvedClub",
    id: IDS.approvedClub,
    name: "Seed Approved Club",
    status: "approved",
    created_by: IDS.club_owner,
    category: "academic",
    description: "The approved club every club-scoped persona acts on.",
  },
  {
    key: "secondApprovedClub",
    id: IDS.secondApprovedClub,
    name: "Seed Second Approved Club",
    status: "approved",
    created_by: IDS.multi_club_organizer,
    category: "music",
    description: "The second club that makes multi_club_organizer meaningful.",
  },
  {
    key: "otherClub",
    id: IDS.otherClub,
    name: "Seed Other Club",
    status: "approved",
    created_by: IDS.cross_club_attacker,
    category: "sports",
    description:
      "A club the cross-club attacker belongs to and the approved club's owner does not.",
  },
  {
    key: "pendingClub",
    id: IDS.pendingClub,
    name: "Seed Pending Club",
    status: "pending",
    created_by: IDS.club_owner,
    category: "cultural",
    description: "Awaiting moderation — the row the admin queue spec looks for.",
  },
  {
    key: "rejectedClub",
    id: IDS.rejectedClub,
    name: "Seed Rejected Club",
    status: "rejected",
    created_by: IDS.club_owner,
    category: "social",
    description: "Rejected by moderation — the third club status.",
  },
];

export interface SeedMembership {
  readonly id: string;
  readonly club_id: string;
  readonly user_id: string;
  /**
   * `club_members_role_check` permits ONLY 'owner' and 'organizer'. There is no
   * 'member' value in this schema — the taxonomy's `club_member` persona is a
   * non-owning member, which this database spells 'organizer'.
   */
  readonly role: "owner" | "organizer";
}

export const MEMBERSHIPS: readonly SeedMembership[] = [
  {
    id: IDS.ownerOfApproved,
    club_id: IDS.approvedClub,
    user_id: IDS.club_owner,
    role: "owner",
  },
  {
    id: IDS.memberOfApproved,
    club_id: IDS.approvedClub,
    user_id: IDS.club_member,
    role: "organizer",
  },
  {
    id: IDS.organizerOfApproved,
    club_id: IDS.approvedClub,
    user_id: IDS.multi_club_organizer,
    role: "owner",
  },
  {
    id: IDS.organizerOfSecond,
    club_id: IDS.secondApprovedClub,
    user_id: IDS.multi_club_organizer,
    role: "owner",
  },
  {
    id: IDS.attackerOfOther,
    club_id: IDS.otherClub,
    user_id: IDS.cross_club_attacker,
    role: "owner",
  },
  {
    id: IDS.ownerOfPending,
    club_id: IDS.pendingClub,
    user_id: IDS.club_owner,
    role: "owner",
  },
];

export interface SeedEvent {
  readonly key: string;
  readonly id: string;
  readonly title: string;
  /** All four values `events_status_check` permits. */
  readonly status: "pending" | "approved" | "rejected" | "suspended";
  readonly club_id: string;
  readonly created_by: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly tags: string[];
  readonly location: string;
  readonly description: string;
  readonly is_free: boolean;
}

/**
 * Five events, all owned by the approved club so the club-scoped personas have
 * something to act on. Every `events_status_check` value is represented: the
 * plan names three statuses, the schema permits four, and seeding the fourth
 * costs one row and closes the gap rather than describing it.
 *
 * Dates come from `upcoming()`, not from `PINNED_NOW ± offset`. That is not a
 * stylistic choice — see the horizon note in `clock.ts`. `/api/events` filters
 * `start_date >= now()` against the WALL clock, so an offset taken from a pinned
 * instant in the past would silently empty the feed the day real time passed it.
 */
export const EVENTS: readonly SeedEvent[] = [
  {
    key: "approvedEvent",
    id: IDS.approvedEvent,
    title: "Seed Approved Event",
    status: "approved",
    club_id: IDS.approvedClub,
    created_by: IDS.club_owner,
    start_date: iso(upcoming(7, 2)),
    end_date: iso(upcoming(7, 5)),
    tags: [EventTag.ACADEMIC, EventTag.TECH],
    location: "Leacock 132",
    description: "The approved event the save and RSVP spec acts on.",
    is_free: true,
  },
  {
    key: "secondApprovedEvent",
    id: IDS.secondApprovedEvent,
    title: "Seed Approved Music Night",
    status: "approved",
    club_id: IDS.approvedClub,
    created_by: IDS.club_owner,
    start_date: iso(upcoming(14, 4)),
    end_date: iso(upcoming(14, 7)),
    tags: [EventTag.MUSIC, EventTag.SOCIAL],
    location: "Gerts Bar",
    description: "A second approved event, so search and filter have two rows to separate.",
    is_free: false,
  },
  {
    key: "pendingEvent",
    id: IDS.pendingEvent,
    title: "Seed Pending Event",
    status: "pending",
    club_id: IDS.approvedClub,
    created_by: IDS.club_owner,
    start_date: iso(upcoming(10, 2)),
    end_date: iso(upcoming(10, 4)),
    tags: [EventTag.CAREER],
    location: "Bronfman 151",
    description: "Awaiting moderation — the row the admin queue spec looks for.",
    is_free: true,
  },
  {
    key: "rejectedEvent",
    id: IDS.rejectedEvent,
    title: "Seed Rejected Event",
    status: "rejected",
    club_id: IDS.approvedClub,
    created_by: IDS.club_owner,
    start_date: iso(upcoming(12, 2)),
    end_date: iso(upcoming(12, 4)),
    tags: [EventTag.SOCIAL],
    location: "Redpath Hall",
    description: "Rejected by moderation — must never appear in a public feed.",
    is_free: true,
  },
  {
    key: "suspendedEvent",
    id: IDS.suspendedEvent,
    title: "Seed Suspended Event",
    status: "suspended",
    club_id: IDS.approvedClub,
    created_by: IDS.club_owner,
    start_date: iso(upcoming(9, 2)),
    end_date: iso(upcoming(9, 4)),
    tags: [EventTag.WELLNESS],
    location: "Currie Gym",
    description: "The fourth status events_status_check permits.",
    is_free: true,
  },
];

export interface SeedRsvp {
  readonly id: string;
  readonly user_id: string;
  readonly event_id: string;
  readonly status: "going" | "interested" | "cancelled";
}

/**
 * Two RSVPs, deliberately NOT for `onboarded_student` — the save-and-RSVP spec
 * creates that one itself, and a pre-seeded row would make the spec green
 * before it clicked anything.
 */
export const RSVPS: readonly SeedRsvp[] = [
  {
    id: IDS.rsvpGoing,
    user_id: IDS.club_member,
    event_id: IDS.approvedEvent,
    status: "going",
  },
  {
    id: IDS.rsvpCancelled,
    user_id: IDS.club_member,
    event_id: IDS.secondApprovedEvent,
    status: "cancelled",
  },
];

/**
 * `saved_events` IS DELIBERATELY NOT SEEDED, AND THE REASON IS WORTH READING.
 *
 * The determinism proof caught this rather than a review: `saved_events` carries
 * an AFTER INSERT trigger (`saved_events_count_trigger`) that UPDATEs
 * `public.users.saved_events_count`, and `public.users` carries a BEFORE UPDATE
 * trigger (`update_users_updated_at`) that sets `updated_at = now()`
 * unconditionally. So inserting a saved-event row after the users rows re-stamps
 * one user's `updated_at` with wall-clock time, and two loads produce two
 * different values. It cannot be re-pinned afterwards — every UPDATE that would
 * fix it fires the same trigger again — and the row cannot be inserted before
 * the users row it references.
 *
 * There are only two honest resolutions: stop dumping `users.updated_at`, or
 * stop seeding a row that unpins it. Dropping the column from the proof would
 * make the proof weaker exactly where it is load-bearing, so the row goes.
 *
 * Nothing is lost in coverage. `saved_events` is not one of the four axes
 * REFAC-07 names, and the save-and-RSVP spec creates a save at run time — which
 * is the behaviour that actually needs asserting. The loader still PURGES
 * `saved_events` for every seeded persona, so a save a spec made cannot leak
 * into the next run.
 */
export const SAVED_EVENTS: readonly { id: string; user_id: string; event_id: string }[] =
  [];

/** Every id the loader owns, so its purge step can be exact rather than broad. */
export const SEEDED_USER_IDS = PERSONAS.map((p) => p.id);
/** GoTrue's unique key on accounts. The purge needs it as well as the ids. */
export const SEEDED_EMAILS = PERSONAS.map((p) => p.email);
export const SEEDED_CLUB_IDS = CLUBS.map((c) => c.id);
export const SEEDED_EVENT_IDS = EVENTS.map((e) => e.id);

/** The instant every seeded `created_at` / `updated_at` is stamped with. */
export const SEED_STAMP = iso(PINNED_NOW);
