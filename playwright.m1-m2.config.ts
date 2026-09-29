/** M1/M2 enabled-product acceptance. Inherits the guarded local target, no
 * server reuse, blank external integrations and baseline feature-off config. */
import { defineConfig } from '@playwright/test';
import baseline from './playwright.config';
import { IDS } from './e2e/fixtures';

const server = Array.isArray(baseline.webServer) ? baseline.webServer[0] : baseline.webServer;
if (!server) throw new Error('M1/M2 acceptance requires the guarded baseline server');
export default defineConfig({
  ...baseline,
  projects: (baseline.projects ?? []).map(project => project.name === 'chromium'
    ? { ...project, testIgnore: /specs\/m3-acceptance\.spec\.ts/, testMatch: /specs\/m1-m2-acceptance\.spec\.ts/ } : project),
  webServer: {
    ...server,
    env: { ...server.env, FEATURE_DISCOVERY_UI: 'true', FEATURE_DISCOVERY_ADMIN_PREVIEW: 'false', CURATOR_USER_ID: IDS.admin,
      FEATURE_NATIVE_APPLICATIONS: 'false', FEATURE_RECRUITER_ACCESS: 'false', FEATURE_RESUME_PARSING: 'false', FEATURE_NEW_FEEDBACK_WRITES: 'false' },
  },
});
