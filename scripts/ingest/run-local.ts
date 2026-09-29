/**
 * M3 P1-07: run the Instagram producer against the LOCAL Supabase stack.
 *
 *   npx tsx scripts/ingest/run-local.ts --handles a,b,c [--days 14] [--dry-run] [--fixture path]
 *
 * Modelled on scripts/test-edge-local.ts: refuses anything but the local
 * stack, writes a random WEBHOOK_SECRET to a private temp env file, serves
 * events-webhook with it (`supabase functions serve --no-verify-jwt`), waits
 * for the unsigned 401 readiness answer, then runs scripts/ingest/instagram.ts
 * with --webhook-url pointing at the local function and the same secret in its
 * environment. The server's own output can echo payloads and is discarded.
 * The server is stopped and the temp directory removed in `finally`.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { localStackEnv } from "../../e2e/env";
import { assertSeedTargetAllowed, isLocalSeedTarget } from "../seed/guard";

async function main() {
  const stack = localStackEnv();
  assertSeedTargetAllowed(stack.url);
  if (!isLocalSeedTarget(stack.url)) throw new Error("Local ingestion requires the local Supabase stack");
  const forwarded = process.argv.slice(2);
  if (forwarded.includes("--webhook-url")) throw new Error("run-local sets --webhook-url itself");

  const directory = await mkdtemp(path.join(tmpdir(), "universe-ingest-"));
  const secret = randomBytes(32).toString("hex");
  const envFile = path.join(directory, "edge.env");
  await writeFile(envFile, `WEBHOOK_SECRET=${secret}\n`, { mode: 0o600 });
  const server = spawn("supabase", ["functions", "serve", "events-webhook", "--env-file", envFile, "--no-verify-jwt"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let exited = false;
  server.once("exit", () => {
    exited = true;
  });
  server.stdout?.resume();
  server.stderr?.resume();
  const stop = () => server.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const webhookUrl = `${stack.url}/functions/v1/events-webhook`;
  try {
    console.log("local webhook: starting");
    let ready = false;
    for (let attempt = 0; attempt < 120 && !exited; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-signature": "00" },
          body: "{}",
          signal: AbortSignal.timeout(1000),
        });
        const body = await response.text();
        if (response.status === 401 && body.includes("signature")) {
          ready = true;
          break;
        }
      } catch {
        /* not ready yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Local events-webhook did not become ready");
    console.log("local webhook: ready");
    const code = await new Promise<number>((resolve, reject) => {
      const producer = spawn("npx", ["tsx", "scripts/ingest/instagram.ts", ...forwarded, "--webhook-url", webhookUrl], {
        stdio: "inherit",
        env: { ...process.env, WEBHOOK_SECRET: secret },
      });
      producer.once("error", reject);
      producer.once("exit", (value) => resolve(value ?? 1));
    });
    console.log(`producer exit code: ${code}`);
    process.exitCode = code;
  } finally {
    stop();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local ingestion failed");
  process.exitCode = 1;
});
