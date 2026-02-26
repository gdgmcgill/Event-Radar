import { logger } from "./logger";

export interface ResilientFetchOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreaker?: boolean;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

const circuits = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 5;
const RECOVERY_TIME_MS = 30_000;

function getCircuit(key: string): CircuitState {
  if (!circuits.has(key)) {
    circuits.set(key, { failures: 0, lastFailure: 0, state: "closed" });
  }
  return circuits.get(key)!;
}

function recordSuccess(key: string): void {
  const circuit = getCircuit(key);
  circuit.failures = 0;
  circuit.state = "closed";
}

function recordFailure(key: string): void {
  const circuit = getCircuit(key);
  circuit.failures += 1;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = "open";
    logger.warn("Circuit breaker opened", { service: key, failures: circuit.failures });
  }
}

function isCircuitOpen(key: string): boolean {
  const circuit = getCircuit(key);

  if (circuit.state === "closed") return false;

  if (circuit.state === "open") {
    const elapsed = Date.now() - circuit.lastFailure;
    if (elapsed >= RECOVERY_TIME_MS) {
      circuit.state = "half-open";
      logger.info("Circuit breaker half-open, allowing probe", { service: key });
      return false;
    }
    return true;
  }

  // half-open: allow one request
  return false;
}

export function getCircuitState(key: string): CircuitState["state"] {
  return getCircuit(key).state;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function resilientFetch(
  url: string,
  init?: RequestInit,
  options?: ResilientFetchOptions
): Promise<Response> {
  const {
    timeout = 5000,
    retries = 2,
    retryDelay = 1000,
    circuitBreaker = true,
  } = options ?? {};

  const circuitKey = new URL(url).origin;

  if (circuitBreaker && isCircuitOpen(circuitKey)) {
    logger.warn("Circuit breaker is open, skipping request", { url });
    return new Response(
      JSON.stringify({ error: "Service unavailable (circuit open)" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, timeout);

      if (response.ok) {
        if (circuitBreaker) recordSuccess(circuitKey);
        return response;
      }

      if (response.status < 500) {
        if (circuitBreaker) recordSuccess(circuitKey);
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
      logger.warn("Request failed with 5xx, retrying", {
        url,
        status: response.status,
        attempt: attempt + 1,
        maxRetries: retries,
      });
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      logger.warn("Request failed", {
        url,
        reason: isAbort ? "timeout" : "network_error",
        attempt: attempt + 1,
        maxRetries: retries,
      });
    }

    if (attempt < retries) {
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (circuitBreaker) recordFailure(circuitKey);

  logger.error("All retries exhausted", lastError, { url, retries });

  return new Response(
    JSON.stringify({ error: "Service unavailable after retries" }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}
