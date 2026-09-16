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
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ─── Mocks ──────────────────────────────────────────────────────────────────

/** Every `.select()` string, keyed by the table it was issued against. */
let selectsByTable: Array<{ table: string; select: unknown }> = [];
/** Every `.insert()` payload, keyed by table. */
let insertsByTable: Array<{ table: string; payload: unknown }> = [];
/** Per-table resolved result. */
let tableResults: Map<string, { data: unknown; error: unknown; count: number | null }>;

function createMockBuilder(table: string) {
  const resolved = tableResults.get(table) ?? { data: [], error: null, count: 0 };
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "gt", "is", "order", "limit", "in", "neq", "gte", "lte"]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.select = jest.fn((select: unknown) => {
    selectsByTable.push({ table, select });
    return builder;
  });
  builder.insert = jest.fn((payload: unknown) => {
    insertsByTable.push({ table, payload });
    return builder;
  });
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve);
  return builder;
}

const mockSupabase = {
  from: jest.fn((table: string) => createMockBuilder(table)),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => mockSupabase),
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
  tableResults = new Map();
});

describe("DEFECT F-072 / F-073 — admin_audit_log.admin_email does not exist", () => {
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

  it("the moderation dashboard asks for admin_email anyway", async () => {
    tableResults.set("admin_audit_log", {
      // What PostgREST actually answers: no rows, an error the caller drops.
      data: null,
      error: { code: "42703", message: "column admin_audit_log.admin_email does not exist" },
      count: null,
    });

    const { default: ModerationDashboardPage } = await import("@/app/moderation/page");
    await ModerationDashboardPage({} as any);

    const auditSelect = selectsByTable.find((s) => s.table === "admin_audit_log");
    expect(auditSelect).toBeDefined();
    expect(String(auditSelect!.select)).toContain("admin_email");
  });

  it("today's behaviour: the panel renders its empty state, not an error", async () => {
    tableResults.set("admin_audit_log", {
      data: null,
      error: { code: "42703", message: "column admin_audit_log.admin_email does not exist" },
      count: null,
    });

    const { default: ModerationDashboardPage } = await import("@/app/moderation/page");
    const tree = await ModerationDashboardPage({} as any);
    const html = renderToStaticMarkup(tree);

    // The page does not throw and does not surface the failure. An operator sees
    // a dashboard that looks healthy and an activity feed that looks quiet.
    expect(html).toContain("Recent Activity");
    expect(html).toContain("No recent activity yet");
  });

  it("the awaited shape was never checked — rows of any shape render unchallenged", async () => {
    // The `as Promise<{ data: AuditEntry[] | null }>` assertion asserts a shape
    // rather than verifying one. Feed it a row and the page renders it, because
    // nothing between the query and the JSX inspects what arrived.
    tableResults.set("admin_audit_log", {
      data: [
        {
          id: "audit-1",
          admin_email: "someone@mcgill.ca",
          action: "approved",
          target_type: "event",
          metadata: { event_title: "A Real Event" },
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
      count: null,
    });

    const { default: ModerationDashboardPage } = await import("@/app/moderation/page");
    const tree = await ModerationDashboardPage({} as any);
    const html = renderToStaticMarkup(tree);

    expect(html).toContain("someone");
    expect(html).toContain("A Real Event");
    expect(html).not.toContain("No recent activity yet");
  });

  it("every audit write carries admin_email, so every audit write is rejected", async () => {
    const { logAdminAction } = await import("@/lib/audit");

    await logAdminAction({
      adminUserId: "00000000-0000-0000-0000-000000000001",
      adminEmail: "someone@mcgill.ca",
      action: "approved",
      targetType: "event",
      targetId: "00000000-0000-0000-0000-000000000002",
      metadata: { reason: "looks fine" },
    });

    const insert = insertsByTable.find((i) => i.table === "admin_audit_log");
    expect(insert).toBeDefined();
    const payload = insert!.payload as Record<string, unknown>;

    // The payload names a column the schema does not have. Against the real
    // database this is PGRST204 and the row never lands; `logAdminAction` does
    // not read the result, so the caller is told nothing.
    expect(Object.keys(payload).sort()).toEqual([
      "action",
      "admin_email",
      "admin_user_id",
      "metadata",
      "target_id",
      "target_type",
    ]);
    expect(adminAuditLogRowBlock()).not.toContain("admin_email");
  });

  it("logAdminAction inspects nothing, which is why this went unnoticed", async () => {
    tableResults.set("admin_audit_log", {
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'admin_email' column" },
      count: null,
    });

    const { logAdminAction } = await import("@/lib/audit");

    // Resolves. No throw, no return value, no signal of any kind.
    await expect(
      logAdminAction({
        adminUserId: "00000000-0000-0000-0000-000000000001",
        action: "banned",
        targetType: "user",
        targetId: "00000000-0000-0000-0000-000000000003",
      })
    ).resolves.toBeUndefined();
  });
});
