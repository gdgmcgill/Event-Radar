/**
 * The Content-Security-Policy, enforced (F-055, DI-21, research C13, DEC-77;
 * plan 06-16).
 *
 * The harness runs with `bypassCSP: false` (playwright.config.ts), so every
 * spec already fails if the CSP blocks something a workflow needs. This spec
 * asserts the policy directly:
 *   1. the CSP header on `/` has no 'unsafe-eval' (a production build), keeps
 *      'unsafe-inline' (the open half of F-055, DI-80), and admits the local
 *      Supabase origin the harness build was given;
 *   2. visiting five pages as their personas produces no CSP violation: no
 *      console message that mentions Content Security Policy, and no
 *      `securitypolicyviolation` event recorded in the page. The two sources
 *      are independent: the console text is Chromium's report, the event is
 *      the DOM's.
 */

import { expect, test, type Page } from "@playwright/test";

import { IDS, storageStateFor, type PersonaKey } from "../fixtures";

const LOCAL_SUPABASE = "http://127.0.0.1:54321";

type Violation = { directive: string; blocked: string };

/** Starts collecting CSP reports from both sources; returns the readers. */
async function watchCsp(page: Page): Promise<{
  consoleMessages: string[];
  violations: () => Promise<Violation[]>;
}> {
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/content security policy/i.test(text)) consoleMessages.push(text);
  });
  await page.addInitScript(() => {
    const store: { directive: string; blocked: string }[] = [];
    (window as unknown as { __cspViolations: typeof store }).__cspViolations = store;
    document.addEventListener("securitypolicyviolation", (event) => {
      store.push({ directive: event.violatedDirective, blocked: event.blockedURI });
    });
  });
  return {
    consoleMessages,
    violations: () =>
      page.evaluate(
        () =>
          (window as unknown as { __cspViolations?: { directive: string; blocked: string }[] })
            .__cspViolations ?? []
      ),
  };
}

/** Visits `path`, waits for the page and its client fetches to settle, returns what was reported. */
async function visit(
  page: Page,
  path: string,
  visible: RegExp
): Promise<{ consoleMessages: string[]; violations: Violation[] }> {
  const watcher = await watchCsp(page);
  const response = await page.goto(path);
  expect(response?.status(), `${path} must render`).toBeLessThan(400);
  await expect(page.getByText(visible).filter({ visible: true }).first()).toBeVisible();
  await page.waitForLoadState("load");
  // A settle window for the client fetches that follow hydration. Not
  // "networkidle": the event page keeps a request open, so it never idles.
  await page.waitForTimeout(2_000);
  return { consoleMessages: watcher.consoleMessages, violations: await watcher.violations() };
}

test.describe("the CSP header", () => {
  test("has no 'unsafe-eval', keeps 'unsafe-inline', and admits the local Supabase origin", async ({
    request,
  }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"] ?? "";
    expect(csp, "the page must carry a CSP").not.toBe("");

    const directives = new Map(
      csp.split(";").map((part) => {
        const [name, ...values] = part.trim().split(/\s+/);
        return [name, values] as const;
      })
    );

    expect(csp).not.toContain("'unsafe-eval'");
    expect(directives.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives.get("connect-src")).toEqual(
      expect.arrayContaining([LOCAL_SUPABASE, "ws://127.0.0.1:54321", "https://*.supabase.co"])
    );
    expect(directives.get("img-src")).toEqual(expect.arrayContaining([LOCAL_SUPABASE]));
  });
});

const PAGES: {
  who: PersonaKey | "anonymous";
  path: string;
  visible: RegExp;
}[] = [
  { who: "anonymous", path: "/", visible: /Seed Approved Event/i },
  { who: "anonymous", path: `/events/${IDS.approvedEvent}`, visible: /Seed Approved Event/i },
  { who: "onboarded_student", path: "/profile", visible: /Seed Onboarded Student/i },
  { who: "club_owner", path: `/clubs/${IDS.approvedClub}`, visible: /Seed Approved Club/i },
  { who: "admin", path: "/moderation", visible: /Recent Activity/ },
];

for (const { who, path, visible } of PAGES) {
  test.describe(`${path} as ${who}`, () => {
    if (who !== "anonymous") test.use({ storageState: storageStateFor(who) });

    test("reports no CSP violation", async ({ page }) => {
      const { consoleMessages, violations } = await visit(page, path, visible);
      expect(consoleMessages, "no console message may mention Content Security Policy").toEqual([]);
      expect(violations, "no securitypolicyviolation event may fire").toEqual([]);
    });
  });
}
