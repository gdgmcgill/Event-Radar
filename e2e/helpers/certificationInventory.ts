import fs from "node:fs";
import path from "node:path";

export const REPO = path.resolve(__dirname, "../..");
export const AUDIT_PERSONAS = ["anonymous", "onboarded_student", "mid_onboarding_student", "club_member", "club_owner", "multi_club_organizer", "cross_club_attacker", "admin", "banned_permanent", "suspended_active", "suspension_expired", "non_mcgill_signin", "machine_no_credential"] as const;
export type AuditPersona = typeof AUDIT_PERSONAS[number];
export interface EndpointRow {
  file: string;
  route: string;
  methods: string[];
  auth_requirement: string;
  expected_status: Record<AuditPersona, number | "n/a">;
}
export interface PageRow { file: string; route: string; }
const read = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(REPO, ".planning/audit/inventory", name), "utf8"));
export const endpointInventory = read<EndpointRow[]>("endpoints.json");
export const pageInventory = read<PageRow[]>("pages.json");
export const DELETED_ENDPOINTS = new Set(["/api/auth-debug", "/api/cron/send-feedback-requests", "/api/cron/send-reminders"]);
export const liveEndpoints = endpointInventory.filter((row) => !DELETED_ENDPOINTS.has(row.route));

/** Source-driven coverage; a new route, verb, page or undeclared removal fails. */
export function assertInventoryCoverage(): void {
  const app = path.join(REPO, "src/app");
  const sources = fs.readdirSync(app, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  const sourceRoutes = sources.filter((entry) => /^route\.(?:js|jsx|ts|tsx)$/.test(entry.name)).map((entry) => path.relative(REPO, path.join(entry.parentPath, entry.name))).sort();
  const sourcePages = sources.filter((entry) => /^page\.(?:js|jsx|ts|tsx)$/.test(entry.name)).map((entry) => path.relative(REPO, path.join(entry.parentPath, entry.name))).sort();
  const equal = (actual: unknown, expected: unknown, label: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: source/inventory mismatch; classify the surface before certifying it`);
  };
  equal(sourceRoutes, liveEndpoints.map((row) => row.file).sort(), "endpoint inventory");
  equal(sourcePages, pageInventory.map((row) => row.file).sort(), "page inventory");
  for (const row of liveEndpoints) {
    const source = fs.readFileSync(path.join(REPO, row.file), "utf8");
    const verbs = [...source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map((match) => match[1]).sort();
    equal(verbs, [...row.methods].sort(), row.route);
    equal(Object.keys(row.expected_status).sort(), [...AUDIT_PERSONAS].sort(), `${row.route} personas`);
    if (!row.auth_requirement || Object.values(row.expected_status).some((status) => typeof status !== "number" && status !== "n/a")) throw new Error(`Unclassified endpoint ${row.route}`);
  }
  for (const route of DELETED_ENDPOINTS) {
    const row = endpointInventory.find((item) => item.route === route);
    if (!row || fs.existsSync(path.join(REPO, row.file))) throw new Error(`Stale deleted-endpoint exception: ${route}`);
  }
}
