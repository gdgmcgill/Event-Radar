/**
 * The rate-limit store contract (plan 05-17, DEC-50, REFAC-18).
 *
 * The policy (`./policy.ts`) decides the key, the budget and the window. A
 * store only counts: it records one hit against `key` and says whether that
 * hit fits in `limit` for the current `windowMs` window. Keeping the contract
 * this narrow is what lets a distributed store (05-18's Upstash
 * implementation) replace the in-process one without the policy, the 429
 * builder or the proxy changing.
 */

/** One hit's outcome. `resetAtMs` is the epoch millisecond the window ends. */
export type RateDecision = {
  allowed: boolean;
  limit: number;
  resetAtMs: number;
};

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number): Promise<RateDecision>;
}
