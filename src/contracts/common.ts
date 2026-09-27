/**
 * Rules shared by the contracts in src/contracts/ (plan 06-04, REFAC-15,
 * DEC-65).
 *
 * Every helper takes the message the caller's handler answers today and uses
 * it for EVERY way the value can be wrong (missing, wrong type, wrong format),
 * so a contract reproduces one route's 400 text exactly. None of them trims,
 * pads or otherwise rewrites a string the handler then reads, except Uuid
 * and CanonicalId, which lower-case so id comparisons are canonical (DEC-66).
 */
import { z } from "zod";
import { isValidISODate } from "@/lib/dateValidation";

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A canonical 8-4-4-4-12 hex UUID in any case, output in lower case. No
 * version or variant check: seeded and test ids are not all RFC 4122 v4.
 */
export function Uuid(message: string) {
  return z
    .string({ error: message })
    .regex(CANONICAL_UUID, { error: message })
    .transform((value) => value.toLowerCase());
}

/**
 * A route id that a handler compares with the caller's own id (DI-64, DEC-66,
 * plan 06-10). A UUID-shaped string in any case is lower-cased, so the admin
 * self-checks (ban, role change) compare canonical ids: Postgres matches a
 * uuid in any case, so an own id sent in upper case used to pass the string
 * compare and reach the write. Any other string passes through unchanged and
 * is never refused: no route gains a 400 for a malformed id (the lookup
 * answers it, as before).
 */
export const CanonicalId = z
  .string()
  .transform((value) =>
    CANONICAL_UUID.test(value) ? value.toLowerCase() : value
  );

/**
 * An ISO-8601 date or date-time string, by the same test the event forms and
 * handlers already use (src/lib/dateValidation.ts isValidISODate), including
 * its calendar check (2026-02-31 is refused).
 */
export function IsoDateString(message: string) {
  return z.custom<string>((value) => isValidISODate(value), {
    error: message,
  });
}

/**
 * A string with at least one non-whitespace character. A non-string, an empty
 * string and a whitespace-only string all answer `message`. The output is the
 * string as sent; a handler that stored `value.trim()` still trims.
 */
export function NonEmptyTrimmedString(message: string) {
  return z.custom<string>(
    (value) => typeof value === "string" && value.trim().length > 0,
    { error: message }
  );
}

/** The project's error body: `{ error }`, with `field` only where named (C10). */
export const ErrorBody = z.object({
  error: z.string(),
  field: z.string().optional(),
});

export type ErrorBody = z.infer<typeof ErrorBody>;
