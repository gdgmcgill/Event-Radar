/**
 * Unit tests for the seam's success vocabulary and the named cache classes.
 *
 * Every success shape asserted here already exists in the tree: a plain JSON
 * body at 200, `{ success: true }` at 200, and a created resource at 201.
 *
 * The cache classes (DEC-73, research C9): `private` is `private, no-store` on
 * every status; a public class sets its public value only on GET or HEAD with
 * status 200 or 404, and `private, no-store` otherwise. No class sets Vary.
 */

import { NextResponse } from "next/server";
import {
  CACHE_CLASSES,
  applyCachePolicy,
  cachePolicy,
  created,
  ok,
  success,
  type CacheClass,
} from "../http";

describe("ok", () => {
  it("returns 200 and echoes the body unchanged", async () => {
    const response = ok({ club: { id: "club-1" }, followerCount: 0 });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      club: { id: "club-1" },
      followerCount: 0,
    });
  });

  it("does not wrap the body in an envelope", async () => {
    const response = ok({ id: "event-1" });
    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["id"]);
  });
});

describe("created", () => {
  it("returns 201 and echoes the body unchanged", async () => {
    const response = created({ following: true });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ following: true });
  });
});

describe("success", () => {
  it("returns the existing 200 { success: true } acknowledgement", async () => {
    const response = success();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});

describe("CACHE_CLASSES and cachePolicy", () => {
  it("names exactly the four classes", () => {
    expect([...CACHE_CLASSES]).toEqual([
      "private",
      "public-60-300",
      "public-30-60",
      "public-60-120",
    ]);
  });

  it.each<[CacheClass, string]>([
    ["private", "private, no-store"],
    ["public-60-300", "public, s-maxage=60, stale-while-revalidate=300"],
    ["public-30-60", "public, s-maxage=30, stale-while-revalidate=60"],
    ["public-60-120", "public, s-maxage=60, stale-while-revalidate=120"],
  ])("cachePolicy(%s) is %s", (cls, value) => {
    expect(cachePolicy(cls)).toBe(value);
  });
});

describe("applyCachePolicy", () => {
  const json = (status: number) => NextResponse.json({}, { status });

  it.each<[CacheClass, string, number, string]>([
    ["public-60-300", "GET", 200, "public, s-maxage=60, stale-while-revalidate=300"],
    ["public-60-300", "GET", 404, "public, s-maxage=60, stale-while-revalidate=300"],
    ["public-60-300", "HEAD", 200, "public, s-maxage=60, stale-while-revalidate=300"],
    ["public-30-60", "GET", 200, "public, s-maxage=30, stale-while-revalidate=60"],
    ["public-60-120", "get", 200, "public, s-maxage=60, stale-while-revalidate=120"],
    ["public-60-300", "POST", 200, "private, no-store"],
    ["public-60-300", "PATCH", 200, "private, no-store"],
    ["public-60-300", "DELETE", 404, "private, no-store"],
    ["public-60-300", "GET", 401, "private, no-store"],
    ["public-60-300", "GET", 403, "private, no-store"],
    ["public-60-300", "GET", 500, "private, no-store"],
    ["public-30-60", "GET", 400, "private, no-store"],
    ["public-60-120", "GET", 201, "private, no-store"],
    ["private", "GET", 200, "private, no-store"],
    ["private", "POST", 500, "private, no-store"],
  ])("%s on %s %i sets %s", (cls, method, status, value) => {
    const res = applyCachePolicy(json(status), cls, method);
    expect(res.headers.get("cache-control")).toBe(value);
  });

  it("returns the same response object", () => {
    const res = json(200);
    expect(applyCachePolicy(res, "private", "GET")).toBe(res);
  });

  it("replaces a Cache-Control the response already had", () => {
    const res = NextResponse.json({}, { headers: { "Cache-Control": "public, max-age=600" } });
    applyCachePolicy(res, "private", "GET");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each([...CACHE_CLASSES])("never sets Vary (%s)", (cls) => {
    const res = applyCachePolicy(json(200), cls, "GET");
    expect(res.headers.get("vary")).toBeNull();
  });
});
