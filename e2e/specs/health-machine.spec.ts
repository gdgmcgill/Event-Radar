import { expect, test } from "@playwright/test";
import { HealthLiveness, HealthReport } from "../../src/contracts/health";
import { LOCAL_HEALTH_TOKEN } from "../helpers/healthCredential";

test.use({ storageState: { cookies: [], origins: [] } });

for (const credential of ["absent", "invalid", "short", "valid"] as const) {
  test(`machine health: ${credential} credential`, async ({ request }) => {
    const token = credential === "valid" ? LOCAL_HEALTH_TOKEN : credential === "invalid" ? `${LOCAL_HEALTH_TOKEN.slice(0, -1)}x` : "x";
    const response = await request.get("/api/health", { headers: credential === "absent" ? {} : { authorization: `Bearer ${token}` } });
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const body = await response.json();
    if (credential === "valid") {
      const report = HealthReport.parse(body);
      expect(response.status()).toBe(report.status === "ok" ? 200 : 503);
    } else {
      expect(response.status()).toBe(200);
      expect(HealthLiveness.parse(body)).toEqual(body);
      expect(Object.keys(body).sort()).toEqual(["status", "version"]);
    }
    expect(JSON.stringify(body)).not.toContain(LOCAL_HEALTH_TOKEN);
  });
}
