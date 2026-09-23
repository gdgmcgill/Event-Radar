# Visual-fix decision — the 04-11 owner checkpoint

**Plan:** 04-11 · **Phase:** 04-slices-1-2-saved-events-rsvp-and-the-event-read-path · **Recorded:** 2026-09-23 · **Tree:** `main` @ `bb27c64` (04-10 head)

## Outcome

- **Option selected: `option-defer`** (defer both F-080's visual half and F-081's identity mappings).
- **Who selected it: resolved by rule — no owner answer was available.** The phase owner was not present in the execution session and could not answer the checkpoint. The plan's written rule for that case (04-11-PLAN.md, Task 1 context) was applied: "Rule if no owner answer is available: select option-defer, and record in evidence/visual-fix-decision.md that the checkpoint was resolved by rule, not by the owner (the 03-08 precedent)."
- **Date:** 2026-09-23.
- **The executor did not choose.** No option was weighed or recommended; the rule selected the default, which is also the only option that honours orchestrator decision 1 as written.

## What was put to the owner (the checkpoint, as it would have been presented)

**Decision.** Whether F-080's visual half (remove the organizer-string club fallback in `transformEventFromDB`; give `/api/events/[id]` the real club embed `EVENT_WITH_CLUB_SELECT`) and F-081's fix (identity mappings for `tech`, `food`, `volunteer`, `arts`, `music`, `networking` in `TAG_ALIASES`) ship in Phase 4 as logged intentional behaviour changes, or are deferred with an owner.

**Measured seeded deltas** (04-04's DEFECT tests, `evidence/playwright.slice-2-before.txt` lines 293-294, both green; the organizer label read from the seeded local database on 2026-09-23):

| Surface | Today (seeded) | If shipped |
|---|---|---|
| `/events/<Seed Approved Event>` "Hosted by" | `Seed Organizer C` (the event's `organizer` label; the e2e test at `e2e/specs/event-read-path.spec.ts:182` asserts `/^Seed Organizer [ABC]$/` and "not Seed Approved Club") | `Seed Approved Club`, with the club category |
| `/events/<Seed Approved Music Night>` "Hosted by" | `Seed Organizer C` | `Seed Approved Club` |
| Feed card, Seed Approved Event (stored `academic, tech`) | Academic + Social; filed under the Social row; no Tech row (`e2e/specs/event-read-path.spec.ts:203`) | Academic + Tech |
| Feed card, Seed Approved Music Night (stored `music, social`) | Cultural + Social | Music + Social |

Production consequences of shipping F-080's half: every event created through the app stores its creator's display name as `organizer`, so today its detail page names the creator as host; shipping names the club. Scraped events with no club (organizer only) lose the organizer pill on cards and the "Hosted by" block on detail pages; `event.organizer` stays in the payload. Shipping F-081: filtering by a tag and the badge on the result agree, which today they do not.

**Options.**

| Option | Pros | Cons |
|---|---|---|
| `option-defer` (default) | No rendered change anywhere; Phase 4 stays inside "no intentional visual change" | ROADMAP criterion 2 and REFAC-10 clause 1 close PARTIAL; production keeps naming the creator as host; badges keep disagreeing with filters |
| `option-ship-club` | Criterion 2 and REFAC-10 clause 1 are met; detail page and card agree about the host | Overrides orchestrator decision 1 for the detail page's host block and scraped events' organizer pill |
| `option-ship-both` | Both data-correction defects closed; tag filters and badges agree | Overrides orchestrator decision 1 for host text and for six categories' badges and colours |

## What `option-defer` means for the phase

- **ROADMAP success criterion 2** ("The events list returns clubs from a real join instead of fabricating club objects, and the dual date schema is resolved …") closes **PARTIAL** on its first clause. Delivered: the six list routes and `/api/users/saved-events` select the real embed (`1150b0f`, `9083430`; `evidence/club-embed.txt`). Not delivered: `transformEventFromDB`'s organizer fallback still fabricates a club when a row has no embed (pin A), and `/api/events/[id]` still selects `*`, so the detail response carries the fabricated club (pin D). The date-schema clause is met separately (F-050).
- **REFAC-10** is recorded **PARTIAL**, naming its first clause ("events list uses a real club join instead of fabricating club objects"). Its other three clauses (date schema, centralized tags with unknown tags surfaced, `%`/`_` escaped) are evidenced in `evidence/PHASE-4-COMPLETION.md`.
- **ROADMAP criterion 3's tag clause is met either way** (04-07, `2db5d2a` and `46731e6`; DEC-26). The identity mappings go beyond its letter.
- **Orchestrator decision 1 is honoured** for F-080 and F-081: no source file changes in this plan (`git diff --stat bb27c64 -- src/` is empty at this plan's close).
- **The deferrals are owned**: DI-39 (F-080 visual half) and DI-40 (F-081 identity mappings) in `evidence/deferred-items.md`, both owned by the phase owner. DI-37 (prototype-key tag lookup) travels with DI-40, as its own entry said it would.
- **The pins stay green and visible**: `src/__tests__/api/events/club-fabrication-defect.test.ts` pins A and D; `src/__tests__/lib/tag-coercion-defect.test.ts` (the F-081 suite); Playwright `DEFECT F-080` and `DEFECT F-081` (`e2e/specs/event-read-path.spec.ts:182` and `:203`).

## F-082 was outside this checkpoint (DEC-32)

F-082's special-character search change was **not among the options**, because DEC-32 decided it and 04-08 shipped it (`c20d59b`). The checkpoint would have quoted DEC-32's rule to the owner verbatim, from `evidence/phase-04-decisions.md` § DEC-32 (b):

> A seeded-visible fix goes to the owner checkpoint when the ROADMAP clause that motivates it can be delivered, fully or in part, without that visible change. It ships under a numbered decision only when **no** delivery of the mandated clause leaves seeded output unchanged.

F-080 and F-081 meet the first half of that rule (04-10 delivered criterion 2 in part non-visually; 04-07 met criterion 3's tag clause non-visually). F-082 meets the second: criterion 3 says "`%` and `_` are escaped in search input" in so many words, and every implementation changes what a `%` search returns. Its seeded delta: a search for `%` or `_` returned both approved events before 04-08 and none after; `a,b` moved from an API 500 to a 200, with the feed showing "No events found" both times (`evidence/playwright.escaping.txt`; e2e `FIXED F-082` tests).

**Owner objection to DEC-32: none recorded.** No owner answer was available at this checkpoint, so no objection was raised, and no DI entry for one is added. The owner may still object after the fact; the mechanism is in "Reversing this decision" below.

## Reversing this decision

The deferral is a default, not a verdict. The phase owner can reverse it at any time by writing an owner-signed paragraph under this file's "Outcome" section naming `option-ship-club` or `option-ship-both`, and then running the Task 2 ship path of `04-11-PLAN.md` as a follow-up plan (a `/gsd-quick` or an inserted phase):

- **F-080 (commit A):** in `src/lib/tagMapping.ts`, remove the organizer branch of `transformEventFromDB` so an event with no club row has no `club` (`organizer` still passes through); in `src/app/api/events/[id]/route.ts` GET, select `EVENT_WITH_CLUB_SELECT` in place of `"*"`, drop the cast if the literal typing allows, and replace the 04-10 comment. Move pins A and D, flip Playwright test 8 to `FIXED F-080:` asserting "Hosted by Seed Approved Club". Subject `fix(…): return the real club instead of fabricating one from the organizer string (F-080)`, body beginning `INTENTIONAL VISUAL CHANGE`. Measured cost: +0.34 ms median locally (`evidence/club-join-latency.txt`).
- **F-081 (commit B, separately):** map the six members to themselves in `TAG_ALIASES` (`src/lib/eventTags.ts`), empty `KNOWN_NON_ROUNDTRIP_TAGS`, move the six golden-table rows and the F-081 suite, flip Playwright test 9. Decide `competition` (sports here, career in `TAG_HIERARCHY`) and apply DI-37's `Object.hasOwn` in the same change.
- Then flip F-080/F-081 to Fixed in `.planning/audit/findings.json`, close DI-39/DI-40 (and DI-37), and change REFAC-10 from PARTIAL to Complete in `.planning/REQUIREMENTS.md` and ROADMAP's Phase 4 state line.

A DEC-32 objection is handled the same way: an owner-signed paragraph here, which becomes a DI entry owned by the phase owner. Reverting `c20d59b` would reopen an injection-class finding (F-082) and criterion 3's escaping clause.

*Phase: 04-slices-1-2-saved-events-rsvp-and-the-event-read-path*
*Plan: 04-11 — Tasks 1 and 2*
