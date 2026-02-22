import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const RATE_LIMIT_STORE_KEY = "__uni_verse_rate_limit_store__";

type GlobalWithRateLimitStore = typeof globalThis & {
  [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitBucket>;
};

const globalWithStore = globalThis as GlobalWithRateLimitStore;

const rateLimitStore =
  globalWithStore[RATE_LIMIT_STORE_KEY] ?? new Map<string, RateLimitBucket>();

if (!globalWithStore[RATE_LIMIT_STORE_KEY]) {
  globalWithStore[RATE_LIMIT_STORE_KEY] = rateLimitStore;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const ip = getClientIp(request);
  const key = `${config.keyPrefix}:${ip}`;
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      ),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function enforceRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  const result = checkRateLimit(request, config);

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: "Too Many Requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    }
  );
}
