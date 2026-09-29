/**
 * M3 P1-07: an SSRF-safe fetch for ingested Instagram images.
 *
 * Ingested events carry CDN image URLs that expire. Persisting them means the
 * server fetches a URL that arrived in a webhook payload, so every hop is
 * checked before it is requested:
 *   - `https:` only, no userinfo, the default port;
 *   - the host is an Instagram/Facebook CDN (INGEST_IMAGE_HOSTS), never an IP
 *     literal;
 *   - EVERY address the host resolves to is public (a mixed answer fails);
 *   - redirects are followed by hand (`redirect: "manual"`), each Location
 *     resolved against the current URL and re-checked, at most 3 times;
 *   - the body is streamed and abandoned past the byte cap, the whole fetch
 *     is bounded by one timeout (DNS lookups included), and the bytes must
 *     sniff as an image.
 *
 * Residual risk, accepted: the check resolves the host and fetch resolves it
 * again (DNS rebinding between the two). The allow-list limits that to
 * Meta-operated names.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { sniffImageType, type SniffedImageType } from "@/lib/imageSniff";

export const INGEST_IMAGE_HOSTS: readonly RegExp[] = [/(^|\.)cdninstagram\.com$/i, /(^|\.)fbcdn\.net$/i];

export type ImageFetchErrorCode =
  | "disallowed_url"
  | "private_address"
  | "too_many_redirects"
  | `http_${number}`
  | "too_large"
  | "not_image"
  | "timeout";

export class ImageFetchError extends Error {
  readonly code: ImageFetchErrorCode;
  constructor(code: ImageFetchErrorCode) {
    super(code);
    this.name = "ImageFetchError";
    this.code = code;
  }
}

export interface FetchIngestImageDeps {
  lookup?: (host: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;

// ─── Addresses ───────────────────────────────────────────────────────────────

function ipv4Octets(ip: string): number[] | null {
  if (isIP(ip) !== 4) return null;
  return ip.split(".").map(Number);
}

function isPrivateIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10
    a === 127 || // 127.0.0.0/8
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
    a >= 224 // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved
  );
}

/** The eight 16-bit groups of a valid IPv6 address (dotted tail included). */
function ipv6Groups(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null;
  let text = ip.split("%")[0];
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = ipv4Octets(dotted[2]);
    if (!octets) return null;
    text = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const [head, tail] = text.includes("::") ? text.split("::") : [text, null];
  const parse = (part: string) => (part ? part.split(":").map((group) => parseInt(group, 16)) : []);
  const front = parse(head);
  const back = tail === null ? [] : parse(tail);
  const fill = tail === null ? 0 : 8 - front.length - back.length;
  const groups = [...front, ...new Array(fill).fill(0), ...back];
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : null;
}

/**
 * Is this address loopback, private, link-local, shared, reserved or
 * multicast (or not an address at all)? Anything unparseable fails closed.
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Octets(ip);
  if (v4) return isPrivateIpv4(v4);
  const g = ipv6Groups(ip);
  if (!g) return true;
  const zeroPrefix = (count: number) => g.slice(0, count).every((group) => group === 0);
  if (g.every((group) => group === 0)) return true; // ::
  if (zeroPrefix(7) && g[7] === 1) return true; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8
  if (zeroPrefix(5) && g[5] === 0xffff) {
    // ::ffff:a.b.c.d, IPv4-mapped: judge the IPv4 part.
    return isPrivateIpv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((group) => group === 0)) return true; // 64:ff9b::/96
  return false;
}

// ─── URLs ────────────────────────────────────────────────────────────────────

function allowedUrl(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    throw new ImageFetchError("disallowed_url");
  }
  const host = url.hostname;
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    isIP(host.replace(/^\[|\]$/g, "")) !== 0 ||
    !INGEST_IMAGE_HOSTS.some((pattern) => pattern.test(host))
  ) {
    throw new ImageFetchError("disallowed_url");
  }
  return url;
}

async function defaultLookup(host: string): Promise<string[]> {
  const answers = await dnsLookup(host, { all: true, verbatim: true });
  return answers.map((answer) => answer.address);
}

/** Settles with `promise`, or rejects as `timeout` once `signal` aborts. A DNS
 * lookup cannot be cancelled, so a hung resolver is abandoned, not awaited. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new ImageFetchError("timeout"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new ImageFetchError("timeout"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

async function assertPublicHost(
  host: string,
  lookup: (host: string) => Promise<string[]>,
  signal: AbortSignal
): Promise<void> {
  const addresses = await untilAborted(lookup(host), signal);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new ImageFetchError("private_address");
  }
}

// ─── Body ────────────────────────────────────────────────────────────────────

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ImageFetchError("too_large");
  }
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ImageFetchError("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

// ─── The fetch ───────────────────────────────────────────────────────────────

export async function fetchIngestImage(
  url: string,
  deps: FetchIngestImageDeps = {}
): Promise<{ bytes: Uint8Array; type: SniffedImageType }> {
  const lookup = deps.lookup ?? defaultLookup;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    let current = allowedUrl(url);
    for (let hop = 0; ; hop++) {
      await assertPublicHost(current.hostname, lookup, controller.signal);
      const response = await fetchImpl(current.toString(), { redirect: "manual", signal: controller.signal });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => {});
        if (!location) throw new ImageFetchError(`http_${response.status}`);
        if (hop >= maxRedirects) throw new ImageFetchError("too_many_redirects");
        current = allowedUrl(location, current);
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel().catch(() => {});
        throw new ImageFetchError(`http_${response.status}`);
      }

      const bytes = await readCapped(response, maxBytes);
      const type = sniffImageType(bytes);
      if (!type) throw new ImageFetchError("not_image");
      return { bytes, type };
    }
  } catch (error) {
    if (error instanceof ImageFetchError) throw error;
    if (controller.signal.aborted) throw new ImageFetchError("timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
