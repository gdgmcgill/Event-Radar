import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { log } from "@/server/log";
import { clientIp } from "@/server/ratelimit/policy";

/** Used only when INTAKE_HASH_SECRET is unset outside a hosted deploy (local
 * development and tests). It is public, so it must never key a hosted quota. */
const LOCAL_SALT = "uni-verse-local-intake-salt";
let warned = false;

/** Thrown on a hosted runtime (VERCEL set) with no INTAKE_HASH_SECRET: the
 * intake routes answer 503 rather than key quotas with the public salt. */
export class IntakeNotConfigured extends Error {
  constructor() {
    super("intake hash secret not configured");
    this.name = "IntakeNotConfigured";
  }
}

/**
 * The intake quota key: hex HMAC-SHA256 of the client address keyed by
 * INTAKE_HASH_SECRET. The raw address is never stored; without the secret the
 * hash cannot be recomputed from a guessed address.
 */
export function clientHash(request: NextRequest): string {
  const secret = process.env.INTAKE_HASH_SECRET;
  if (!secret && process.env.VERCEL) throw new IntakeNotConfigured();
  if (!secret && process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    log.warn("intake hash secret not configured", { scope: "intake" });
  }
  return createHmac("sha256", secret || LOCAL_SALT).update(clientIp(request)).digest("hex");
}
