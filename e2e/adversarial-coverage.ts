/** CERT-02 traceability, not a claim that a listed test has passed.
 * The run report must cite executable results separately. Local browser tests
 * use their own disposable namespace; generated fixture ids are not loaded.
 */
export const ADVERSARIAL_COVERAGE: Record<string, { evidence: string; limit?: string }> = {
  'null-body': { evidence: 'supabase/functions/tests/webhook.test.ts: DI-83: null envelope returns 400' },
  'null-event': { evidence: 'supabase/functions/tests/webhook.test.ts: DI-83: null event returns 400' },
  'numeric-tags': { evidence: 'supabase/functions/tests/webhook.test.ts: DI-83: non-string tag returns 400' },
  ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`injection-${i}`, { evidence: 'adversarial-certification.spec.ts: injection-0..4' }])),
  ...Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`unsafe-link-${i}`, { evidence: 'adversarial-certification.spec.ts: unsafe-link-0..2' }])),
  'duplicate-content': { evidence: 'supabase/functions/tests/webhook.test.ts: Replayed payload is reported as duplicate, not inserted again' },
  'duplicate-rsvp': { evidence: 'adversarial-certification.spec.ts: duplicate-rsvp and duplicate-save' },
  'duplicate-save': { evidence: 'adversarial-certification.spec.ts: duplicate-rsvp and duplicate-save', limit: 'Save POST intentionally toggles; uniqueness is verified against the real database constraint, not asserted as HTTP idempotency.' },
  'duplicate-invitation': { evidence: 'adversarial-certification.spec.ts: expired-invite and duplicate-invitation' },
  'spring-gap': { evidence: 'adversarial-certification.spec.ts: spring-gap and fall-repeat', limit: 'UI displays minutes, so the second immediately before transition is displayed as 1:59 AM.' },
  'fall-repeat': { evidence: 'adversarial-certification.spec.ts: spring-gap and fall-repeat' },
  'expired-event': { evidence: 'adversarial-certification.spec.ts: expired-event' },
  'expired-invite': { evidence: 'adversarial-certification.spec.ts: expired-invite and duplicate-invitation' },
  'cross-club-write': { evidence: 'adversarial-certification.spec.ts: cross-club-write and cross-user-notification', limit: 'PATCH club update; broader role/route matrix is a separate certification suite.' },
  'cross-user-notification': { evidence: 'adversarial-certification.spec.ts: cross-club-write and cross-user-notification' },
  'non-mcgill-oauth': { evidence: 'src/app/auth/callback/route.test.ts: non-McGill callback rejection', limit: 'Provider exchange is mocked. Real Google OAuth admission remains an external human/provider verification gap.' },
  'forged-cookie': { evidence: 'adversarial-certification.spec.ts: forged-cookie' },
  'metadata-role': { evidence: 'adversarial-certification.spec.ts: metadata-role', limit: 'Writes user-editable metadata using guarded local admin setup; live route uses the existing student session and current user lookup.' },
  'svg-script': { evidence: 'adversarial-certification.spec.ts: svg-script, mime-mismatch and oversize-upload' },
  'mime-mismatch': { evidence: 'adversarial-certification.spec.ts: svg-script, mime-mismatch and oversize-upload', limit: 'Checks MIME/magic agreement; not full image decoding or malware scanning.' },
  'oversize-upload': { evidence: 'adversarial-certification.spec.ts: svg-script, mime-mismatch and oversize-upload', limit: 'Uses actual 2 MiB + 1 route boundary rather than the catalog 100 MiB allocation.' },
  'rate-burst': { evidence: 'adversarial-certification.spec.ts: rate-burst and unbounded-limit', limit: '35 requests exercise the configured 30/min mutation budget; sustained 1000-request load is covered separately by k6.' },
  'unbounded-limit': { evidence: 'adversarial-certification.spec.ts: rate-burst and unbounded-limit; src/__tests__/api/recommendations/m0-recommendations-hardening.test.ts: top_k query bounds', limit: 'The generic catalog limit maps to this route’s top_k parameter. Route clamps to 50 rather than returning400; browser verifies bounded results and unit test verifies database query limit.' },
};
