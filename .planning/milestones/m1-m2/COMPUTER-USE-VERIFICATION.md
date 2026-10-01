# M1–M2 computer-use verification

Observed September 29, 2026 (UTC and America/Toronto), using Chrome through the computer-use tool against a guarded local production build at `http://localhost:3000`. Email was captured by local Mailpit at port 54324. No external email or provider console was used.

## Observed flows

1. Guest discovery rendered legacy approved events, filters, source/relevance language and sign-in controls.
2. Email sign-in sent a real locally captured code to a synthetic non-institutional address. A wrong code produced a retryable invalid/expired error. The first valid verification completed its server callback but the persistent browser subsequently appeared signed out. This was investigated separately rather than recorded as a pass.
3. Local seeded admin login succeeded. In the Opportunities editor, a source URL prefilling the title/slug/organization was reviewed, a synthetic hackathon's title/description/location/eligibility/fields/curator note were entered, the source was marked checked, and a date-only October 15, 2030 deadline was set. Draft preview, save and publish worked. **50.844 seconds** elapsed from source entry to observed published status, including computer-use round trips; this excludes real source research.
4. Published detail showed the original source, checked date, eligibility, cross-campus disclaimer, organizer action, curator note and date-only America/Toronto deadline correctly. The listing was explicitly labeled a local synthetic demo, not a real offer.
5. Saved the opportunity and an existing legacy event; both appeared together in the private shortlist. Navigating immediately after Save exposed a stale first read; the implementation now refreshes Saved after an outstanding write finishes, with a focused regression.
6. Used native Chrome zoom controls to confirm **200%**, inspected discovery and opened its collapsed navigation. Controls remained reachable and content reflowed. Restored zoom to 100%. Separate automated evidence covers 360 px keyboard navigation, light/dark parity, filters and no horizontal overflow.
7. Signed out of the admin account, requested and entered another real email code for the synthetic reader, and observed retained Saved/Profile navigation. Completed the short profile with a display name and Concordia choice. The reader's shortlist was empty and did not expose the admin's two saves.
8. Closed only the two task-created Chrome tabs. Synthetic database records and saves were removed using exact local identities.

## Findings and scope

The first-sign-in persistent-browser anomaly was reproduced deterministically by holding the callback for four seconds. The client had exposed authenticated navigation before `public.users` existed, and link prefetch triggered the missing-profile signout boundary. The client now waits for profile synchronization; the proxy's security boundary remains unchanged. The final real local OTP regression passes with that artificial delay, wrong-code rejection, a new account, signout and a returning account. Four store tests cover profile-pending and stale-account responses. See the implementation report for final evidence.

Other fixes during verification/review include late saved-status reads, stale saved-list retry snapshots, save completion after navigation, optional location clearing, controlled field entry on Enter, mobile sign-in width, and profile terminology.

Google's external provider flow and hosted email deliverability were not exercised. The automated reflow screenshot is an equivalent CSS viewport, not itself a native zoom capture; the native 200% observation above is separate. This verification does not claim a full accessibility audit or a representative owner usability study.
