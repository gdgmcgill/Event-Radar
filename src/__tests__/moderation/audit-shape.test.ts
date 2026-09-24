/**
 * DEFECT characterization — F-072 (read path) and F-073 (write path)
 *
 * Subject: `admin_audit_log.admin_email` — a column that three code paths use
 * and the live schema does not have.
 *
 *   read  `src/app/moderation/page.tsx:80`  selects it inside a Promise.all whose
 *         element is asserted `as Promise<{ data: AuditEntry[] | null }>`.
 *   read  `src/app/moderation/audit-log/page.tsx`  renders it.
 *   write `src/lib/audit.ts:38`  inserts it on every moderation action.
 *
 * How the casts hid it. `(supabase as any)` erased the client type, so the
 * select string was never parsed against the generated Row type; the
 * `as Promise<…>` assertion then declared an awaited shape that nothing checked.
 * The defect the plan named for this site was "the awaited shape is unchecked" —
 * this file is the check that was missing, and what the check found is worse
 * than an unchecked shape: the query does not work at all.
 *
 * Measured against the local stack on 2026-09-15, which plan 03-04 proved is
 * byte-identical to production's schema:
 *
 *   select id, admin_email, …  ->  400  42703  column admin_audit_log.admin_email does not exist
 *   select id, action, …       ->  200  []
 *   insert { admin_email, … }  ->  400  PGRST204  Could not find the 'admin_email' column …
 *   insert { …no admin_email } ->  reaches the FK check, i.e. the shape is accepted
 *
 * So the Recent Activity panel has always rendered its empty state, and every
 * moderation action's audit row has always been rejected — unnoticed, because
 * `logAdminAction` never inspects the result. F-007 already recorded that the
 * table holds zero rows in production; this is why.
 *
 * What this file is and is not: it is a DEFECT test. It pins today's behaviour
 * and is expected to keep passing until the fixing slice lands. It is not a
 * failing test and it is not a fix. The correction — restore the column, or drop
 * it from all three paths — is a behaviour change that belongs to the slice that
 * owns moderation, not to a typing plan.
 *
 * Registered as F-072 and F-073 in .planning/audit/findings.json.
 *
 * Status: FIXED in 05-14 (DEC-46). The column was dropped from all three
 * paths, not added to the schema: the dashboard selects the table's real
 * columns on the typed cookie client (no client cast, no shape assertion) and
 * resolves each actor from `users` by id; `logAdminAction` writes through the
 * elevated door without the column and logs a rejected insert with
 * `console.error`. The rows below that pinned the defect moved to that shape
 * in the fixing commit (evidence/defect-ledger.md); the schema row and the
 * empty-state row did not move.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ─── Mocks ──────────────────────────────────────────────────────────────────

/** Every `.select()` string, keyed by the table it was issued against. */
let selectsByTable: Array<{ table: string; select: unknown }> = [];
/** Every `.insert()` payload, keyed by table and by the client that sent it. */
let insertsByTable: Array<{
  table: string;
  payload: unknown;
  client: "cookie" | "elevated";
}> = [];
/** Every `.in()` filter, keyed by table. */
let inFilters: Array<{ table: string; column: unknown; values: unknown }> = [];
/** Per-table resolved result. */
let tableResults: Map<string, { data: unknown; error: unknown; count: number | null }>;

function createMockBuilder(table: string, client: "cookie" | "elevated") {
  const resolved = tableResults.get(table) ?? { data: [], error: null, count: 0 };
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "gt", "is", "order", "limit", "neq", "gte", "lte"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.in = jest.fn((column: unknown, values: unknown) => {
    inFilters.push({ table, column, values });
    return builder;
  });
  builder.select = jest.fn((select: unknown) => {
    selectsByTable.push({ table, select });
    return builder;
  });
  builder.insert = jest.fn((payload: unknown) => {
    insertsByTable.push({ table, payload, client });
    return builder;
  });
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve);
  return builder;
}

/** The cookie client (`@/lib/supabase/server`). */
const mockSupabase = {
  from: jest.fn((table: string) => createMockBuilder(table, "cookie")),
};

/** The elevated client (`@/lib/supabase/service`, reached through the door). */
const mockElevatedSupabase = {
  from: jest.fn((table: string) => createMockBuilder(table, "elevated")),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => mockElevatedSupabase),
}));

/**
 * `next/link` reads the App Router context, which does not exist outside a Next
 * render. Substituting a plain anchor keeps the render honest about everything
 * this file actually asserts — the audit panel's copy — without standing up a
 * router the defect has nothing to do with.
 */
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * The `admin_audit_log` Row block, read out of the GENERATED types file rather
 * than imported, because TypeScript types do not survive to runtime. The file is
 * a product of the migrations (plan 03-06 task 1) and a CI job fails when it
 * stops being one, so reading it is reading the schema.
 */
function adminAuditLogRowBlock(): string {
  const types = readFileSync(
    join(process.cwd(), "src/lib/supabase/types.ts"),
    "utf8"
  );
  const start = types.indexOf("      admin_audit_log: {");
  expect(start).toBeGreaterThan(-1);
  const rowStart = types.indexOf("Row: {", start);
  const rowEnd = types.indexOf("}", rowStart);
  return types.slice(rowStart, rowEnd);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  selectsByTable = [];
  insertsByTable = [];
  inFilters = [];
  tableResults = new Map();
});

const ADMIN_ID = "00000000-0000-0000-0000-00000000a001";

describe("F-072 / F-073 — admin_audit_log.admin_email does not exist (FIXED in 05-14)", () => {
  it("the generated types have no admin_email column, so no migration creates one", () => {
    const row = adminAuditLogRowBlock();

    // The seven columns the table actually has.
    for (const column of [
      "action",
      "admin_user_id",
      "created_at",
      "id",
      "metadata",
      "target_id",
      "target_type",
    ]) {
      expect(row).toContain(column);
    }

    // The one it does not. This assertion flips the day the column is added,
    // which is precisely the validation criterion recorded for F-072/F-073.
    expect(row).not.toContain("admin_email");
  });

  it("fixed: the moderation dashboard selects the table's real columns, no email column", async () => {
    tableResults.set("admin_audit_log", { data: [], error: null, count: null });

    const { default: ModerationDashboardPage } = await import("@/app/moderation/page");
    await ModerationDashboardPage();

    const auditSelect = selectsByTable.find((s) => s.table === "admin_audit_log");
    expect(auditSelect).toBeDefined();
    expect(auditSelect!.select).toBe(
      "id, admin_user_id, action, target_type, target_id, metadata, created_at"
    );
    expect(String(auditSelect!.select)).not.toContain("admin_email");
  });

  it("fixed: the dashboard source carries no client cast and no shape assertion on the audit read", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/moderation/page.tsx"),
      "utf8"
    );
    expect(source).not.toContain("(supabase as any)");
    expect(source).not.toContain("as Promise<");
    expect(source).not.toContain("admin_email");
  });

  it("today's behaviour: the panel renders its empty state, not an error", async () => {
    tableResults.set("admin_audit_log", {
      data: null,
      error: { code: "42703", message: "column admin_audit_log.admin_email does not exist" },
      count: null,
    });

    const { default: ModerationDashboardPage } = await import("@/app/moderation/page");
    const tree = await ModerationDashboardPage();
    const html = renderToStaticMarkup(tree);

    // The page does not throw and does not surface the failure. An operator sees
    // a dashboard that looks healthy and an activity feed that looks quiet.
    expect(html).toContain("Recent Activity");
    expect(html).toContain("No recent activity yet");
  });

  it("fixed: audit rows render with the actor read from users by id on the cookie client", async () => {
    const UNKNOWN_ID = "00000000-0000-0000-0000-00000000b002";
    tableResults.set("admin_audit_log", {
      data: [
        {
          id: "audit-1",
          admin_user_id: ADMIN_ID,
          action: "approved",
          target_type: "event",
          target_id: "00000000-0000-0000-0000-0000000000e1",
          metadata: { event_title: "A Real Event" },
          created_at: new Date().toISOString(),
        },
        {
          id: "audit-2",
          admin_user_id: UNKNOWN_ID,
          action: "rejected",
          target_type: "club",
          target_id: "00000000-0000-0000-0000-0000000000c1",
          metadata: { club_name: "A Real Club" },
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
      count: null,
    });
    tableResults.set("users", {
      data: [{ id: ADMIN_ID, name: "Moderator Name", email: "moderator@mcgill.ca" }],
      error: null,
      count: 0,
    });

    const { default: ModerationDashboardPage } = await import("@/app/moderation/page");
    const tree = await ModerationDashboardPage();
    const html = renderToStaticMarkup(tree);

    // The actor read: users id, name, email, filtered by the distinct actor ids.
    expect(selectsByTable).toContainEqual({ table: "users", select: "id, name, email" });
    expect(inFilters).toContainEqual({
      table: "users",
      column: "id",
      values: [ADMIN_ID, UNKNOWN_ID],
    });

    expect(html).toContain("Moderator Name");
    expect(html).toContain("A Real Event");
    // No users row for the second actor: the first 8 characters of the id.
    expect(html).toContain(UNKNOWN_ID.slice(0, 8));
    expect(html).toContain("A Real Club");
    expect(html).not.toContain("No recent activity yet");
  });

  it("fixed: the audit write carries no email column and goes to the elevated client", async () => {
    const { logAdminAction } = await import("@/lib/audit");

    await logAdminAction({
      adminUserId: "00000000-0000-0000-0000-000000000001",
      action: "approved",
      targetType: "event",
      targetId: "00000000-0000-0000-0000-000000000002",
      metadata: { reason: "looks fine" },
      requestId: "req-1",
    });

    const inserts = insertsByTable.filter((i) => i.table === "admin_audit_log");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].client).toBe("elevated");
    const payload = inserts[0].payload as Record<string, unknown>;

    // Exactly the table's writable columns; the request id is for the log
    // line only and is not a column.
    expect(Object.keys(payload).sort()).toEqual([
      "action",
      "admin_user_id",
      "metadata",
      "target_id",
      "target_type",
    ]);
    expect(payload).toEqual({
      admin_user_id: "00000000-0000-0000-0000-000000000001",
      action: "approved",
      target_type: "event",
      target_id: "00000000-0000-0000-0000-000000000002",
      metadata: { reason: "looks fine" },
    });
  });

  it("fixed: a rejected insert is logged loudly with the request id, and the call still resolves", async () => {
    tableResults.set("admin_audit_log", {
      data: null,
      error: { code: "23503", message: "insert or update violates foreign key constraint" },
      count: null,
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { logAdminAction } = await import("@/lib/audit");

    await expect(
      logAdminAction({
        adminUserId: "00000000-0000-0000-0000-000000000001",
        action: "banned",
        targetType: "user",
        targetId: "00000000-0000-0000-0000-000000000003",
        requestId: "req-2",
      })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[Audit] admin_audit_log insert rejected", {
      action: "banned",
      targetType: "user",
      targetId: "00000000-0000-0000-0000-000000000003",
      requestId: "req-2",
      code: "23503",
      message: "insert or update violates foreign key constraint",
    });
    errorSpy.mockRestore();
  });

  it("an accepted insert logs nothing", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { logAdminAction } = await import("@/lib/audit");

    await logAdminAction({
      adminUserId: "00000000-0000-0000-0000-000000000001",
      action: "approved",
      targetType: "event",
      targetId: "00000000-0000-0000-0000-000000000002",
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
