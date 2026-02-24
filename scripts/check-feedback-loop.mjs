#!/usr/bin/env node
/**
 * Check AI feedback loop – verifies feedback and analytics endpoints
 * and optional recommendation service health.
 *
 * Usage: node scripts/check-feedback-loop.mjs
 *        APP_URL=http://localhost:3000 RECOMMENDATION_URL=http://localhost:8000 node scripts/check-feedback-loop.mjs
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const RECOMMENDATION_URL = process.env.RECOMMENDATION_URL || "http://localhost:8000";

const results = { passed: 0, failed: 0, skipped: 0 };

function log(msg, type = "info") {
  const prefix = type === "ok" ? "  [PASS]" : type === "fail" ? "  [FAIL]" : type === "skip" ? "  [SKIP]" : "  ";
  console.log(prefix, msg);
}

async function check(name, fn) {
  try {
    await fn();
    results.passed++;
    log(name, "ok");
    return true;
  } catch (e) {
    results.failed++;
    log(`${name}: ${e.message}`, "fail");
    return false;
  }
}

async function skip(name, reason) {
  results.skipped++;
  log(`${name}: ${reason}`, "skip");
}

async function main() {
  console.log("\n=== AI Feedback Loop Check ===\n");
  console.log(`App URL: ${APP_URL}`);
  console.log(`Recommendation API: ${RECOMMENDATION_URL}\n`);

  // 1. App reachable
  await check("App is reachable", async () => {
    const res = await fetch(APP_URL, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 2. Feedback endpoint – POST without auth → 401
  await check("Feedback endpoint requires auth (401 when unauthenticated)", async () => {
    const res = await fetch(`${APP_URL}/api/recommendations/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "00000000-0000-0000-0000-000000000001",
        recommendation_rank: 1,
        action: "impression",
      }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 3. Feedback endpoint – POST with missing fields → 400
  await check("Feedback endpoint validates body (400 when missing fields)", async () => {
    const res = await fetch(`${APP_URL}/api/recommendations/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 4. Analytics endpoint – GET without auth → 401
  await check("Analytics endpoint requires auth (401 when unauthenticated)", async () => {
    const res = await fetch(`${APP_URL}/api/recommendations/analytics?period=7d`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 5. Recommendation service health (optional)
  try {
    const res = await fetch(`${RECOMMENDATION_URL}/health`);
    if (res.ok) {
      const data = await res.json();
      results.passed++;
      log(`Recommendation service healthy (event_count=${data.event_count ?? "?"})`, "ok");
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (e) {
    await skip(
      "Recommendation service health",
      `Not reachable: ${e.message}. Start with: cd AI && python run.py`
    );
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`  Passed:  ${results.passed}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);

  if (results.failed > 0) {
    console.log("\nSome checks failed. Fix the issues above and run again.\n");
    process.exit(1);
  }

  console.log("\nFeedback loop endpoints are behaving as expected.");
  console.log("To verify end-to-end:");
  console.log("  1. Run the app (npm run dev) and recommendation service (cd AI && python run.py).");
  console.log("  2. Log in and open the home page.");
  console.log("  3. View recommendations (impressions), click a card, dismiss one, save one.");
  console.log("  4. Check Supabase Table Editor → recommendation_feedback for new rows.");
  console.log("  5. Call GET /api/recommendations/analytics?period=7d while logged in for metrics.\n");
  process.exit(0);
}

main();
