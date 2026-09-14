# The deployment platform's scheduled-job state

**Requirement:** AUDIT-11 (the Vercel third) &nbsp;·&nbsp; **Plan:** 01-10, Task 2 &nbsp;·&nbsp; **Phase:** 01-read-only-foundation-audit
**Blocking input:** `BLOCKING-INPUTS.md` § 4 — *"The Vercel project's **Cron Jobs** list"*
**Read date:** 2026-09-14
**Status:** **resolved.** The answer is recorded below with its provenance.

---

## 1. The answer

> **Zero cron jobs are configured on the Vercel project.**
>
> The cron feature is enabled on the project and has never been disabled, and the list of cron
> definitions is **empty**.

Verbatim, from the committed capture `../raw/vercel/project.json` → `data.crons`:

```json
{
  "enabledAt": 1771626390060,
  "disabledAt": null,
  "updatedAt": 1774585708660,
  "deploymentId": "dpl_6NvnFrYRXtC8AAr4RHXyfEREYoj1",
  "definitions": []
}
```

| Field | Value | Reading |
|---|---|---|
| `enabledAt` | `1771626390060` → 2026-02-20T22:26:30Z | The cron feature is available on this project and has been since the project was created. The absence of jobs is not a plan or entitlement limitation. |
| `disabledAt` | `null` | Cron was never turned off. Nothing was configured and later removed at the account level. |
| `definitions` | `[]` | **The list is empty.** No path, no schedule, no last run — because there is nothing to have a last run. |
| `updatedAt` | `1774585708660` → 2026-03-27T04:28:28Z | Equals the creation time of the latest production deployment, to the second. |
| `deploymentId` | `dpl_6NvnFrYRXtC8AAr4RHXyfEREYoj1` | The same id as `data.latestProductionDeployment.id`, state `READY`. |

**Why the last two rows matter more than they look.** On Vercel, a project's cron definitions are not
independent configuration — they are **derived from `vercel.json` at deploy time** and re-evaluated on
every production deployment. `updatedAt` pointing at the current production deployment, and
`deploymentId` naming that same deployment, together say that this empty list is not a stale record
from before some manual setup: it is the list Vercel computed from the deployed `vercel.json` on
2026-03-27, and `vercel.json` has no `crons` key. The empty result is **current and causal**, not
merely unpopulated.

## 2. Provenance — and a deviation from what the plan asked for

`01-10-PLAN.md` Task 2 is a `checkpoint:human-action` asking an operator to open
*Vercel Dashboard → the project → Settings → Cron Jobs*, copy the list or confirm it is empty, and
paste the result. **That is not how this answer was obtained**, and saying so is the point of this
section.

| | Asked for by the plan | Actually used |
|---|---|---|
| Source | The Cron Jobs settings page, read by a human in an authenticated browser session | `GET /v9/projects/{id}` — the Vercel REST API, read-only |
| Credential | The operator's dashboard session | A read-only Vercel CLI login token, held by the orchestrator, never by this plan |
| Artifact | A screenshot or pasted configuration | `../raw/vercel/project.json` — a committed capture envelope with `name`, `captured_at`, `transport`, `fields`, `data` |
| Read by | A human | The orchestrator, before this plan began |
| Captured at | — | 2026-09-14T19:13:06Z |

**The substitution is an upgrade, not a shortcut.** The `crons` object is the *same state the settings
page renders* — the page is a view over this field — but it arrives as a machine-readable structure
with a capture timestamp, it carries `enabledAt`/`disabledAt`/`deploymentId`, which the page does not
surface, and it is re-checkable by anyone with read access without asking a person to look at a screen
again. The reason the plan asked for a human was that `01-RESEARCH.md` § Environment Availability
recorded the `vercel` CLI as unverified (*"`vercel@32.3.0` is in `dependencies` but never imported; a
global install was not probed"*). That uncertainty resolved in the affirmative.

This is the same class of transport deviation that plan 01-06 recorded for the database half of this
phase, and it is documented in `../redaction/01-10.md` § 3 rather than smoothed over, because an
artifact whose evidence came from somewhere other than where it says is worse than no artifact.

**No secret was transcribed.** The plan's instruction — *"Do not paste any deployment token or cron
secret value"* — is satisfied by construction: the capture selected the fields above and nothing else,
and the separate environment-variable capture recorded variable **names** only, discarding the values
in the API response without logging them. No redaction marker was needed anywhere in this file,
because no value requiring one was ever present.

## 3. Other external schedulers — the question behind the question

The checkpoint also asks whether *any other* external scheduler invokes these routes: a scheduled
workflow in another repository, a third-party scheduling service, or an automation platform. The
honest answer has two halves.

**What was checked, and came back negative:**

| # | Check | Command | Result |
|---|---|---|---|
| N1 | The deployment configuration declares no cron | `node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('vercel.json','utf8'))))"` | keys are `$schema`, `buildCommand`, `framework`, `regions`, `headers`. **No `crons` key.** |
| N2 | Nothing in the repository calls either path | `git grep -n "api/cron" -- ':(exclude).planning' ':(exclude)docs'` | **no matches.** The only things naming these paths are the handlers' own directories. |
| N3 | The only CI workflow does not invoke them | `ls .github/workflows/` then `grep -nE "curl\|wget\|cron\|schedule\|api/cron" .github/workflows/ci.yml` | `ci.yml` is the only workflow. It triggers on `push` and `pull_request` to `main` only — **there is no `schedule:` trigger** — and it contains no `curl`, no `wget`, and no reference to either path. Its steps are checkout, setup-node, `npm ci`, lint, `tsc --noEmit`, build. |
| N4 | What the handlers expose | `grep -oE "export async function [A-Z]+"` on both route files | Each exports **`POST` and nothing else**. There is no `GET`, so a browser visit, an uptime pinger, or a link preview cannot trigger either one. |

**What cannot be checked from here, and is therefore recorded as a bounded gap rather than a clean
negative.** A scheduler that lives entirely outside this repository and outside this Vercel project —
a cron entry on someone's laptop, a Zapier or n8n automation, an EasyCron account, a workflow in a
different GitHub repository — would leave no trace in any source this phase can read. Three
observations bound that gap to something close to zero, and they are stated as evidence rather than as
reassurance:

1. **An external caller would need the shared secret**, and `CRON_SECRET` **is not configured on the
   production deployment** (`../raw/vercel/env-names.json` lists exactly three variables, and it is not
   among them). An external scheduler set up by someone who knew the design would have needed a value
   to send; there is no value to have been given.
2. **`/api/cron/send-feedback-requests` fails closed when that variable is unset** — it returns
   HTTP 500 before the comparison — so any external scheduler calling it has been receiving nothing but
   500s for as long as it has existed. That is not a configuration somebody maintains.
3. **`email_reminder_log` has 0 rows in production** (`../raw/prod/row-counts.json`).
   `/api/cron/send-reminders` writes a row to that table on every reminder it sends. A zero row count is
   direct, empirical, database-side evidence that **the handler has never completed a send in
   production, from any caller, ever.** This is the strongest of the three, because it does not depend
   on knowing where a caller might live.

The analysis of what fires these handlers — and what, separately, does the work they were written to
do — is in `cron-webhook-inventory.md` § 2.

---

*Requirement AUDIT-11 (Vercel third) · phase 01-read-only-foundation-audit · plan 01-10 · read 2026-09-14*
