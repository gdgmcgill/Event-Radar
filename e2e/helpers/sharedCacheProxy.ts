/**
 * sharedCacheProxy.ts — a local stand-in for Vercel's shared CDN cache.
 *
 * Phase 06-slices-6-7-async-edge-contracts-caching-observability · plan 06-15
 * (REFAC-19, F-025, research § "The shared-cache simulator", Pitfall 10)
 *
 * WHY IT EXISTS
 *   `next start` has no shared cache, so "user B never receives user A's body"
 *   passes trivially against it, whatever headers the app sends. This process
 *   sits in front of the app and caches exactly what Vercel's CDN would, keyed
 *   the way Vercel keys (method and URL, never the cookie). A personalized
 *   route marked shareable would then leak through it, which is what gives the
 *   cross-user spec its teeth. The spec proves both halves with controls: a
 *   public route HITs, and a deliberately misclassified upstream leaks.
 *
 * THE RULES MODELLED (Vercel's documented CDN cacheability rules)
 *   A response is stored only when every one of these holds:
 *     - the request method is GET or HEAD;
 *     - the request carries no Authorization header;
 *     - the status is 200 or 404;
 *     - the response carries no Set-Cookie;
 *     - the governing directive (Vercel-CDN-Cache-Control, else
 *       CDN-Cache-Control, else Cache-Control) names no private, no-cache or
 *       no-store, and gives a positive shared lifetime: s-maxage, or max-age on
 *       the two CDN-specific headers;
 *     - Vary names neither Cookie nor `*`.
 *   The key is `METHOD URL` (path and query). Cookies are not part of it; that
 *   is the property under test.
 *   A stored entry answers until its lifetime ends; after that the next request
 *   goes to the upstream again. stale-while-revalidate is not modelled (a spec
 *   runs well inside the shortest lifetime, 30 s).
 *
 * WHAT IT ANSWERS
 *   Every response carries `x-sim-cache`:
 *     HIT    served from memory; the upstream was not contacted;
 *     MISS   fetched from the upstream and stored;
 *     BYPASS fetched from the upstream and not stored, because a rule above
 *            forbids it.
 *   `stats()` counts upstream requests and hits, so a spec can prove a HIT
 *   never reached the origin.
 *
 * WHAT IT NEVER DOES
 *   Bodies live in memory only, in this process, and are dropped by close().
 *   Nothing is written to disk, logged, or returned outside the HTTP answer
 *   (threat T-06-15-04). It listens on 127.0.0.1 on an ephemeral port, and the
 *   spec that starts it closes it in afterAll. Node built-ins only: no
 *   dependency was added for it.
 */

import http from "node:http";
import type { AddressInfo, Socket } from "node:net";

export type SimCacheResult = "HIT" | "MISS" | "BYPASS";

export interface SharedCacheProxy {
  /** `http://localhost:<port>`, matching the browser persona cookie host. */
  url: string;
  /** Upstream requests made, and hits served, since start. */
  stats(): { upstream: number; hits: number };
  /** Stops listening, destroys open sockets and drops every stored body. */
  close(): Promise<void>;
}

interface Entry {
  status: number;
  headers: http.OutgoingHttpHeaders;
  body: Buffer;
  expiresAt: number;
}

/** Headers that describe one hop and are never forwarded. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const CACHEABLE_METHODS = new Set(["GET", "HEAD"]);
const CACHEABLE_STATUSES = new Set([200, 404]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Directive name → value (lower-cased names; `true` for a bare directive). */
function parseDirectives(header: string): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (const part of header.split(",")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) continue;
    const value = rest.join("=").trim().replace(/^"|"$/g, "");
    out.set(rawName.trim().toLowerCase(), rest.length ? value : true);
  }
  return out;
}

/**
 * The shared lifetime in seconds Vercel would give this response, or null
 * when a rule forbids storing it.
 */
export function sharedLifetime(
  method: string,
  requestHeaders: http.IncomingHttpHeaders,
  status: number,
  responseHeaders: http.IncomingHttpHeaders
): number | null {
  if (!CACHEABLE_METHODS.has(method.toUpperCase())) return null;
  if (requestHeaders.authorization !== undefined) return null;
  if (!CACHEABLE_STATUSES.has(status)) return null;
  if (responseHeaders["set-cookie"] !== undefined) return null;

  const vary = (first(responseHeaders.vary) ?? "").toLowerCase();
  if (vary.split(",").some((v) => ["cookie", "*"].includes(v.trim()))) {
    return null;
  }

  const cdnSpecific =
    first(responseHeaders["vercel-cdn-cache-control"]) ??
    first(responseHeaders["cdn-cache-control"]);
  const header = cdnSpecific ?? first(responseHeaders["cache-control"]);
  if (!header) return null;
  const directives = parseDirectives(header);
  for (const forbidden of ["private", "no-cache", "no-store"]) {
    if (directives.has(forbidden)) return null;
  }
  const lifetime =
    directives.get("s-maxage") ??
    (cdnSpecific !== undefined ? directives.get("max-age") : undefined);
  const seconds = typeof lifetime === "string" ? Number(lifetime) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function forwardable(
  headers: http.IncomingHttpHeaders
): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    out[name] = value;
  }
  return out;
}

function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Starts the stand-in in front of `upstream` (an origin such as
 * `http://127.0.0.1:3000`) and resolves once it is listening.
 */
export async function startSharedCacheProxy(
  upstream: string
): Promise<SharedCacheProxy> {
  const origin = new URL(upstream);
  const store = new Map<string, Entry>();
  const sockets = new Set<Socket>();
  let upstreamCount = 0;
  let hitCount = 0;

  function send(
    res: http.ServerResponse,
    method: string,
    status: number,
    headers: http.OutgoingHttpHeaders,
    body: Buffer,
    result: SimCacheResult
  ): void {
    res.writeHead(status, {
      ...headers,
      "content-length": String(body.length),
      "x-sim-cache": result,
    });
    res.end(method === "HEAD" ? undefined : body);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method ?? "GET").toUpperCase();
      const path = req.url ?? "/";
      const key = `${method} ${path}`;

      const stored = store.get(key);
      if (stored && stored.expiresAt > Date.now()) {
        if (req.headers.authorization === undefined) {
          hitCount += 1;
          send(res, method, stored.status, stored.headers, stored.body, "HIT");
          return;
        }
      } else if (stored) {
        store.delete(key);
      }

      const requestBody = await readAll(req);
      const headers = forwardable(req.headers);
      headers.host = origin.host;
      if (requestBody.length > 0) {
        headers["content-length"] = String(requestBody.length);
      }

      upstreamCount += 1;
      const upstreamRes = await new Promise<http.IncomingMessage>(
        (resolve, reject) => {
          const outgoing = http.request(
            {
              protocol: origin.protocol,
              hostname: origin.hostname,
              port: origin.port,
              method,
              path,
              headers,
            },
            resolve
          );
          outgoing.on("error", reject);
          outgoing.end(requestBody);
        }
      );
      const body = await readAll(upstreamRes);
      const status = upstreamRes.statusCode ?? 502;
      const responseHeaders = forwardable(upstreamRes.headers);
      delete responseHeaders["content-length"];

      const lifetime = sharedLifetime(
        method,
        req.headers,
        status,
        upstreamRes.headers
      );
      if (lifetime === null) {
        send(res, method, status, responseHeaders, body, "BYPASS");
        return;
      }
      store.set(key, {
        status,
        headers: responseHeaders,
        body,
        expiresAt: Date.now() + lifetime * 1000,
      });
      send(res, method, status, responseHeaders, body, "MISS");
    } catch {
      // No request or response detail is echoed or logged (no body, no cookie).
      if (!res.headersSent) {
        res.writeHead(502, { "x-sim-cache": "BYPASS" });
      }
      res.end();
    }
  });

  server.on("connection", (socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    stats: () => ({ upstream: upstreamCount, hits: hitCount }),
    close: () =>
      new Promise<void>((resolve) => {
        store.clear();
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
