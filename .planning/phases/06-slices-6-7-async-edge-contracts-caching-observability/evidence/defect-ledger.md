# Defect ledger — Phase 6

**Plan:** 06-01 · **Phase:** 06-slices-6-7-async-edge-contracts-caching-observability · **Recorded:** 2026-09-25

Opened by plan 06-01, before any Phase 6 fix exists. There is one row per DEFECT assertion that moved
because the defect it pinned was deliberately fixed. Each row's assertions move in the same commit as
the fix. The finding's status and resolution in `.planning/audit/findings.json` are edited by the
fixing plan or its slice-close plan (DEC-72, extending DEC-57), not here.

**Characterization tags are file-level** (`scripts/check-characterization-tags.mjs` reads only the
leading docblock). So a pin that must change and lives in a PRESERVE file is first **moved** into a new
`<name>-defect.test.ts` whose docblock says `DEFECT` and cites its F-nnn. The move happens in the same
commit as the fix, and it gets a row below with "moved out of PRESERVE" in the Old assertion cell. A
PRESERVE file is never edited to make it pass.

**Which finding a move cites in Phase 6.**
- A 400 whose bytes move because a contract now parses the input (an invalid or non-object body, a
  non-string field, a canonicalized UUID, the one club-link rule) cites **F-094** (DEC-65, DEC-66).
- A console assertion whose shape moves because the line now goes through the JSON logger, and a 500
  body that becomes `{ "error": "Failed to <action>" }` on an uncaught throw, cite **F-058** (DEC-73,
  DEC-74). Exact-argument console assertions in plain (untagged) tests are edited in place and need no
  row.
- A response body that stops carrying a caught error's text cites **F-059** (DEC-75).
- A Cache-Control header that changes cites **F-025** or **F-026** (DEC-73); a CSP header cites
  **F-055** (DEC-77); the health shape cites **F-029** (DEC-78); a page gate cites **F-054** (DEC-79);
  the webhook's 401 on a wrong-length signature cites **F-039** (DEC-64); the reminder filters cite
  **F-093** (DEC-70); the others cite the finding their fix commit names.

Protocol followed for every row:

1. Apply the fix.
2. Run the DEFECT suite unedited. It must go **red**: the before-assertions fail against the fixed
   code.
3. Move the assertions to the fixed shape. The suite must go **green**.
4. Put the pre-fix source back temporarily and run the moved suite. It must go **red**: the
   after-assertions fail against the defect. Then restore the fixed source and prove it is
   byte-identical with `cmp`.
5. The PRESERVE suites covering the same surface pass **unedited** throughout.

Commit hashes are filled in by the commit that follows each fix, because a commit cannot name its own
hash. Every row belongs to an `INTENTIONAL BEHAVIOUR CHANGE` commit, and that commit's body carries the
same words.

| F-nnn | Suite | Old assertion | New assertion | Commit | Plan |
|---|---|---|---|---|---|
| F-039 | `src/__tests__/webhook/webhook-handler.test.ts` (new; row 5) | slice-6-characterization.txt § 3 row 5: a wrong-length signature (e.g. `abc`, the digest with `sha256=` left on in `x-signature`) answers **500** `{"error":"Internal server error"}` — `timingSafeEqual` throws on unequal lengths | **401** `{"error":"Invalid signature"}` for every wrong-length signature (8 cases), nothing inserted; `verifySignature` length-checks first (mutation M1 in evidence/webhook.txt turns the 6 non-prefixed rows red) | `239b7cd` | 06-03 |
| F-039 | `src/__tests__/webhook/webhook-handler.test.ts` (new; row 16) | slice-6-characterization.txt § 3 row 16: the same correctly signed body sent twice answers **200 twice** and inserts a **second set** of pending rows (no `content_hash`, and `idx_events_content_hash` is partial) | the replay reports **each event `duplicate`** (all replayed → 400 "Failed to process all events"; mixed → 207) and **one stored row per event**; rows carry `content_hash` (mutation M2 turns the 6 hash rows red) | `239b7cd` | 06-03 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (matrix: interactions, not-json) | **500** `{"error":"Internal server error"}` (the raw `request.json()` throws inside the `try`) | **400** `{"error":"Invalid JSON body"}` (`parseBody` + `InteractionBody`), no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (matrix: interactions, array) | **400** `{"error":"event_id and interaction_type are required"}` (an array read as an object with no keys) | **400** `{"error":"Request body must be a JSON object"}`, no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (matrix: feedback, not-json) | **500** `{"error":"Internal server error"}` | **400** `{"error":"Invalid JSON body"}` (`parseBody` + `FeedbackBody`), no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (matrix: feedback, array) | **400** `{"error":"Message is required"}` | **400** `{"error":"Request body must be a JSON object"}`, no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (matrix: recommendations/feedback, not-json) | **500** `{"error":"Failed to submit feedback"}` | **400** `{"error":"Invalid JSON body"}` (`parseBody` + `RecommendationFeedbackBody`), no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (matrix: recommendations/feedback, array) | **400** `{"error":"Missing required fields: event_id, recommendation_rank, action"}` | **400** `{"error":"Request body must be a JSON object"}`, no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (beyond: interactions, JSON null) | **500** `{"error":"Internal server error"}` (`body.event_id` on null) | **400** `{"error":"Request body must be a JSON object"}`, no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (beyond: feedback, JSON null) | **500** `{"error":"Internal server error"}` (destructuring null) | **400** `{"error":"Request body must be a JSON object"}`, no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (beyond: recommendations/feedback, JSON null) | **500** `{"error":"Failed to submit feedback"}` (`"feedback" in null`) | **400** `{"error":"Request body must be a JSON object"}`, no write | 06-04 Task 2 (see below) | 06-04 |
| F-094 | `src/__tests__/api/slice6-malformed-input-defect.test.ts` (beyond: feedback, numeric `subject`) | **500** `{"error":"Internal server error"}` (`subject.trim` is not a function) | **400** `{"error":"Subject must be a string"}` (new text: none existed to keep), no write | 06-04 Task 2 (see below) | 06-04 |
| F-028 | `src/__tests__/api/notifications/notifications-count-defect.test.ts` (D1: anonymous) | **200** `{"unread_count":0}`, no notifications read | **401** `{"error":"Unauthorized"}` (`createRequestContext` + `requireUser`), no notifications read | 06-04 Task 2 (see below) | 06-04 |
| F-028 | `src/__tests__/api/notifications/notifications-count-defect.test.ts` (D2: `getUser` auth error) | **200** `{"unread_count":0}`, no notifications read | **401** `{"error":"Unauthorized"}`, no notifications read | 06-04 Task 2 (see below) | 06-04 |
