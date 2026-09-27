/**
 * The contracts census gate (plan 06-04, REFAC-15, F-094, DEC-65).
 *
 * scripts/check-contracts.mjs is run as CI runs it, against fixture trees
 * written under the OS temp directory, through its --root and --allowlist
 * flags. The gate is only worth having if an unlisted raw read fails it, so
 * the red cases come first (T-06-04-03).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../../../scripts/check-contracts.mjs");

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface Entry {
  file: string;
  rule: string;
  count: number;
}

const roots: string[] = [];

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "check-contracts-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

function run(root: string, allowlist: Entry[]): RunResult {
  const list = join(root, "allowlist.json");
  writeFileSync(list, JSON.stringify(allowlist, null, 2));
  try {
    const stdout = execFileSync(
      "node",
      [SCRIPT, "--root", root, "--allowlist", list],
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

const RAW_ROUTE = [
  'import { NextResponse } from "next/server";',
  "export async function POST(request: Request) {",
  "  const body = await request.json();",
  "  return NextResponse.json(body);",
  "}",
  "",
].join("\n");

const CLEAN_ROUTE = [
  'import { NextResponse } from "next/server";',
  "export async function GET() {",
  "  return NextResponse.json({ ok: true });",
  "}",
  "",
].join("\n");

const ROUTE = "src/app/api/thing/route.ts";

describe("check-contracts.mjs", () => {
  it("fails on an unlisted raw JSON read, naming file:line", () => {
    const root = tree({ [ROUTE]: RAW_ROUTE });
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${ROUTE}:3`);
    expect(result.stderr).toContain("R1");
  });

  it("passes the same tree once the site is listed", () => {
    const root = tree({ [ROUTE]: RAW_ROUTE });
    const result = run(root, [{ file: ROUTE, rule: "R1", count: 1 }]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed=1 live=1 delta=0");
  });

  it("passes and prints retired when a listed site has disappeared", () => {
    const root = tree({ [ROUTE]: CLEAN_ROUTE });
    const result = run(root, [{ file: ROUTE, rule: "R1", count: 1 }]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("retired");
    expect(result.stdout).toContain(ROUTE);
    expect(result.stdout).toContain("committed=1 live=0 delta=-1");
  });

  it("passes an empty allow-list over a clean tree", () => {
    const root = tree({ [ROUTE]: CLEAN_ROUTE });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed=0 live=0");
  });

  it("fails when a listed file grows above its committed count", () => {
    const root = tree({
      [ROUTE]: RAW_ROUTE.replace(
        "  return",
        "  const again = await request.json();\n  return"
      ),
    });
    const result = run(root, [{ file: ROUTE, rule: "R1", count: 1 }]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${ROUTE}:3`);
    expect(result.stderr).toContain(`${ROUTE}:4`);
  });

  it("counts req.json() and a multipart read (R2) outside src/server/body.ts", () => {
    const root = tree({
      "src/lib/reader.ts": "export const f = async (req: Request) => req.json();\n",
      "src/app/api/upload/route.ts":
        "export async function POST(request: Request) {\n  const form = await request.formData();\n  return form;\n}\n",
      "src/server/body.ts":
        "export async function r(request: Request) {\n  await request.json();\n  await request.formData();\n}\n",
    });
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/lib/reader.ts:1");
    expect(result.stderr).toContain("src/app/api/upload/route.ts:2");
    expect(result.stderr).not.toContain("src/server/body.ts:");
  });

  it("counts query reads (R3) and schema-less readJsonObject (R4) in route files only", () => {
    const root = tree({
      "src/app/api/list/route.ts": [
        "export async function GET(request: Request) {",
        "  const { searchParams } = new URL(request.url);",
        '  const a = searchParams.get("a");',
        '  const b = searchParams.getAll("b");',
        '  const c = searchParams.has("c");',
        "  const parsed = await readJsonObject(request);",
        "  return [a, b, c, parsed];",
        "}",
        "",
      ].join("\n"),
      "src/app/page.tsx": 'const v = searchParams.get("view");\n',
    });
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("src/app/api/list/route.ts:3");
    expect(result.stderr).toContain("src/app/api/list/route.ts:4");
    expect(result.stderr).toContain("src/app/api/list/route.ts:5");
    expect(result.stderr).toContain("src/app/api/list/route.ts:6");
    expect(result.stderr).toContain("R4");
    expect(result.stderr).not.toContain("src/app/page.tsx");
  });

  it("exempts exactly the four OAuth params in src/app/auth/callback/route.ts", () => {
    const callback = [
      "export async function GET(request: Request) {",
      "  const requestUrl = new URL(request.url);",
      '  const code = requestUrl.searchParams.get("code");',
      '  const next = requestUrl.searchParams.get("next");',
      '  const error = requestUrl.searchParams.get("error");',
      '  const description = requestUrl.searchParams.get("error_description");',
      "  return [code, next, error, description];",
      "}",
      "",
    ].join("\n");
    const exempt = run(tree({ "src/app/auth/callback/route.ts": callback }), []);
    expect(exempt.status).toBe(0);
    expect(exempt.stdout).toContain("committed=0 live=0");

    const extra = callback.replace(
      "  return",
      '  const state = requestUrl.searchParams.get("state");\n  return'
    );
    const counted = run(tree({ "src/app/auth/callback/route.ts": extra }), []);
    expect(counted.status).toBe(1);
    expect(counted.stderr).toContain("src/app/auth/callback/route.ts:7");
  });

  it("ignores test files and comment lines", () => {
    const root = tree({
      "src/app/api/thing/route.test.ts": "await request.json();\n",
      [ROUTE]: [
        "/**",
        " * `await request.json()` is not read here.",
        " */",
        "// searchParams.get() is a comment too",
        "export const x = 1;",
        "",
      ].join("\n"),
    });
    const result = run(root, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("committed=0 live=0");
  });

  it("refuses an allow-list that is not an array of entries", () => {
    const root = tree({ [ROUTE]: CLEAN_ROUTE });
    const list = join(root, "bad.json");
    writeFileSync(list, JSON.stringify({ file: ROUTE }));
    let status = 0;
    try {
      execFileSync("node", [SCRIPT, "--root", root, "--allowlist", list], {
        stdio: "pipe",
      });
    } catch (error) {
      status = (error as { status: number }).status;
    }
    expect(status).toBe(1);
  });
});
