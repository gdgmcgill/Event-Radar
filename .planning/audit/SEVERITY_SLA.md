# Severity SLA — Phase 1 Foundation Audit

**Requirement:** AUDIT-21
**Written:** 2026-09-14, in Wave 1, **before the first finding was filed** — so severity is graded against a pre-committed policy rather than argued after the fact.
**Enforced by:** `node .planning/audit/tools/validate.mjs --check sla` and `--check findings`
**Applies to:** every record in `.planning/audit/findings.json` and its generated view `.planning/audit/FOUNDATION_AUDIT.md`

---

## How severity is assigned

Severity here is **exposure-adjusted**: it is a judgment about who can reach the defect, what it crosses, and whether a compensating control already stands in the way. Every finding carries a written `severity_rationale` naming those three things.

**CVSS vectors are not assigned to application-logic findings.** CVSS scores a vulnerability class in the abstract; it cannot see that a route is behind an org-membership check, that RLS is a second ring, or that a handler is unreachable from any production entry point. A CVSS base score attached to a finding in this audit would import false precision and would be wrong in both directions. Where a finding is a published CVE in a dependency (AUDIT-12), the advisory's own severity is recorded verbatim as evidence, and the finding's severity is still set by the reachability judgment in `quality/dependency-report.md`.

Severity is never softened because a fix is inconvenient. That conversation belongs in the exception register below, where it leaves a dated, owner-signed trace.

---

## The four levels

| Severity | Definition (exposure-adjusted) | Must be fixed by | Enforcement |
|---|---|---|---|
| Critical | Anonymous-reachable, OR crosses a tenant boundary, OR exposes a credential — with no compensating control | The first Stage 3 slice that owns the affected layer. **No Critical may remain Open when Phase 5 (Auth, Club Authorization, Admin Containment) starts.** | CERT-11; blocks the Stage 4 gate. A Critical still Open at the Phase 5 boundary halts the program. |
| High | Requires authentication but crosses a trust boundary, OR is a fail-open shape on an admin/machine path, OR is a reachable High CVE in a production dependency | **Before Phase 7 (Certification Datasets and Persona Coverage) begins.** | CERT-11; a dated, owner-signed risk acceptance carrying a reachability argument is the only alternative to a fix. |
| Medium | Correctness or consistency defect that has a compensating control, or a latent hazard that becomes High after a plausible future change | Within Stage 3, in the slice that touches the affected file. | Tracked in `findings.json`. Not a gate, but a Medium left Open past its owning slice is re-reviewed at the Stage 3 close-out. |
| Low | Hygiene: dead code, stale documentation, dev-only dependency advisories, cosmetic drift | Opportunistically. No deadline. | Tracked, never blocking. |

**Phase-relative deadlines, not calendar dates.** This program's schedule is defined by phase boundaries, so a deadline expressed as a date would drift out of meaning the first time a phase slips. Each deadline above names the phase boundary it binds to; `closes_in_phase` on the finding records where it actually landed.

---

## Exception register

A finding moves from `Open` to `Risk-accepted` **only** with a complete `risk_acceptance` object:

| Attribute | Rule |
|---|---|
| `owner` | A named human who accepts the risk. Not a team, not a role. |
| `date` | ISO date the acceptance was signed. |
| `expiry` | ISO date, **at most 90 days after `date`**. There is no indefinite acceptance. |
| `rationale` | A **reachability argument** — why the defect cannot be reached, or what compensating control bounds it. "Low priority", "no time", and "unlikely" are not rationales. |

**An expired acceptance reverts to `Open` automatically.** `validate.mjs --check findings` asserts that any finding whose `risk_acceptance.expiry` is in the past has `status` back at `Open`, and that no acceptance was written with an expiry more than 90 days after its date. The validator is the enforcement mechanism; the register is not a place where a finding goes to be forgotten.

A Critical may not be risk-accepted. A Critical is either fixed or the program stops.

---

*Phase: 01-read-only-foundation-audit*
*Plan: 01-01*
