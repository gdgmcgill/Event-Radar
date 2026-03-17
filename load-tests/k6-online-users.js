import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_VUS = Number(__ENV.TARGET_VUS || 500);
const RAMP_SECONDS = Number(__ENV.RAMP_SECONDS || 180);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 600);

export const options = {
  scenarios: {
    online_users: {
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
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

function randomEventTag() {
  const tags = ["academic", "social", "sports", "career", "wellness", "arts"];
  return tags[Math.floor(Math.random() * tags.length)];
}

export default function () {
  const page = 1 + Math.floor(Math.random() * 3);
  const tag = randomEventTag();

  const responses = http.batch([
    ["GET", `${BASE_URL}/api/events?page=${page}&limit=20&tags=${encodeURIComponent(tag)}`],
    ["GET", `${BASE_URL}/api/events/featured`],
    ["GET", `${BASE_URL}/api/clubs/featured`],
    ["GET", `${BASE_URL}/api/health`],
  ]);

  check(responses[0], {
    "events endpoint healthy": (r) => r.status === 200,
  });
  check(responses[1], {
    "featured events healthy": (r) => r.status === 200,
  });
  check(responses[2], {
    "featured clubs healthy": (r) => r.status === 200,
  });
  check(responses[3], {
    "health endpoint reachable": (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}
