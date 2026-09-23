# Phase 4 decision record — DEC-23 through DEC-32

**Plan:** 04-01 · **Phase:** 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · **Recorded:** 2026-09-23

These are the design calls every later Phase 4 plan executes against. **No CONTEXT.md exists for
this phase** because no discuss-phase ran. The binding inputs are the three orchestrator decisions
and `04-RESEARCH.md`:

1. **Orchestrator decision 1:** no intentional visual change on seeded data.
2. **Orchestrator decision 2:** no schema change. Nothing is added under `supabase/migrations/`.
3. **Orchestrator decision 3:** production is never touched.

Where the research recommends something and nothing overrides it, the recommendation is recorded
here as a decision. Later plans then execute against a written decision rather than a paragraph.

**Numbering.** `DEC-` continues from DEC-22, the highest in use. That was confirmed on 2026-09-23 by
`command grep -rhoE 'DEC-[0-9]+' .planning/STATE.md .planning/PROJECT.md .planning/phases/0[123]*`,
whose highest result is `DEC-22`. `DEC-` ids are decisions and `DI-` ids are deferred items, per
the prefix rule in `.planning/phases/03-…/evidence/deferred-items.md` § "The two D- sequences".

**Two decisions are the planner's, not the phase owner's,** because no discuss-phase ran: DEC-25
(the pagination contract) and DEC-32 (F-082's exemption from the owner checkpoint). The phase owner
may override either before the plan that executes it runs. The mechanism is stated in each section.

---

## DEC-23 — RSVP counts use two parallel head-count queries, not a DB function

**Decision.** `GET /api/events/[id]/rsvp` replaces its load-every-row count with two parallel
`supabase.from("rsvps").select("id", { count: "exact", head: true })` queries under `Promise.all`,
one per status (`going`, `interested`). `total` stays `going + interested`. If either query errors,
the handler returns today's bytes, 500 `{ error: "Failed to fetch RSVPs" }`.

**Evidence.** 04-RESEARCH.md § Q(b) option A. `supabase/config.toml:18` caps row-returning selects at
1000 (F-079). A head count is a server-side `COUNT(*)` that the cap does not apply to. In-repo prior
art: `src/app/profile/page.tsx:38-42`. The count is RLS-filtered exactly as the row select was, so
visibility semantics are unchanged.

**Alternative rejected.** Option B, a `get_event_rsvp_counts(uuid)` SQL function: one round trip,
but it needs a migration, pgTAP, a type regeneration and a green `types` drift job, and orchestrator
decision 2 forbids the migration. It could not reach production before Phase 8 anyway (DI-23).

**Executed by:** 04-05 (the fix commit, naming F-079), pinned beforehand by 04-02's DEFECT and
PRESERVE suites.

## DEC-24 — DI-35: narrow the request profile; add no ban guard; leave `checkBanStatus()` where it is

**Decision.** `RequestProfile` in `src/server/context.ts` narrows to the three columns something
reads: `id`, `roles`, `onboarding_completed`. The docblock that claims the seam serves "the ban
check" is corrected in the same change. **No `requireNotBanned` guard is added to the seam.**
`checkBanStatus()` (`src/lib/ban.ts`) stays exactly where it is called today, which is save POST
(`src/app/api/events/[id]/save/route.ts:55`) and rsvp POST (`src/app/api/events/[id]/rsvp/route.ts:188`).
It is not added to DELETE or GET, and not moved into the seam. Its asymmetry is pinned by PRESERVE
tests: today a banned user can un-save and cancel an RSVP but cannot create either.

**Evidence.** 04-RESEARCH.md § Q(h). `grep -rn 'banned_at\|ban_expires_at' src/server/` finds only
`context.ts`, so no guard reads the columns. The proxy ring fails open (`src/proxy.ts` outer catch).
F-062 shows the existing ring already disagrees with itself about response format. Ban enforcement
is REFAC-11, Phase 5, by name ("the ban check fails closed").

**Alternative rejected.** Adding `requireNotBanned` now would create a third ban ring whose
disagreement with the other two is unspecified, pre-empt the slice that owns ban enforcement, and do
so without the harness that slice is meant to inherit.

**Executed by:** 04-03 (the narrowing). The PRESERVE pins are in 04-02.

## DEC-25 — The pagination contract (research A6; planner's decision, overridable before 04-09)

**Decision.** `GET /api/events` implements the keyset cursor contract the client already speaks:

- The cursor is on `(start_date, id)` ascending, because `start_date` is not unique and a
  single-column cursor would skip or repeat rows.
- The cursor is encoded as base64 of a JSON `{ sortValue, id }`, exactly as the skipped suite
  (`src/app/api/events/route.test.ts`) encodes it.
- `page` and `limit` stay accepted.
- The response adds `nextCursor` and `prevCursor`.
- `total` is the count of all matching rows regardless of cursor.
- An invalid cursor is 400 `{ error: "Invalid cursor" }`.
- The `before` parameter, `sort`, `direction` and `clubId` are **not** honoured, because no live
  caller sends a non-default value. Only `src/app/page.tsx` calls `useEvents` (lines 247 and 270),
  with `sort: "start_date"`, `direction: "asc"` and no `clubId`.
- When the fuzzy-rank path is active (dead today, F-078, Phase 5) both cursors are null.

**Evidence.** F-083. `command grep -c -i cursor` finds 27 hits in the skipped suite and 0 in the
handler. "Load More" at `src/app/page.tsx:510-518` never renders. The project skill
`supabase-postgres-best-practices` `references/data-pagination.md` prefers multi-column keyset over
OFFSET. Phase 1's T-01-11-04 forbids reviving the suite against current behaviour.

**Alternative rejected.** Making the hook speak `page`/`limit` and deleting the cursor code. It is
simpler, but it deletes the only written statement of the contract while the client still depends on
one, and it keeps OFFSET paging, which the project skill advises against.

**Why this is the planner's call.** Research A6 names this as "a product decision about pagination,
not a technical one" and "the single item most worth a /gsd-discuss-phase answer". No discuss-phase
ran, so it is taken on the research's evidence. **Override:** the phase owner may append an
owner-signed paragraph to this section before 04-09 executes. 04-09 reads this section first.

**Executed by:** 04-09, pinned beforehand by 04-04's F-083 DEFECT suite.

## DEC-26 — Tag surfacing is non-visual; the six identity mappings go to the owner checkpoint

**Decision.** The non-visual half ships in 04-07:

- one centralized mapping module keyed on `EventTag`;
- a completeness test over every `Object.values(EventTag)` member;
- a server-side warning naming the unmapped tag and the event id;
- `mapTags` output byte-identical, so no seeded badge changes.

The six identity mappings (`tech`, `food`, `volunteer`, `arts`, `music`, `networking` mapping to
themselves) **would change seeded badges**. The seeded `["academic","tech"]` event would render
academic+tech instead of academic+social. They are therefore gated behind the 04-11 decision
checkpoint, **with deferral as the default** when the owner does not answer.

**Evidence.** F-081. The probe (re-run 2026-09-23) shows 6 of 12 members failing to round-trip.
ROADMAP success criterion 3's tag clause, "centralized with unknown tags surfaced rather than
silently coerced to SOCIAL", is met in full by the non-visual half. The identity mappings go beyond
its letter.

**Alternative rejected.** Shipping the identity mappings in 04-07 as a "logged" change. That is an
intentional visual change on seeded data, which orchestrator decision 1 forbids, and nothing in the
criterion's letter requires it.

**Executed by:** 04-07 (the non-visual half) and 04-11 (the checkpoint and its answer).

## DEC-27 — Club fabrication: the non-visual half ships; the visual half goes to the owner checkpoint

**Decision.** The non-visual half ships in 04-10:

- one shared club embed that carries the five real URL columns (`banner_url`, `website_url`,
  `discord_url`, `twitter_url`, `linkedin_url`);
- `/api/users/saved-events` gains the real embed. Its only consumer
  (`src/app/events/[id]/EventDetailClient.tsx`) reads ids, so nothing renders it;
- `contact_email` is **deliberately not embedded** in event payloads. This is data minimisation: it
  is fetched with the club, on the club's own surfaces.

The visual half is gated behind the 04-11 checkpoint: removing the organizer fallback in
`transformEventFromDB`, and giving `/api/events/[id]` the embed. That change turns "Hosted by" on
every seeded event's detail page from the organizer label (`Seed Organizer A|B|C`,
`scripts/seed/load.ts:325-349`) to "Seed Approved Club".

**The conflict, stated in these words:** the visual half **conflicts with orchestrator decision 1
while ROADMAP success criterion 2 requires it**. Criterion 2 says "the events list returns clubs from
a real join instead of fabricating club objects". Orchestrator decision 1 says no intentional visual
change on seeded data. There is no reading of either under which the detail page's "Hosted by" line
both stops fabricating and stays unchanged on the seed. So the plan set does not resolve the
conflict by omission; it puts it to the owner. Until the owner answers, criterion 2 is delivered
PARTIAL: the join exists and fabrication stops on the saved-events route, but the detail route and
the fallback are unchanged.

**Evidence.** F-080. `EventDetailView.tsx:219-260` renders `event.club.name` from `/api/events/[id]`.
Every seeded event carries both a `club_id` and an organizer label.

**Alternative rejected.** Shipping the whole fix in 04-10, which breaks orchestrator decision 1.
Shipping none of it, which leaves criterion 2 with no delivery at all when a non-visual part of it
is available.

**Executed by:** 04-10 (the non-visual half, with the A4 latency measurement) and 04-11.

## DEC-28 — DI-25: the SDK minor re-defers to Phase 5; the `ssr` major to Phase 5 at the earliest

**Decision.** No dependency moves in Phase 4. `@supabase/supabase-js` 2.81.1 → 2.116.0 re-defers to
**Phase 5** with the enumerated site list. `@supabase/ssr` 0.7 → 0.12, a major that touches
cookie and session handling, defers to **Phase 5 at the earliest**, which is REFAC-11's surface.

**Evidence.** `evidence/di-25-enumeration.txt` (research A5, closed by measurement 2026-09-23). The
bump yields 7 `TS2345` and 1 `TS2322` on the base commit. Six sites are admin or club routes, and one
is `src/lib/audit.ts:38` (F-073's `admin_email`). The seventh `TS2345` is
`src/app/api/events/[id]/route.ts(318,15)`, which is the file's **PATCH** handler, not the GET that
Phase 4's Slice 2 inventory owns. **No blocking site is in a Phase 4 handler.** The adjacency is
recorded rather than rounded away: a Phase 4 plan editing that file's GET must leave PATCH's
`directUpdates` typing alone. The bump closes no advisory: `npm audit --audit-level=high
--omit=dev` is clean (`evidence/floor.before.txt` block 5).

**Alternative rejected.** Taking the bump in Phase 4. Every blocking site is a mutation route that
no Phase 4 slice characterizes, and fixing one before it has a characterization test is the
behaviour-before-proof order the program forbids.

**Executed by:** this plan (the decision). DI-25's row in `evidence/deferred-items.md` carries it
forward.

## DEC-29 — Seam adoption drops three auth-error warning lines; the response bytes are unchanged

**Decision.** Adopting `createRequestContext()` + `requireUser()` removes three server-side
`console.warn` lines that fire today when `getUser()` returns an auth error, just before the 401:

- rsvp POST, `src/app/api/events/[id]/rsvp/route.ts:202`
- rsvp DELETE, same file `:387`
- saved-events GET, `src/app/api/users/saved-events/route.ts:51-54`

`createRequestContext()` (`src/server/context.ts:60-62`) destructures only `data.user` and does not
surface the auth error. The response is byte-identical: 401 `{ error: "Unauthorized" }`. **Auth-failure
logging belongs to Phase 6's structured logging.**

**Alternative rejected.** Widening the seam to return the auth error so the three lines survive.
That changes the seam's contract for every later adopter, in order to keep an unstructured log line
Phase 6 is going to replace.

**Executed by:** 04-05 (the seam-adoption commit states the dropped lines in its body).

## DEC-30 — No seed change in Phase 4

**Decision.** `scripts/seed/personas.ts` and `scripts/seed/load.ts` are not changed in Phase 4, and the
seed's sha256 determinism proof is untouched.

**Evidence.** Research Pitfall 3 says "there are no seeded rsvps at all". **That premise is
corrected here:** `scripts/seed/personas.ts:566-579` seeds two RSVPs, one `going` and one
`cancelled`, and the loader reports `2 rsvps` (`evidence/floor.before.txt` block 11). So the RSVP
count has real rows on both sides of its predicate without a seed change. The second thing Pitfall 3
wanted, an organizer-only event (`club_id` null), would itself create a seeded visual delta the
moment F-080's visual half lands: a detail page with no club block. That is exactly what
orchestrator decision 1 and DEC-27 keep off the table.

**Consequence.** Research A3, whether adding RSVP rows unpins the determinism proof, is moot.

**Alternative rejected.** Extending the seed as Pitfall 3 recommended. It would move the determinism
hash, require re-deriving it in three committed notes, and add a visual delta, all to buy coverage
the existing rows already give.

**Executed by:** every Phase 4 plan, as a constraint.

## DEC-31 — `events.rsvp_count` is registered, neither adopted nor dropped

**Decision.** The column is registered as **F-084** (owner Phase 6). It is not adopted as the count
source (DEC-23 counts `rsvps` directly) and it is not dropped, since that is a schema change and
orchestrator decision 2 forbids it.

**Evidence.** `command grep -n rsvp_count supabase/migrations/*.sql` finds one hit, the declaration.
Nothing writes it. Re-reading on 2026-09-23 found a reader the research did not list:
`src/app/api/events/export/route.ts:32,231` writes the column into the CSV export. That is recorded
on F-084 and not changed in Phase 4.

**Executed by:** this plan (the registration). Every Phase 4 plan treats it as a constraint.

## DEC-32 — F-082's escaping ships unconditionally in 04-08 and is not routed to the 04-11 owner checkpoint

This is a bounded exception to orchestrator decision 1. It is argued here so that the different
treatment of F-080/F-081 and F-082 is a stated rule rather than an unexplained asymmetry.

**(a) The visible delta, stated first.** On seeded data:

- A search for `%` or `_` returns both approved events today and none afterwards, because no seeded
  title contains either character.
- A search for `a,b` changes from an API 500 to a 200 with an empty list. The feed renders the same
  "No events found" state both times, because `src/app/page.tsx` ignores the hook's error: neither
  `useEvents` call (lines 247 and 264-276) destructures `error`. 04-04 Task 3 pins this.

**(b) The rule.** A seeded-visible fix goes to the owner checkpoint when the ROADMAP clause that
motivates it can be delivered, fully or in part, without that visible change. It ships under a
numbered decision only when **no** delivery of the mandated clause leaves seeded output unchanged.

- **F-081 goes to the checkpoint.** ROADMAP success criterion 3's tag clause ("centralized with
  unknown tags surfaced") is met fully and non-visually by 04-07. The identity mappings go beyond its
  letter (DEC-26).
- **F-080 goes to the checkpoint.** ROADMAP success criterion 2's real join is delivered in part
  non-visually by 04-10, so the owner has a real choice between PARTIAL and an override (DEC-27).
- **F-082 does not.** ROADMAP success criterion 3 says "`%` and `_` are escaped in search input" in
  so many words, and every implementation of that sentence changes what a `%` search returns. There
  is no non-visual partial delivery. Putting F-082 on the checkpoint would put criterion 3 itself on
  the checkpoint.

**(c) Criterion 4 is not overridden but scoped.** Criterion 4's "search behaves exactly as before" is
read as governing every search term the defect does not mishandle. Criterion 3 names these
characters, and the specific mandate governs the specific inputs. Read any other way, criteria 3 and
4 cannot both be met.

The terms whose results change are exactly those containing one of `%`, `_`, backslash, comma,
either parenthesis or a double quote. Every other term is proven to return identical results by:

- 04-04's events-list PRESERVE suite, which passes unmodified through 04-08;
- the existing "Music Night" UI search spec.

**(d) It is a query-semantics defect, not a presentation choice.** F-082 is registered Medium in the
`injection` category (the ASVS 4.0.3 § V5.3 injection-prevention class). Today a user-typed `%`
rewrites the query into match-everything. A comma produces a PostgREST parse error, which the
handler returns to an anonymous caller as a 500 carrying the internal filter text (the F-059 echo).
The checkpoint's no-answer rule defaults to deferral. Routing F-082 there would therefore let an open
injection-class finding stay open by rule rather than by anyone's decision, against the program's
core value that every workflow is correct and secure.

**(e) Consequences.**

- 04-08 cites DEC-32 in its objective and in its fix commit body.
- 04-11's checkpoint lists F-082 as already decided by DEC-32 and not up for deferral, quoting rule
  (b) to the owner.
- 04-11's completion note records F-082 as shipped under DEC-32.
- **The asterisk is knowingly out of scope.** PostgREST rewrites every `*` in a like/ilike value to
  `%` after unquoting, and ignores backslashes (PostgREST `src/library/PostgREST/Query/SqlFragment.hs`,
  the `star` mapping on OpLike/OpILike). A quoted `"%*%"` returned both seeded approved events on local
  PostgREST v16.1, measured 2026-09-23 (`.planning/audit/quality/phase-04-slice-defects.md` § F-082;
  the container image is `postgrest:v16.1`). So no ilike pattern can match a literal `*`, and
  escaping it would make a `*` search return `%`-containing rows. 04-08 leaves `*` at today's
  behaviour, so it adds nothing to (a)'s visible delta. The asterisk is outside criterion 3, which
  names only `%` and `_`. It is pinned by 04-08's unit test and its probe's KNOWN row, and its
  natural owner is F-078's Phase 5 fuzzy-RPC fix.

**Why this is the planner's call, and how to override it.** Like DEC-25, this decision is taken by
the planner because no discuss-phase ran. The phase owner may override it before 04-08 executes, by
appending an owner-signed paragraph to this section. **04-08 reads this section and stops before
changing any file if such a paragraph exists.**

**Executed by:** 04-08.

*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 04-01*
