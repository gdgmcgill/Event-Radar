/**
 * The server-console census gate (plan 06-12, REFAC-20, F-059, DEC-74,
 * DEC-75).
 *
 * scripts/check-server-console.mjs is run as CI runs it, against fixture
 * trees written under the OS temp directory, through its --root and
 * --allowlist flags. Two rules:
 *   S1  a console call in server scope (route files, src/server/**, the proxy,
 *       instrumentation, the Sentry server config, audit.ts, tagMapping.ts,
 *       and Server Component pages and layouts);
 *   S2  a line in a route file that carries a caught error's `.message`
 *       (dateError.message excepted).
 * The gate is only worth having if an unlisted site fails it, so the red
 * cases come first (T-06-12-05).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../../../scripts/check-server-console.mjs");

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface Entry {
  file: string;
  rule: string;
  count: number;
  reason?: string;
}

const roots: string[] = [];

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "check-server-console-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

function run(root: string, allowlist: unknown, extra: string[] = []): RunResult {
  const list = join(root, "allowlist.json");
  writeFileSync(list, JSON.stringify(allowlist, null, 2));
  try {
    const stdout = execFileSync(
      "node",
      [SCRIPT, "--root", root, "--allowlist", list, ...extra],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { status: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const lines = (...text: string[]) => [...text, ""].join("\n");

const CONSOLE_ROUTE = lines(
  'import { NextResponse } from "next/server";',
  "export async function GET() {",
  '  console.error("Error fetching:", 1);',
  "  return NextResponse.json({ ok: true });",
  "}"
);

const MESSAGE_ROUTE = lines(
  'import { NextResponse } from "next/server"; import { withRoute } from "@/server/route";',
  'export const GET = withRoute({ cache: "private" }, async () => {',
  "  try {",
  "    return NextResponse.json({ ok: true });",
  "  } catch (error) {",
  "    return NextResponse.json({ error: (error as Error).message }, { status: 500 });",
  "  }",
  "});"
);

const CLEAN_ROUTE = lines(
  'import { NextResponse } from "next/server";',
  "export async function GET() {",
  "  return NextResponse.json({ ok: true });",
  "}"
);

const ROUTE = "src/app/api/things/route.ts";

describe("check-server-console.mjs", () => {
  it("S1: fails on an unlisted console call in a route file, naming file:line", () => {
    const root = tree({ [ROUTE]: CONSOLE_ROUTE });
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${ROUTE}:3 S1`);
    expect(result.stdout).toContain("committed=0 live=1 delta=1");
  });

  it("S2: fails on a route body built from a caught error's message, naming file:line", () => {
    const root = tree({ [ROUTE]: MESSAGE_ROUTE });
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${ROUTE}:6 S2`);
  });

  it("passes the same trees once the sites are listed", () => {
    const root = tree({
      [ROUTE]: CONSOLE_ROUTE,
      "src/app/api/other/route.ts": MESSAGE_ROUTE,
    });
    const result = run(root, [
      { file: "src/app/api/other/route.ts", rule: "S2", count: 1 },
      { file: ROUTE, rule: "S1", count: 1 },
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed=2 live=2 delta=0");
    expect(result.stdout).toContain("PASS");
  });

  it("passes and prints retired when a listed site has disappeared", () => {
    const root = tree({ [ROUTE]: CLEAN_ROUTE });
    const result = run(root, [{ file: ROUTE, rule: "S1", count: 2 }]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("retired");
    expect(result.stdout).toContain(`${ROUTE} S1 2 -> 0`);
    expect(result.stdout).toContain("committed=2 live=0 delta=-2");
  });

  it("passes an empty allow-list over a clean tree", () => {
    const root = tree({ [ROUTE]: CLEAN_ROUTE });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed=0 live=0 delta=0");
  });

  it("fails when a listed file grows above its committed count", () => {
    const root = tree({
      [ROUTE]: CONSOLE_ROUTE.replace(
        "  return NextResponse",
        '  console.log("again");\n  return NextResponse'
      ),
    });
    const result = run(root, [{ file: ROUTE, rule: "S1", count: 1 }]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("live 2, allowed 1");
  });

  it("S1 covers the server scope: src/server, the proxy, instrumentation, Sentry config, audit, tagMapping", () => {
    const call = lines('console.warn("x");');
    const root = tree({
      "src/server/thing.ts": call,
      "src/server/deep/other.ts": call,
      "src/proxy.ts": call,
      "src/instrumentation.ts": call,
      "src/sentry.server.config.ts": call,
      "src/lib/audit.ts": call,
      "src/lib/tagMapping.ts": call,
    });
    const result = run(root, []);
    expect(result.status).toBe(1);
    for (const file of [
      "src/server/thing.ts",
      "src/server/deep/other.ts",
      "src/proxy.ts",
      "src/instrumentation.ts",
      "src/sentry.server.config.ts",
      "src/lib/audit.ts",
      "src/lib/tagMapping.ts",
    ]) {
      expect(result.stderr).toContain(`${file}:1 S1`);
    }
  });

  it("S1 counts Server Component pages and layouts, not client ones", () => {
    const serverPage = lines(
      "/** A server page. */",
      'import { x } from "y";',
      "export default async function Page() {",
      '  console.error("server page");',
      "  return null;",
      "}"
    );
    const clientPage = lines(
      "// A client page.",
      '"use client";',
      "export default function Page() {",
      '  console.error("client page");',
      "  return null;",
      "}"
    );
    const root = tree({
      "src/app/clubs/page.tsx": serverPage,
      "src/app/admin/layout.tsx": serverPage,
      "src/app/profile/page.tsx": clientPage,
      "src/app/settings/layout.tsx": clientPage,
    });
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/app/clubs/page.tsx:4 S1");
    expect(result.stderr).toContain("src/app/admin/layout.tsx:4 S1");
    expect(result.stderr).not.toContain("src/app/profile/page.tsx");
    expect(result.stderr).not.toContain("src/app/settings/layout.tsx");
    expect(result.stdout).toContain("live=2");
  });

  it("S1 ignores client code and non-server lib modules", () => {
    const call = lines('console.error("x");');
    const root = tree({
      "src/components/Thing.tsx": call,
      "src/hooks/useThing.ts": call,
      "src/lib/upload-utils.ts": call,
      "src/app/profile/Widget.tsx": call,
    });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("live=0");
  });

  it("exempts the logger's own sink, src/server/log.ts", () => {
    const root = tree({
      "src/server/log.ts": lines('  console.error("{}");', '  console.log("{}");'),
    });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("live=0");
  });

  it("S2 excepts dateError.message and counts only route files", () => {
    const root = tree({
      [ROUTE]: lines(
        "export async function POST() {",
        "  if (dateError) return Response.json({ error: dateError.message, field: dateError.field }, { status: 400 });",
        "}"
      ),
      "src/server/thing.ts": lines("export const f = (e: Error) => ({ error: e.message });"),
    });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("live=0");
  });

  it("ignores test files and comment lines", () => {
    const root = tree({
      "src/app/api/things/route.test.ts": CONSOLE_ROUTE + MESSAGE_ROUTE,
      [ROUTE]: lines(
        "// console.error(\"old\");",
        "/* console.log(\"old\") */",
        " * return NextResponse.json({ error: error.message });",
        "export const GET = () => null;"
      ),
    });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("live=0");
  });

  it("counts a console call per line, with any of the five methods", () => {
    const root = tree({
      [ROUTE]: lines(
        'console.log("a");',
        'console.info("b");',
        'console.warn("c");',
        'console.error("d");',
        'console.debug("e");'
      ),
    });
    const result = run(root, [{ file: ROUTE, rule: "S1", count: 5 }]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed=5 live=5 delta=0");
  });

  it("refuses an allow-list that is not an array of { file, rule: S1|S2, count > 0 }", () => {
    const root = tree({ [ROUTE]: CLEAN_ROUTE });
    for (const bad of [
      {},
      [{ file: ROUTE, rule: "R1", count: 1 }],
      [{ file: ROUTE, rule: "S1", count: 0 }],
      [{ file: ROUTE, rule: "S1" }],
      [{ file: ROUTE, rule: "S1", count: 1, reason: 5 }],
    ]) {
      const result = run(root, bad);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("FAIL: the allow-list must be");
    }
  });

  it("--write records the live census and keeps an existing entry's reason", () => {
    const root = tree({
      [ROUTE]: CONSOLE_ROUTE,
      "src/lib/tagMapping.ts": lines('console.warn("x");'),
    });
    const list = join(root, "allowlist.json");
    const existing: Entry[] = [
      { file: "src/lib/tagMapping.ts", rule: "S1", count: 1, reason: "shared with the client" },
    ];
    writeFileSync(list, JSON.stringify(existing));
    execFileSync("node", [SCRIPT, "--root", root, "--allowlist", list, "--write"], {
      encoding: "utf8",
    });
    const written = JSON.parse(readFileSync(list, "utf8")) as Entry[];
    expect(written).toEqual([
      { file: ROUTE, rule: "S1", count: 1 },
      { file: "src/lib/tagMapping.ts", rule: "S1", count: 1, reason: "shared with the client" },
    ]);
  });
});


it("S3 rejects a generic 500 without the central route observer", () => {
  const root = tree({ [ROUTE]: 'export async function GET() { return Response.json({ error: "Failed" }, { status: 500 }); }' });
  const result = run(root, []);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("S3");
});

it("S3 rejects an unwrapped handler even when its sibling is wrapped", () => {
  const root = tree({ [ROUTE]: lines(
    'import { withRoute } from "@/server/route";',
    'export const GET = withRoute({ cache: "private" }, async () => Response.json({}));',
    'export const POST = async () => Response.json({}, { status: 500 });'
  ) });
  expect(run(root, []).status).toBe(1);
});

it("S3 accepts generic 500s protected by the central observer, without requiring duplicate logs", () => {
  const root = tree({ [ROUTE]: lines(
    'import { withRoute } from "@/server/route";',
    'export const GET = withRoute({ cache: "private" }, async () => Response.json({}, { status: 500 }));'
  ) });
  expect(run(root, []).status).toBe(0);
});
