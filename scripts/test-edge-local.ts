/** Repeatable local-only Edge verification. No .env file or hosted credentials. */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { localStackEnv } from "../e2e/env";
import { assertSeedTargetAllowed, isLocalSeedTarget } from "./seed/guard";

async function main() {
  const stack = localStackEnv();
  assertSeedTargetAllowed(stack.url);
  if (!isLocalSeedTarget(stack.url)) throw new Error("Edge tests require local Supabase");
  const directory = await mkdtemp(path.join(tmpdir(), "universe-edge-test-"));
  const secret = randomBytes(32).toString("hex");
  const envFile = path.join(directory, "edge.env");
  await writeFile(envFile, `WEBHOOK_SECRET=${secret}\n`, { mode: 0o600 });
  const server = spawn("supabase", ["functions", "serve", "events-webhook", "--env-file", envFile, "--no-verify-jwt"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Server diagnostics can echo request payloads. Emit them only as a bounded
  // generic failure here; the tests report statuses and synthetic fixture names.
  let exited = false;
  server.once("exit", () => { exited = true; });
  server.stdout?.resume(); server.stderr?.resume();
  const stop = () => server.kill("SIGTERM");
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120 && !exited; attempt++) {
      try {
        const response = await fetch(`${stack.url}/functions/v1/events-webhook`, {
          method: "POST", headers: { "content-type": "application/json", "x-signature": "00" }, body: "{}",
          signal: AbortSignal.timeout(1000),
        });
        const body = await response.text();
        if (response.status === 401 && body.includes("signature")) { ready = true; break; }
      } catch { /* startup is not ready */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Local Edge function did not become ready");
    const code = await new Promise<number>((resolve, reject) => {
      const test = spawn("npx", ["--yes", "--package=deno@2.9.6", "deno", "test", "--frozen", "--allow-net", "--allow-env", "--allow-read",
        "--config", "supabase/functions/events-webhook/deno.json", "supabase/functions/tests/webhook.test.ts"], {
        stdio: "inherit", env: { ...process.env, SUPABASE_URL: stack.url,
          SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey, WEBHOOK_SECRET: secret },
      });
      test.once("error", reject); test.once("exit", (value) => resolve(value ?? 1));
    });
    process.exitCode = code;
  } finally {
    stop();
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local Edge verification failed");
  process.exitCode = 1;
});
