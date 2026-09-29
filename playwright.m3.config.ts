/** M3 enabled-product acceptance. Inherits the M1/M2 enabled configuration
 * (guarded local target, no server reuse, blank external integrations) and
 * adds the M3 intake secret. Only this config runs the M3 spec. */
import { defineConfig } from '@playwright/test';
import enabled from './playwright.m1-m2.config';
import { IDS } from './e2e/fixtures';

const server = Array.isArray(enabled.webServer) ? enabled.webServer[0] : enabled.webServer;
if (!server) throw new Error('M3 acceptance requires the guarded baseline server');
export default defineConfig({
  ...enabled,
  projects: (enabled.projects ?? []).map(project => project.name === 'chromium'
    ? { ...project, testIgnore: [], testMatch: /specs\/m3-acceptance\.spec\.ts/ } : project),
  webServer: {
    ...server,
    env: { ...server.env, FEATURE_DISCOVERY_UI: 'true', CURATOR_USER_ID: IDS.admin, INTAKE_HASH_SECRET: 'local-m3-intake-secret' },
  },
});
