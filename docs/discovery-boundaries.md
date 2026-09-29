# Discovery and curation boundaries (M2)

The public identity is `(kind,id)`. Events remain in `events`; the additive opportunity table does not replace event RSVP, calendar, saved-event, or moderation history. Legacy event relevance defaults to McGill because this dataset originated in the McGill-only product. This is relevance, not verified university affiliation or eligibility. New records default to unknown relevance until an editor chooses a specific audience or cross-campus scope.

## Dates and ordering

Opportunity instants use UTC `timestamptz`; deadline precision, original calendar date, source timezone, and whether that timezone was assumed are retained separately. A date-only deadline closes at the *next* midnight in its stated timezone, including DST changes. An exact timestamp closes at that instant. Items without a deadline or event end require an explicit future review time before publishing.

Legacy event timestamps follow DEC-80: the stored UTC-labelled value encodes Toronto wall-clock time. The discovery view converts that wall-clock value to an instant once; storage and existing event readers are unchanged. An event stays upcoming until its end even when an optional registration deadline has passed. Its actionable date can still be the registration deadline.

The invoker SQL projection filters approved/nondeleted events and published/nondeleted opportunities independently of any broader admin RLS. SQL applies all feed filters before the bounded page limit. Order is editorial priority descending, actionable time ascending, publication descending, kind, UUID. A versioned cursor binds that order, a fixed `as_of`, and the normalized filter hash. Saved cursors additionally bind the verified user. Cursors expire after 24 hours; malformed/mismatched cursors return 400. `as_of` excludes later publications and stabilizes expiry; it is not a historical snapshot of concurrent editorial edits. Stable-dataset pagination is covered by pgTAP.

## Publication and duplicates

Normal active admins can curate. The server compares the authenticated ID to `CURATOR_USER_ID` before authorizing changes to Pick state, reason, or editorial priority. An unset curator ID fails closed. RPCs accept only the service role, repeat the actor/ban check, lock and verify the reviewed version, and write the listing and audit in one transaction. The audit is the authoritative Pick history: actor/time, before/after Pick state/reason/priority, changed fields, and private duplicate-review notes.

Duplicate candidates match a normalized source URL or an exact title+organization+occurrence-time tuple. Same-title recurring editions at different times are not automatically collapsed. Candidates are capped at 50 and exposed only through the admin API. Publication requires an explicit review note when matches exist. A narrow, noncallable definer trigger applies the same check to legacy event approval/create paths, since legacy cookie writers must not receive access to private review notes. The trigger returns no private data and performs no elevated writes.

Manual merges require a visible canonical target. An unpublished draft cannot become a public alias. Published aliases retain canonical resolution, disappear from discovery, and preserve original saved identities. Inbound aliases are flattened transactionally. A hidden/deleted canonical target is not exposed by the detail service.

## Privacy and caches

Every new API response currently uses `private, no-store`, including public discovery. This conservative first release prevents admin-preview responses from entering shared caches and makes archive/edit changes visible on the next fetch with a zero CDN stale window. No `is_saved` or other account state is part of the public projection. `/api/saved/status` accepts at most 50 identities, and `/api/saved` joins only the verified caller's two save authorities. New PUT saves are idempotent; the old event POST toggle remains for compatibility.

Public column grants exclude draft fields, moderation notes and actor identities. Public querying uses the cookie client and an invoker view/RPC; elevated reads are limited to guarded editorial routes. Native opportunity applications remain unavailable: M2 authoring accepts only `external` or explicit `none` application modes.

## Evidence

- `supabase/tests/database/100-public-table-rls-matrix.test.sql`: actual-role coverage for all 36 current public tables.
- `120-discovery-functional.test.sql`: publication/merge/duplicate/Pick/privacy/save/DST/legacy-date controls.
- `125-discovery-pagination.test.sql`: cross-kind equal-date/null-deadline pagination and fixed browse time.
- `src/__tests__/contracts/discovery.test.ts` and `src/server/discovery/__tests__/cursor.test.ts`: bounded inputs and cursor trust boundary.
- `.planning/milestones/m2/evidence/discovery-explain.txt`: anon EXPLAIN against 10,000 transactional fixtures, rolled back after measurement. This is local evidence, not production latency or deployment certification.
