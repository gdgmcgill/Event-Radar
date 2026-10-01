/**
 * verifySignature — the events-webhook credential check (plan 06-03, F-039,
 * DEC-64).
 *
 * Shared by the Deno edge function and Jest, so it imports only `node:crypto`
 * (Deno's Node compatibility layer and Node both provide it) and uses no Deno
 * global and no Buffer.
 *
 * The HMAC-SHA256 of the RAW request body, hex-encoded, is the only gate on a
 * function deployed with verify_jwt off. The comparison is over the UTF-8
 * bytes of the two hex strings, exactly as the handler's
 * Buffer.from(signature) did before this module existed, so an upper-case
 * rendering of the correct digest is still rejected.
 *
 * THE LENGTH CHECK COMES FIRST. crypto.timingSafeEqual throws a RangeError on
 * buffers of unequal length; the old handler let that throw reach its outer
 * catch and answer 500, so a wrong-length signature was distinguishable from
 * a wrong one (401). Returning false on a length mismatch makes every bad
 * signature the same 401. The length of the expected digest is public (64),
 * so the early return leaks nothing.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** The prefix GitHub-style senders put on x-hub-signature-256. */
const SHA256_PREFIX = "sha256=";

/**
 * Does `header` carry the hex HMAC-SHA256 of `rawBody` under `secret`?
 *
 * @param rawBody - the request body exactly as received, before JSON parsing
 * @param header - the supplied signature, bare hex or `sha256=`-prefixed; null when absent
 * @param secret - the shared webhook secret; an empty secret never verifies
 * @returns true only for the correct digest; false for anything else, without throwing
 */
export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string
): boolean {
  if (!header || !secret) return false;

  const supplied = header.startsWith(SHA256_PREFIX)
    ? header.slice(SHA256_PREFIX.length)
    : header;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const encoder = new TextEncoder();
  const suppliedBytes = encoder.encode(supplied);
  const expectedBytes = encoder.encode(expected);

  if (suppliedBytes.byteLength !== expectedBytes.byteLength) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}
