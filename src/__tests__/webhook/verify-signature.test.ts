/**
 * verifySignature — the events-webhook credential check as a pure module
 * (plan 06-03 Task 2, F-039, DEC-64, threat T-06-03-02).
 *
 * PRESERVE: this suite pins the behaviour the F-039 fix must keep — every
 * bad signature, whatever its length, answers false without throwing.
 *
 * Today's handler (supabase/functions/events-webhook/index.ts:45-53) hands the
 * supplied signature straight to crypto.timingSafeEqual, which THROWS a
 * RangeError when the two buffers differ in length. The outer catch turns that
 * into a 500, so a wrong-length signature is distinguishable from a wrong one
 * (401) — a length oracle. verifySignature compares byte lengths first and
 * answers false, so every bad signature is the same 401.
 *
 * The comparison stays over the UTF-8 bytes of the hex strings, exactly as
 * today's Buffer.from(signature) does: an upper-case rendering of the correct
 * digest is NOT accepted (slice-6-characterization § 3 row 4).
 */
import { createHmac } from "node:crypto";

import { verifySignature } from "../../../supabase/functions/_shared/webhook-signature";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({
  event_count: 1,
  events: [{ title: "T", description: "D", date: "2030-01-01", location: "L" }],
});

function hmacHex(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const DIGEST = hmacHex(BODY, SECRET);

/** The correct digest with its first hex character changed: same length, wrong value. */
function flipFirst(hex: string): string {
  return (hex[0] === "a" ? "b" : "a") + hex.slice(1);
}

describe("verifySignature: accepts the correct HMAC", () => {
  it("accepts the bare lower-case hex HMAC-SHA256 of the raw body", () => {
    expect(verifySignature(BODY, DIGEST, SECRET)).toBe(true);
  });

  it("accepts the sha256=-prefixed form (the x-hub-signature-256 shape the handler accepts today)", () => {
    expect(verifySignature(BODY, `sha256=${DIGEST}`, SECRET)).toBe(true);
  });
});

describe("verifySignature: rejects a wrong signature of the right length", () => {
  it("rejects a 64-character signature that does not match", () => {
    const wrong = flipFirst(DIGEST);
    expect(wrong).toHaveLength(64);
    expect(verifySignature(BODY, wrong, SECRET)).toBe(false);
  });

  it("rejects the upper-case rendering of the correct digest (byte comparison, as today)", () => {
    expect(verifySignature(BODY, DIGEST.toUpperCase(), SECRET)).toBe(false);
  });

  it("rejects the correct digest of a different body (tampered payload)", () => {
    expect(verifySignature(`${BODY} `, DIGEST, SECRET)).toBe(false);
  });

  it("rejects the digest computed with a different secret", () => {
    expect(verifySignature(BODY, hmacHex(BODY, "other-secret"), SECRET)).toBe(false);
  });
});

describe("verifySignature: a wrong LENGTH is false, never a throw (F-039, today a 500)", () => {
  const rows: Array<[string, string]> = [
    ["shorter", "abc"],
    ["one character short", DIGEST.slice(1)],
    ["longer", `${DIGEST}00`],
    ["the prefix alone", "sha256="],
    ["empty", ""],
    ["multi-byte characters of the right character count", "é".repeat(64)],
  ];

  it.each(rows)("%s -> false without throwing", (_label, header) => {
    expect(() => verifySignature(BODY, header, SECRET)).not.toThrow();
    expect(verifySignature(BODY, header, SECRET)).toBe(false);
  });

  it("a null header -> false without throwing", () => {
    expect(() => verifySignature(BODY, null, SECRET)).not.toThrow();
    expect(verifySignature(BODY, null, SECRET)).toBe(false);
  });
});

describe("verifySignature: an empty secret never verifies", () => {
  it("rejects even the digest correctly computed with the empty secret", () => {
    expect(verifySignature(BODY, hmacHex(BODY, ""), "")).toBe(false);
  });
});
