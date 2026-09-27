/** CERT-06/CERT-09: reviewed probe expectations, never learned from responses.
 * This matrix certifies gates and validation, with isolated fixtures where
 * a route has no validation-only success path. OAuth admission is separate.
 */
import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { BASE_URL } from "../../playwright.config";
import { HealthReport } from "../../src/contracts/health";
import { storageStateFor, type PersonaKey } from "../fixtures";
import { assertInventoryCoverage, AUDIT_PERSONAS, liveEndpoints } from "../helpers/certificationInventory";
import { expectedProbe, isAnonymous, MUTATIONS, probeUrl } from "../helpers/authorizationProbes";
import { isolatedMutationProbe } from "../helpers/isolatedProbes";

assertInventoryCoverage();
const liveMutationKeys = liveEndpoints.flatMap((row) => row.methods.filter((method) => method !== "GET").map((method) => `${method} ${row.route}`)).sort();
if (JSON.stringify(liveMutationKeys) !== JSON.stringify(Object.keys(MUTATIONS).sort())) {
  throw new Error("Mutation probe manifest does not exactly cover the live route verbs");
}

test("every live endpoint, verb and page is classified", () => assertInventoryCoverage());

for (const who of AUDIT_PERSONAS) {
  test.describe(`authorization matrix: ${who}`, () => {
    let context: APIRequestContext;
    test.beforeAll(async () => {
      if (who === "non_mcgill_signin") return;
      context = await request.newContext({
        baseURL: BASE_URL,
        storageState: isAnonymous(who) ? { cookies: [], origins: [] } : storageStateFor(who as PersonaKey),
      });
    });
    test.afterAll(async () => { await context?.dispose(); });

    for (const row of liveEndpoints) {
      for (const method of row.methods) {
        const expected = expectedProbe(row, method, who);
        test(`${method} ${row.route}`, async () => {
          test.skip(!!expected.skip, expected.skip);
          const url = probeUrl(row, method, who);
          const response = expected.isolated
            ? await isolatedMutationProbe(expected.isolated, row.route, context, who as PersonaKey, BASE_URL)
            : await context.fetch(url, {
            method,
            maxRedirects: 0,
            ...(method === "GET" ? {} : MUTATIONS[`${method} ${row.route}`].body === "missing-file-form"
              ? { multipart: { probe: "missing-file" } }
              : { data: "{", headers: { "content-type": "application/json" } }),
          });
          // Health may be degraded on an otherwise valid seeded local stack.
          // Assert its documented condition, not an observed status whitelist.
          if (row.route === "/api/health" && who === "admin") {
            const body = HealthReport.parse(await response.json());
            expect(response.status()).toBe(body.status === "ok" ? 200 : 503);
          } else {
            expect(response.status(), `${who}: ${method} ${url}`).toBe(expected.status);
          }
          if (response.status() === 403 && ["banned_permanent", "suspended_active"].includes(who)) {
            expect(await response.json()).toEqual({ error: "Account suspended" });
          }
          if (method !== "GET" || response.status() >= 400) {
            expect(response.headers()["cache-control"]).toBe("private, no-store");
          }
        });
      }
    }
  });
}
