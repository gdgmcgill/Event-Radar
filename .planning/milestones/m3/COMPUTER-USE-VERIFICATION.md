# M3 browser verification (controller demo)

Date: 2026-09-29. Build: local production build of `codex/m3-useful-discovery` at `5a945fc`, started with the M3 acceptance configuration (`FEATURE_DISCOVERY_UI=true`, `CURATOR_USER_ID` = seed admin, local intake secret). Supabase: the guarded local stack only.

**Method.** Neither computer use nor a DOM browser tool was available in this session, so the milestone demo was driven by a temporary Playwright script in headless Chromium. It used fresh password sessions minted through `@supabase/ssr`'s own serializer, the same method as `e2e/auth.setup.ts`. The controller inspected every full-page screenshot directly. This is a scripted visual walkthrough, not a person operating the desktop. The script was deleted after the run and is not committed. Screenshots of the key screens are in [evidence/demo/](evidence/demo/).

**Demo data.** The cross-campus hackathon, the closed program, the demo guide and the submitted hackathon are local fixtures, all labelled "(local fixture)" and "Demo". The ingested McGill event is real: it came from the P1-07 Apify producer run against this stack. Edge-test delivery rows (producer `unknown`) were deleted before the walkthrough so the ingestion page shows only the real run.

## Walkthrough (milestone demo script)

| Step | Observed |
|---|---|
| Guest home, 1280 px and 360 px | The editorial hero, "Browse opportunities" / "This week", an honest "Nothing checked for this week yet" state, type links, a resources section and the company and submit CTAs. There is no Talent, apply or Weekly Drop copy. At 360 px `scrollWidth` is 360, so there is no horizontal scroll. |
| Discover → Type: Hackathons → open listing → Back | Filter URL `/discover?type=hackathon`. Back returned to the same filtered URL. |
| Student signs in, saves, opens `/saved` | "Saved to your shortlist". `/saved` lists the new hackathon and the legacy saved event together. |
| Resource | An admin created and published a guide through the API (201/200). It renders at 360 px. |
| Guest submission → moderation | The `/submit` form sent; the receipt shows no ID. In `/moderation/submissions` the private contact is visible to the admin; Convert to draft, then Open draft. Setting relevance, the review date and "Mark source checked now", then Save and Publish, returned 200/200. The listing then appears on `/discover` for a guest. |
| Real ingested McGill event | `GET /api/admin/ingestion` returned 200: last success, last failure `apify_http_401`, 3 deliveries, 6 stale pending. The admin approved the one upcoming ingested event (200). "Persist images" rehosted its Instagram image into local `event-images` storage. "Reject as expired" on a past-dated item returned 200. The event appears on `/discover` with "Automatically indexed" provenance. |
| Closed listing | "This opportunity has closed. Explore the feed for what's next." There are zero links to the action URL. Save shows only a sign-in prompt. |

## Findings

1. **Event times disagree on the same page (pre-existing legacy display defect, made visible by M3).**
   - Legacy events store Toronto wall-clock time labelled as UTC (DEC-80). The create form comments "wall-clock EST stored as UTC", and the webhook uses a UTC runtime with `setHours`.
   - The discovery view converts once and shows the real post's time correctly: "Oct 1, 2026, 11:59 p.m. EDT", matching the post's "Apply by Oct 1, 11:59 PM".
   - The legacy formatters (`formatTimeFromISO` via `parseISO` in the viewer's local zone) read the same value as true UTC. They show "7:59 PM" in the event detail sidebar, and "2:00 PM" where discovery shows "6:00 p.m." for the seed event.
   - On the switch-on event detail page, both appear together. The new ingestion page's stale list also uses local formatting.
   - Routed to the final fix wave for M3 surfaces. The switch-off legacy formatters are an owner decision (see REPORT).
2. **The editor discards edits made before a preselected draft loads.**
   - On `/moderation/opportunities?id=…`, edits made before the record fetch resolves are overwritten when it arrives. Save then returns 200 with unchanged data, and Publish fails with "Publication requires a checked source".
   - A person rarely types that fast, but it fails silently. Routed to the final fix wave.
3. **Supply quality.**
   - Of the 6 real ingested items, 5 were already past-dated. Several are recruitment posts ("Apply by …") that the heuristic classifier treated as events.
   - Moderation handled them correctly (stale queue, reject as expired). This is recorded as a producer-quality limitation, not fixed in M3.

The screenshot of the opportunity detail taken during client navigation showed the loading skeleton. That was script timing: the same detail rendered fully in the closed-listing step and in the acceptance suite. The moderation sidebar drawn at the bottom of the full-page editor capture is how full-page capture renders a sticky element, not a layout defect.

## Resolution (final fix wave)

- Finding 1: fixed on the M3 surfaces in `004e1c9`. The stale and past rules, the ingestion page and the switch-on event detail sidebar now follow DEC-80; see [docs/time-semantics.md](../../../docs/time-semantics.md). The switch-off legacy formatters remain an owner decision ([REPORT](REPORT.md)).
- Finding 2: fixed in `bf4994e`. The form is disabled until the preselected record loads, the unsaved-changes check reads a ref, and `?id=` is fetched directly.
- Finding 3: recorded as a residual limitation in the [REPORT](REPORT.md).
