/**
 * CERT-01 opt-in domain superset (separate c0700003 UUID namespace).
 * npx tsx scripts/seed/certification-functional.ts --manifest|--load|--verify
 * Load AFTER default functional/browser suites; its running experiment and
 * scored users intentionally change discovery's fallback conditions.
 */
import { execFileSync } from "node:child_process";
import { functionalManifest } from "./certificationFunctionalData";
import { loadFunctionalCertification } from "./certificationFunctionalLoad";
import { readSupabaseOverride } from "./envOverride";
async function main() {
  const action = process.argv[2];
  if (process.argv.length !== 3 || !["--manifest", "--load", "--verify"].includes(action)) throw new Error("Usage: certification-functional.ts <--manifest|--load|--verify>");
  if (action === "--manifest") { console.log(JSON.stringify(functionalManifest(), null, 2)); return; }
  let credentials = readSupabaseOverride();
  if (!credentials) {
    const status = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const read = (key: string) => status.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, "m"))?.[1] ?? "";
    credentials = { url: read("API_URL"), anonKey: read("ANON_KEY"), serviceRoleKey: read("SERVICE_ROLE_KEY") };
  }
  console.log(JSON.stringify(await loadFunctionalCertification(credentials, { verifyOnly: action === "--verify" }), null, 2));
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error && !("stdout" in error) ? error.message : "Functional certification command failed; check local Supabase availability");
  process.exitCode = 1;
});
