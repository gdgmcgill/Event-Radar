/**
 * No-write manifest: npx tsx scripts/seed/certification.ts scale --manifest
 * Local load:       npx tsx scripts/seed/certification.ts scale --load
 * Readback check:   npx tsx scripts/seed/certification.ts scale --verify
 * Replace scale with adversarial for the smaller dataset and probe catalogue.
 * Remote targets inherit guard.ts's named staging + acknowledgement + deny-key
 * checks. No database reset, schema change or auth deletion is performed.
 */
import { execFileSync } from "node:child_process";
import { datasetManifest, generateCertificationData } from "./certificationData";
import { loadCertificationDataset } from "./certificationLoad";
import { readSupabaseOverride } from "./envOverride";

async function main() {
  const [name, action] = process.argv.slice(2);
  if ((name !== "scale" && name !== "adversarial") || !["--manifest", "--probes", "--load", "--verify"].includes(action) || process.argv.length !== 4) throw new Error("Usage: certification.ts <adversarial|scale> <--manifest|--probes|--load|--verify>");
  if (action === "--manifest" || action === "--probes") {
    const data = generateCertificationData(name);
    console.log(JSON.stringify(action === "--manifest" ? datasetManifest(data) : data.probes, null, 2));
    return;
  }
  const override = readSupabaseOverride();
  let url: string;
  let serviceRoleKey: string;
  if (override) ({ url, serviceRoleKey } = override);
  else {
    // Capture credentials in memory; never print status output or keys.
    const status = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const read = (key: string) => status.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, "m"))?.[1] ?? "";
    url = read("API_URL"); serviceRoleKey = read("SERVICE_ROLE_KEY");
  }
  console.log(JSON.stringify(await loadCertificationDataset(name, { url, serviceRoleKey }, { verifyOnly: action === "--verify" }), null, 2));
}
void main().catch((error: unknown) => {
  // Child-process errors can include stdout/stderr credentials; print only an
  // Error message for our own checks, never the exception object or streams.
  console.error(error instanceof Error && !("stdout" in error) ? error.message : "Certification command failed; check local Supabase availability");
  process.exitCode = 1;
});
