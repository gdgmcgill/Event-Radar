import http from "k6/http";
import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_VUS = Number(__ENV.TARGET_VUS || 500);
const RAMP_SECONDS = Number(__ENV.RAMP_SECONDS || 180);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 300);

const userIds = new SharedArray("user_ids", () => {
  const raw = __ENV.USER_IDS || "";
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
});

const sessionCookies = new SharedArray("session_cookies", () => {
  const raw = __ENV.SESSION_COOKIES || "";
  return raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
});

if (userIds.length === 0 || sessionCookies.length === 0) {
  fail(
    "USER_IDS and SESSION_COOKIES are required. See load-tests/README.md for setup."
  );
}

if (userIds.length !== sessionCookies.length) {
  fail("USER_IDS and SESSION_COOKIES must have the same number of entries.");
}

export const options = {
  scenarios: {
    onboarding_completion: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: `${RAMP_SECONDS}s`, target: TARGET_VUS },
        { duration: `${HOLD_SECONDS}s`, target: TARGET_VUS },
        { duration: "60s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1200"],
  },
};

function profilePayload(iteration) {
  const i = iteration % 10000;
  return JSON.stringify({
    name: `Load Test User ${i}`,
    pronouns: "they/them",
    year: "U2",
    faculty: "Arts",
    interest_tags: ["academic", "social", "career"],
    onboarding_completed: true,
  });
}

export default function () {
  const idx = (__VU - 1) % userIds.length;
  const userId = userIds[idx];
  const cookieHeader = sessionCookies[idx];

  const headers = {
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
  };

  const patchRes = http.patch(
    `${BASE_URL}/api/users/${userId}`,
    profilePayload(__ITER),
    headers
  );

  check(patchRes, {
    "profile patch accepted": (r) => r.status === 200,
  });

  const completeRes = http.post(
    `${BASE_URL}/api/onboarding/complete`,
    null,
    headers
  );

  check(completeRes, {
    "onboarding complete accepted": (r) => r.status === 200,
  });

  sleep(1);
}
