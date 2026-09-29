/** CERT-09: every classified page loads or redirects as explicitly expected.
 * Browser console errors and unhandled page exceptions are never ignored.
 * Dynamic experiment detail uses a disposable draft and variants.
 */
import { expect, test, type Request } from "@playwright/test";
import { storageStateFor } from "../fixtures";
import { assertInventoryCoverage, pageInventory } from "../helpers/certificationInventory";
import { PAGE_SMOKES } from "../helpers/pageSmokeManifest";
import { experimentFixture } from "../helpers/isolatedProbes";
import { HealthReport } from "../../src/contracts/health";
import { belongsToReplacedDocument } from "../helpers/requestDocument";

assertInventoryCoverage();
if (JSON.stringify(pageInventory.map((row) => row.route).sort()) !== JSON.stringify(Object.keys(PAGE_SMOKES).sort())) {
  throw new Error("Page smoke manifest must classify every live page exactly once");
}

for (const row of pageInventory) {
  const entry = PAGE_SMOKES[row.route];
  const manifestPath = entry.path ?? row.route;
  for (const anonymous of [true, false]) {
    test.describe(`${row.route}: ${anonymous ? "anonymous" : entry.persona}`, () => {
      test.use({ storageState: anonymous ? { cookies: [], origins: [] } : storageStateFor(entry.persona) });
      test("renders or redirects without browser errors", async ({ page }) => {
        const fixture = !anonymous && entry.fixture === "experiment" ? await experimentFixture() : undefined;
        const path = fixture ? `/admin/experiments/${fixture.id}` : manifestPath;
        try {
          const errors: string[] = [];
          const expectedHealthConsole: string[] = [];
          const healthReports: Promise<unknown>[] = [];
          page.on("response", response => {
            if (!anonymous && row.route === "/health" && new URL(response.url()).pathname === "/api/health" && response.status() === 503) {
              healthReports.push(response.json().catch(() => null));
            }
          });
          const requestedPaths: string[] = [];
          const pending = new Map<Request, { done: Promise<void>; finish: () => void }>();
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => {
            if (message.type() !== "error") return;
            // A deliberately disabled page is a real document 404. Chromium
            // reports that expected HTTP status to the console; no failed
            // scripts, API calls or page exceptions receive an exemption.
            const expectedDocument404 = entry.notFound && message.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)"
              && new URL(message.location().url, page.url()).pathname === path;
            // The health dashboard is designed to show a schema-valid503
            // report for degraded dependencies. Validate the actual report and
            // visible state below before accepting its resource-console line.
            const health503 = !anonymous && row.route === "/health" && message.text() === "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
              && new URL(message.location().url, page.url()).pathname === "/api/health";
            if (health503) expectedHealthConsole.push(message.text());
            else if (!expectedDocument404) errors.push(message.text());
          });
          page.on("request", (request) => {
            if (request.isNavigationRequest() && request.resourceType() === "document" && request.frame() === page.mainFrame()) {
              // Next's streamed redirects replace the document after its
              // shell has started fetching. Chromium need not emit terminal
              // request events for that abandoned document (verified in the
              // settings/my-clubs traces). Retire that document's requests;
              // every destination-document request is still tracked below.
              for (const previous of pending.values()) previous.finish();
              pending.clear();
            }
            const requestPath = new URL(request.url()).pathname;
            if (!["fetch", "xhr"].includes(request.resourceType()) || !(requestPath.startsWith("/api/") || requestPath.startsWith("/rest/v1/"))) return;
            requestedPaths.push(requestPath);
            let finish!: () => void;
            const done = new Promise<void>((resolve) => { finish = resolve; });
            pending.set(request, { done, finish });
          });
          const finished = (request: Request) => { pending.get(request)?.finish(); pending.delete(request); };
          page.on("requestfinished", finished);
          page.on("requestfailed", finished);
          const response = await page.goto(path);
          // Next notFound() answers 200 once the layout shell has streamed,
          // or 404 before streaming (installed Next file-conventions/not-found).
          // Both must render the not-found boundary and inject noindex below.
          if (entry.notFound) expect([200, 404]).toContain(response?.status());
          else expect(response?.status()).toBeLessThan(400);
          const finalPath = anonymous ? entry.anonymousPath ?? path : entry.finalPath ?? path;
          await expect(page).toHaveURL((url) => url.pathname === finalPath);
          if (anonymous && entry.anonymousSignIn) {
            expect(new URL(page.url()).searchParams.get("signin")).toBe("required");
            expect(new URL(page.url()).searchParams.get("next")).toBe(path);
          }
          const main = page.getByRole("main").first();
          await expect(main).toBeVisible();
          if (entry.notFound) {
            await expect(main.getByRole("heading", { name: "Page Not Found", exact: true })).toBeVisible();
            await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/);
          } else if (entry.text && (!anonymous || !entry.anonymousPath)) {
            await expect(main.getByText(entry.text).first()).toBeVisible();
          } else {
            await expect(main.getByRole("heading").first()).toBeVisible();
          }
          // The trace for streamed /settings and /my-clubs redirects contains
          // late old-document fetches with no terminal event, alongside fast200
          // destination fetches. A request can arrive after the document-request
          // listener cleared the old epoch. Retire only its exact original
          // Referer, after confirming the explicitly expected destination above.
          if (finalPath !== path) {
            const initialDocument = new URL(path, page.url()).href;
            for (const [request, waiting] of pending) {
              if (belongsToReplacedDocument(request.headers().referer, initialDocument, page.url())) {
                waiting.finish();
                pending.delete(request);
              }
            }
          }
          // Wait only for initial data requests already in flight when content
          // is ready. Polling/realtime connections must not prevent readiness.
          // Destination and unknown-document requests keep the strict5s bound.
          const initialRequests = [...pending.entries()];
          let deadline: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              Promise.all(initialRequests.map(([, request]) => request.done)),
              new Promise<never>((_, reject) => {
                deadline = setTimeout(() => {
                  const unfinished = initialRequests.filter(([request]) => pending.has(request))
                    .map(([request]) => `${request.method()} ${request.url()}`);
                  reject(new Error(`Initial data requests did not finish within 5s after visible content on ${path}:\n${unfinished.join("\n")}`));
                }, 5000);
              }),
            ]);
          } finally { if (deadline) clearTimeout(deadline); }
          await expect(main.getByRole("heading", { name: "Something went wrong", exact: true })).toHaveCount(0);
          if (anonymous && row.route === "/events/[id]") {
            expect(requestedPaths, "anonymous event page must not request authenticated-only reviews")
              .not.toContain(`/api${path}/reviews`);
          }
          if (expectedHealthConsole.length) expect(healthReports.length).toBeGreaterThan(0);
          for (const body of await Promise.all(healthReports)) {
            const report = HealthReport.parse(body);
            expect(["degraded", "down"]).toContain(report.status);
            await expect(main.getByText(report.status === "degraded" ? "Degraded" : "Down", { exact: true }).first()).toBeVisible();
          }
          if (entry.notFound) {
            // The disabled page cannot mount the client data flow even when
            // its streamed HTTP shell was 200. APIs have their own 404 matrix.
            expect(requestedPaths.filter(requestPath =>
              requestPath === "/api/discovery" || requestPath === "/api/saved" ||
              requestPath.startsWith("/api/saved/") || requestPath.startsWith("/api/opportunities/")
            )).toEqual([]);
          }
          expect(errors, `browser errors while visiting ${path}`).toEqual([]);
        } finally {
          await fixture?.cleanup();
        }
      });
    });
  }
}
