# Deferred Items — Phase 02

**Phase:** 02-dependency-and-runtime-stabilization · **Opened:** 2026-09-15 by plan 02-05

Out-of-scope discoveries made while executing a batch. Each was found by a gate,
recorded here, and deliberately **not** fixed in the batch that found it. The
scope rule this file enforces: a batch fixes what its own change broke, and
nothing else. A dependency batch that also edits seven components is no longer a
reviewable dependency batch.

---

## D-01 — Seven `window.location` writes with relative destinations

**Found by:** plan 02-05 (batch 2), `npm run lint`
**Surfaced because:** `eslint-config-next` 16.0.3 → 16.3.5 ships
`@next/next/no-location-assign-relative-destination`, a rule that did not exist
when the AUDIT-13 lint baseline was captured. The code is unchanged; the linter
is new.

| File | Line |
|------|------|
| `src/app/events/[id]/EventDetailClient.tsx` | 235:5 |
| `src/components/auth/SignOutButton.tsx` | 42:7 |
| `src/components/auth/SignOutButton.tsx` | 44:7 |
| `src/components/clubs/ClubDiscoveryCard.tsx` | 43:7 |
| `src/components/clubs/ClubSettingsTab.tsx` | 233:7 |
| `src/components/clubs/ClubSettingsTab.tsx` | 256:7 |
| `src/components/clubs/FollowButton.tsx` | 39:7 |

**Why not fixed in batch 2.** Batch 2's contract is "move the framework, alone,
in one commit." Editing seven component files would break that isolation and the
phase's no-behaviour-change constraint. These are warnings, not errors; `npm run
lint` exits 0.

**Why it is not merely cosmetic.** The rule exists because assigning an
attacker-influenced relative destination to `window.location` is an open-redirect
and navigation-hijack surface. Two of the seven sites are in `SignOutButton.tsx`,
on the sign-out path. Whether any of the seven destination values is
attacker-influenced was **not** investigated by this plan — that determination is
the work being deferred, not the fix.

**Route:** Stage 3. These are page/component-layer navigation concerns, which
belong with the routing and page slices (Phases 5–6), not with a dependency
batch. Should be triaged as a Phase 1-style finding first — classify each of the
seven by whether its destination is user-controlled — and only then fixed.

---

## D-02 — `next dev` writes an agent-rules block into the tracked `CLAUDE.md`

**Found by:** plan 02-05 (batch 2), starting `npm run dev` for the Tier 2 smoke
**Emitter:** `node_modules/next/dist/server/lib/generate-agent-files.js`, new in
the 16.3.x line.

`next dev` appends a delimited `<!-- BEGIN:nextjs-agent-rules -->` block to
`CLAUDE.md` and re-adds it if removed. It **appends** — the diff was 10
insertions and 0 deletions, and every pre-existing line of the project's
`CLAUDE.md` survived intact. `.claude/CLAUDE.md` was not touched. `next build`
does not do this; only `next dev`.

**Resolved in batch 2 by committing the block** rather than suppressing it. That
is the upstream-sanctioned outcome (the block says so itself), it makes the
working tree deterministic across dev runs, and it requires no `next.config.js`
change in a batch whose whole point is that only the framework moved.

**Deferred decision:** whether to instead set `agentRules: false` in
`next.config.js` and keep `CLAUDE.md` exclusively human-authored. That is a
project-governance call about whether a build tool may write to an instruction
document, not a correctness call, and it is the user's to make. Raised here so
it is visible rather than silently settled by a default.

---

*Phase: 02-dependency-and-runtime-stabilization*
*Plan: 02-05*
