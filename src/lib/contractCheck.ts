/**
 * The development-only response check (plan 06-11, REFAC-16, DEC-67).
 *
 * A client hook that reads a route's JSON hands it here with the route's
 * response schema from src/contracts/. Outside production the schema is
 * loaded and run with `safeParse`; a response that does not match prints ONE
 * warning, `console.warn("[contract]", label, path, message)`, naming the
 * first issue only. The response body is never printed (T-06-11-01), the
 * check never throws and a loader that fails is swallowed (T-06-11-02), and
 * the hook keeps the data it received either way.
 *
 * ZOD STAYS OUT OF PRODUCTION CLIENT CHUNKS (research A4). This module
 * imports nothing, and a caller passes the schema as a loader,
 * `() => import("@/contracts/<family>").then((m) => m.<Schema>)`, written
 * inside `if (process.env.NODE_ENV !== "production") { ... }`. Next inlines
 * NODE_ENV, so in a production build that branch is dead code: the dynamic
 * import is removed with it and no contract chunk (and no zod) is emitted.
 * The guard inside this function is the second line of defence, for a caller
 * that forgets the first; it returns before the loader is called.
 */

/** One zod issue, as far as this check reads it. */
interface IssueLike {
  path: ReadonlyArray<PropertyKey>;
  message: string;
}

/**
 * A zod schema as this check sees it: anything with a `safeParse`. Declared
 * structurally so that this module needs no import from zod.
 */
export interface ZodTypeLike {
  safeParse(
    input: unknown
  ):
    | { success: true }
    | { success: false; error: { issues: ReadonlyArray<IssueLike> } };
}

/** `events.0.id`, or `(root)` when the body itself is the wrong shape. */
function formatPath(path: ReadonlyArray<PropertyKey> | undefined): string {
  if (!path || path.length === 0) return "(root)";
  return path.map((key) => String(key)).join(".");
}

/**
 * Check `json` against the schema `loadSchema` resolves to, outside
 * production only. Resolves when done; never rejects.
 *
 * @param label - the route, e.g. "GET /api/notifications/count"
 * @param loadSchema - resolves to the route's response schema
 * @param json - the parsed response body the hook received
 */
export async function checkResponseInDev(
  label: string,
  loadSchema: () => Promise<ZodTypeLike>,
  json: unknown
): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  try {
    const schema = await loadSchema();
    const result = schema.safeParse(json);
    if (result.success) return;
    const issue = result.error.issues[0];
    console.warn(
      "[contract]",
      label,
      formatPath(issue?.path),
      issue?.message ?? "response does not match its contract"
    );
  } catch {
    // A development aid must never break the page it runs on.
  }
}
