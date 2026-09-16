/**
 * =============================================================================
 * load.ts — the deterministic functional seed loader (REFAC-07)
 * Phase 03-refactor-foundations-schema-truth-and-the-seam-kit · plan 03-07
 *
 * Usage: npx tsx scripts/seed/load.ts [--dump]
 *
 * METHOD CONTRACT — read this before running it
 *   * THIS TOOL WRITES. It is not an inspector. `scripts/platform-analytics.ts`
 *     is the repo's other script of this shape and it reads production by
 *     default; this one inverts that posture completely and refuses to.
 *   * IT IS DESTRUCTIVE, BY DESIGN. Before inserting anything it DELETES every
 *     row it owns — the ten persona accounts in `auth`, their `public.users`
 *     rows, the five seeded clubs, the five seeded events, and every join row
 *     belonging to a seeded user. That purge is what makes the loader
 *     re-runnable and what makes "load twice, get the same rows" true. If you
 *     created data by hand as a seeded persona, this will remove it.
 *   * IT REFUSES TO RUN ANYWHERE BUT THE LOCAL STACK. The first thing it does
 *     with a target is hand it to `assertSeedTargetAllowed()`, before any
 *     Supabase client exists. Local loopback on a Supabase port passes;
 *     production is refused by name; an unacknowledged staging target is
 *     refused; and a target it cannot check against production is refused
 *     fail-closed. See `scripts/seed/guard.ts` for the reasoning.
 *   * IT NEVER READS A CREDENTIAL FROM `.env.local`. The local service-role key
 *     comes from `supabase status -o env` at run time. `.env.local` is opened
 *     by the guard for one substring — the production project ref, used as a
 *     deny key — and never for a value, and never for writing.
 *   * IT NEVER PRINTS A KEY. Only row counts and ids reach stdout.
 *
 * `--dump` prints a canonical, sorted JSON view of every table the loader
 * writes and exits without touching anything. It is how the determinism proof
 * in `evidence/seed-determinism.txt` is taken: load, dump, load again, dump
 * again, compare the two hashes.
 *
 * WHY THERE IS NO `supabase/seed.sql`
 *   `[db.seed]` files execute INSIDE `supabase db reset`, before any process
 *   can call the admin API — and the seeded `public` rows reference accounts
 *   that only the admin API can create with fixed ids. A vendor seed file would
 *   also run on every reset, which would make this loader's determinism claim
 *   false. `config.toml` points `sql_paths` at a file that does not exist. That
 *   is deliberate; leave it that way.
 * =============================================================================
 */

import { execFileSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../src/lib/supabase/types";
import { PINNED_NOW, SEED_TIMEZONE, iso } from "./clock";
import { readSupabaseOverride } from "./envOverride";
import { assertSeedTargetAllowed } from "./guard";
import { prng, SEED } from "./prng";
import {
  CLUBS,
  EVENTS,
  MEMBERSHIPS,
  PERSONAS,
  RSVPS,
  SAVED_EVENTS,
  SEEDED_CLUB_IDS,
  SEEDED_EMAILS,
  SEEDED_EVENT_IDS,
  SEEDED_USER_IDS,
  SEED_STAMP,
} from "./personas";

type Admin = SupabaseClient<Database>;

/**
 * Resolves the LOCAL stack's URL and service-role key.
 *
 * Environment first (so CI can inject them), otherwise `supabase status -o env`.
 * `.env.local` is never consulted here: that file describes production.
 */
function resolveLocalCredentials(): { url: string | undefined; key: string } {
  // ALL THREE OR NONE — see scripts/seed/envOverride.ts. This loader consumes
  // only the URL and the service-role key, but it validates the whole trio: a
  // loader that tolerated a stray SUPABASE_ANON_KEY would re-open the partial
  // override door one name narrower (03-REVIEW.md WR-04). A partial trio throws
  // here, which is before `assertSeedTargetAllowed` and therefore before any
  // client exists.
  const fromEnv = readSupabaseOverride();
  if (fromEnv) return { url: fromEnv.url, key: fromEnv.serviceRoleKey };

  let status: string;
  try {
    status = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "Could not read `supabase status -o env`. Start the local stack with " +
        "`supabase start`, or export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const read = (name: string): string | undefined =>
    status.match(new RegExp(`^${name}="?([^"\\n]*)"?$`, "m"))?.[1];

  // `fromEnv` is null on this path by construction, so both values come from
  // the one running local stack rather than from two different environments.
  return {
    url: read("API_URL"),
    key: read("SERVICE_ROLE_KEY") ?? "",
  };
}

/** Throws with the Postgres message rather than a generic one. */
function must(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/**
 * Removes every row this loader owns, children first.
 *
 * Scoped by the fixed ids in `personas.ts` plus anything a seeded persona
 * created while the harness was driving the app, so a spec that saved an event
 * cannot leak into the next run's dump.
 */
async function purge(admin: Admin): Promise<void> {
  must(
    "delete saved_events",
    (await admin.from("saved_events").delete().in("user_id", SEEDED_USER_IDS)).error
  );
  must(
    "delete rsvps",
    (await admin.from("rsvps").delete().in("user_id", SEEDED_USER_IDS)).error
  );
  must(
    "delete club_members",
    (await admin.from("club_members").delete().in("user_id", SEEDED_USER_IDS)).error
  );
  must(
    "delete club_followers",
    (await admin.from("club_followers").delete().in("user_id", SEEDED_USER_IDS)).error
  );
  must(
    "delete notifications",
    (await admin.from("notifications").delete().in("user_id", SEEDED_USER_IDS)).error
  );
  must(
    "delete events (by id)",
    (await admin.from("events").delete().in("id", SEEDED_EVENT_IDS)).error
  );
  must(
    "delete events (by seeded author)",
    (await admin.from("events").delete().in("created_by", SEEDED_USER_IDS)).error
  );
  must(
    "delete clubs (by id)",
    (await admin.from("clubs").delete().in("id", SEEDED_CLUB_IDS)).error
  );
  must(
    "delete clubs (by seeded author)",
    (await admin.from("clubs").delete().in("created_by", SEEDED_USER_IDS)).error
  );
  must(
    "delete public.users",
    (await admin.from("users").delete().in("id", SEEDED_USER_IDS)).error
  );

  // GoTrue owns `auth`. Deleting through the admin API rather than by SQL keeps
  // the identity rows and whatever else that schema holds consistent.
  for (const id of SEEDED_USER_IDS) {
    const { error } = await admin.auth.admin.deleteUser(id);
    // "User not found" is the expected outcome on a freshly reset database.
    if (error && !/not found/i.test(error.message)) {
      throw new Error(`delete auth user ${id}: ${error.message}`);
    }
  }

  // ...and by ADDRESS as well as by id. GoTrue enforces a unique constraint on
  // the email, so an account left over under a DIFFERENT id — which is exactly
  // what happens the day a persona's fixed id changes — blocks the create with
  // "a user with this email address has already been registered" and leaves the
  // loader wedged until somebody resets by hand. Purging both keys makes the
  // loader idempotent across its own id changes, not just across its own runs.
  const wanted = new Set(SEEDED_EMAILS.map((e) => e.toLowerCase()));
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`list auth users: ${listError.message}`);
  const stale = (listed?.users ?? []).filter(
    (u) => u.email && wanted.has(u.email.toLowerCase())
  );
  if (stale.length > 0) {
    const staleIds = stale.map((u) => u.id);
    // `clubs.created_by` references auth.users with NO ACTION, so a leftover
    // club would make the account undeletable and the error message ("Database
    // error deleting user") would say nothing about why. Clear what points at
    // it first, children before parents, exactly as above.
    //
    // Each of these goes through `must()` for the same reason the block above
    // does. Discarding these eight results was 03-REVIEW.md WR-08: a failure
    // here produces no message of its own and then re-surfaces four lines later
    // as GoTrue's "Database error deleting user" — which is precisely the
    // message the comment above says "would say nothing about why". Checking
    // them is what makes the loader name the table that actually refused.
    must(
      "purge stale saved_events",
      (await admin.from("saved_events").delete().in("user_id", staleIds)).error
    );
    must(
      "purge stale rsvps",
      (await admin.from("rsvps").delete().in("user_id", staleIds)).error
    );
    must(
      "purge stale club_members",
      (await admin.from("club_members").delete().in("user_id", staleIds)).error
    );
    must(
      "purge stale club_followers",
      (await admin.from("club_followers").delete().in("user_id", staleIds)).error
    );
    must(
      "purge stale notifications",
      (await admin.from("notifications").delete().in("user_id", staleIds)).error
    );
    must(
      "purge stale events (by author)",
      (await admin.from("events").delete().in("created_by", staleIds)).error
    );
    must(
      "purge stale clubs (by author)",
      (await admin.from("clubs").delete().in("created_by", staleIds)).error
    );
    must(
      "purge stale public.users",
      (await admin.from("users").delete().in("id", staleIds)).error
    );

    for (const u of stale) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error && !/not found/i.test(error.message)) {
        throw new Error(`delete stale auth user ${u.email}: ${error.message}`);
      }
    }
  }
}

/** Creates the ten accounts with their FIXED ids, then their profile rows. */
async function seedUsers(admin: Admin): Promise<void> {
  for (const p of PERSONAS) {
    const { error } = await admin.auth.admin.createUser({
      id: p.id, // explicitly supported by AdminUserAttributes — verified in-tree
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { name: p.name, full_name: p.name },
    });
    must(`create auth user ${p.key}`, error);
  }

  must(
    "insert public.users",
    (
      await admin.from("users").insert(
        PERSONAS.map((p) => ({
          id: p.id,
          email: p.email,
          name: p.name,
          roles: p.roles,
          onboarding_completed: p.onboarding_completed,
          interest_tags: p.interest_tags,
          inferred_tags: [],
          banned_at: p.banned_at,
          ban_expires_at: p.ban_expires_at,
          ban_reason: p.ban_reason,
          banned_by: null,
          year: p.year,
          faculty: p.faculty,
          visibility: "public",
          // Every timestamp is pinned. A column left to `now()` would make two
          // loads differ and the determinism proof would be a lie.
          created_at: SEED_STAMP,
          updated_at: SEED_STAMP,
        }))
      )
    ).error
  );
}

async function seedClubsAndMembership(admin: Admin): Promise<void> {
  must(
    "insert clubs",
    (
      await admin.from("clubs").insert(
        CLUBS.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          created_by: c.created_by,
          category: c.category,
          description: c.description,
          created_at: SEED_STAMP,
          updated_at: SEED_STAMP,
        }))
      )
    ).error
  );

  must(
    "insert club_members",
    (
      await admin.from("club_members").insert(
        MEMBERSHIPS.map((m) => ({
          id: m.id,
          club_id: m.club_id,
          user_id: m.user_id,
          role: m.role,
          created_at: SEED_STAMP,
        }))
      )
    ).error
  );
}

async function seedEvents(admin: Admin): Promise<void> {
  // The generator exists so "arbitrary but always the same" is cheap. It picks
  // each event's organizer label from a fixed list; the sequence is a function
  // of SEED alone, so the labels are identical on every load.
  const next = prng(SEED);
  const organizers = ["Seed Organizer A", "Seed Organizer B", "Seed Organizer C"];

  must(
    "insert events",
    (
      await admin.from("events").insert(
        EVENTS.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          status: e.status,
          club_id: e.club_id,
          created_by: e.created_by,
          start_date: e.start_date,
          end_date: e.end_date,
          tags: e.tags,
          location: e.location,
          is_free: e.is_free,
          source: "manual",
          organizer: organizers[Math.floor(next() * organizers.length)],
          created_at: SEED_STAMP,
          updated_at: SEED_STAMP,
        }))
      )
    ).error
  );
}

async function seedInteractions(admin: Admin): Promise<void> {
  must(
    "insert rsvps",
    (
      await admin.from("rsvps").insert(
        RSVPS.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          event_id: r.event_id,
          status: r.status,
          created_at: SEED_STAMP,
          updated_at: SEED_STAMP,
        }))
      )
    ).error
  );

  // `SAVED_EVENTS` is deliberately empty — see the long note in personas.ts.
  // Inserting here would fire saved_events_count_trigger, which UPDATEs
  // public.users, which fires update_users_updated_at, which unpins a timestamp
  // the determinism proof depends on. The loop is kept so that re-introducing a
  // row is a one-line change in personas.ts and not a change here.
  if (SAVED_EVENTS.length > 0) {
    must(
      "insert saved_events",
      (
        await admin.from("saved_events").insert(
          SAVED_EVENTS.map((s) => ({
            id: s.id,
            user_id: s.user_id,
            event_id: s.event_id,
            created_at: SEED_STAMP,
          }))
        )
      ).error
    );
  }
}

/**
 * A canonical view of everything the loader writes.
 *
 * Rows are selected by the fixed ids and sorted by id, and the columns are
 * named explicitly, so the output cannot drift with column order or with
 * whatever else happens to be in the database. `saved_events_count` is included
 * deliberately: it is maintained by a trigger, and a determinism proof that
 * skipped trigger-maintained columns would not be proving much.
 *
 * The `auth` schema is NOT dumped. GoTrue stamps its own `created_at` on every
 * account it makes and those instants are not ours to pin; what this seed fixes
 * about `auth` is the set of ids, and that set is asserted separately below.
 */
async function dump(admin: Admin): Promise<string> {
  const users = await admin
    .from("users")
    .select(
      "id,email,name,roles,onboarding_completed,interest_tags,inferred_tags," +
        "banned_at,ban_expires_at,ban_reason,year,faculty,visibility," +
        "saved_events_count,created_at,updated_at"
    )
    .in("id", SEEDED_USER_IDS)
    .order("id");
  must("dump users", users.error);

  const clubs = await admin
    .from("clubs")
    .select("id,name,status,created_by,category,description,created_at,updated_at")
    .in("id", SEEDED_CLUB_IDS)
    .order("id");
  must("dump clubs", clubs.error);

  const members = await admin
    .from("club_members")
    .select("id,club_id,user_id,role,created_at")
    .in("user_id", SEEDED_USER_IDS)
    .order("id");
  must("dump club_members", members.error);

  const events = await admin
    .from("events")
    .select(
      "id,title,description,status,club_id,created_by,start_date,end_date," +
        "tags,location,is_free,source,organizer,rsvp_count,created_at,updated_at"
    )
    .in("id", SEEDED_EVENT_IDS)
    .order("id");
  must("dump events", events.error);

  const rsvps = await admin
    .from("rsvps")
    .select("id,user_id,event_id,status,created_at,updated_at")
    .in("user_id", SEEDED_USER_IDS)
    .order("id");
  must("dump rsvps", rsvps.error);

  const saved = await admin
    .from("saved_events")
    .select("id,user_id,event_id,created_at")
    .in("user_id", SEEDED_USER_IDS)
    .order("id");
  must("dump saved_events", saved.error);

  const authIds: string[] = [];
  for (const id of SEEDED_USER_IDS) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data?.user) authIds.push(`${data.user.id} ${data.user.email ?? ""}`);
  }
  authIds.sort();

  return JSON.stringify(
    {
      pinned_now: iso(PINNED_NOW),
      timezone: SEED_TIMEZONE,
      prng_seed: SEED,
      auth_identities: authIds,
      users: users.data,
      clubs: clubs.data,
      club_members: members.data,
      events: events.data,
      rsvps: rsvps.data,
      saved_events: saved.data,
    },
    null,
    2
  );
}

async function main(): Promise<void> {
  const resolved = resolveLocalCredentials();
  // THE TARGET ASSERTION. Nothing below runs, and no client exists, until it
  // returns. Every other statement in this function is downstream of it.
  const url = assertSeedTargetAllowed(resolved.url);
  const admin = createClient<Database>(url, resolved.key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (process.argv.includes("--dump")) {
    process.stdout.write(await dump(admin) + "\n");
    return;
  }

  console.log(`seed: target ${url} (local stack)`);
  await purge(admin);
  await seedUsers(admin);
  await seedClubsAndMembership(admin);
  await seedEvents(admin);
  await seedInteractions(admin);

  console.log(
    `seed: ${PERSONAS.length} personas, ${CLUBS.length} clubs, ` +
      `${MEMBERSHIPS.length} memberships, ${EVENTS.length} events, ` +
      `${RSVPS.length} rsvps, ${SAVED_EVENTS.length} saved events`
  );
  console.log(`seed: pinned now ${iso(PINNED_NOW)} (${SEED_TIMEZONE})`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
