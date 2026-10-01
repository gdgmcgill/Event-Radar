import http from "k6/http";
import { check, sleep } from "k6";

// CERT-12 thresholds are declared before execution. Never disable the limiter
// to get a passing result: 429s count as failures, as do invalid payloads.
const BASE_URL = (__ENV.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const local = /^http:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal):3000$/.test(BASE_URL);
if (!local && (BASE_URL !== __ENV.CERT_STAGING_ORIGIN || __ENV.CERT_LOAD_ACK !== "staging-only")) {
  throw new Error("Use local :3000 or explicitly name CERT_STAGING_ORIGIN and CERT_LOAD_ACK=staging-only");
}
if (/^https?:\/\/(www\.)?universeapp\.ca(?:\/|$)/.test(BASE_URL)) throw new Error("Production load testing is forbidden");
const TARGET_VUS = Number(__ENV.TARGET_VUS || 3);
export const options = {
  vus: TARGET_VUS,
  duration: __ENV.DURATION || "60s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate==1"],
    "http_req_duration{route:events_list}": ["p(95)<800"],
    "http_req_duration{route:event_detail}": ["p(95)<800"],
  },
};
export function setup() {
  const response = http.get(`${BASE_URL}/api/events?limit=50`, { tags: { route: "setup" } });
  if (response.status !== 200) throw new Error("Scale discovery setup failed");
  const ids = response.json("events").map((event) => event.id).filter((id) => id.startsWith("c0700001-"));
  if (!ids.length) throw new Error("Scale fixtures missing: run certification.ts scale --load first");
  return ids;
}
export default function browseDiscovery(ids) {
  const page = (__ITER % 10) + 1;
  const list = http.get(`${BASE_URL}/api/events?page=${page}&limit=20`, { tags: { route: "events_list" } });
  check(list, { "event list 200 with array": (r) => r.status === 200 && Array.isArray(r.json("events")) });
  // Reuse a small hot set while still checking exact identity in every response.
  const id = ids[(__VU + __ITER) % Math.min(ids.length, 10)];
  const detail = http.get(`${BASE_URL}/api/events/${id}`, { tags: { route: "event_detail" } });
  check(detail, { "event detail 200 with expected id": (r) => r.status === 200 && r.json("event.id") === id });
  sleep(1);
}
