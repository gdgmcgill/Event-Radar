/**
 * Unit tests for the seam's error vocabulary.
 *
 * These assert the wire format is byte-identical to what handlers under
 * src/app/** already emit. A seam that changes the response body is a
 * behaviour change wearing a refactor's clothes (L1).
 */

import {
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "../errors";

describe("badRequest", () => {
  it("returns 400 with a bare error body when no field is given", async () => {
    const response = badRequest("Start date is required");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Start date is required",
    });
  });

  it("carries the field when one is given, matching the create-event shape", async () => {
    const response = badRequest("Start date is required", "start_date");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Start date is required",
      field: "start_date",
    });
  });

  it("omits the field key entirely rather than emitting undefined", async () => {
    const response = badRequest("Bad input");
    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["error"]);
  });
});

describe("unauthorized", () => {
  it("defaults to the existing 401 Unauthorized body", async () => {
    const response = unauthorized();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("accepts an override message but keeps the 401 status", async () => {
    const response = unauthorized("Sign in to continue");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in to continue",
    });
  });
});

describe("forbidden", () => {
  it("returns 403 with the supplied message", async () => {
    const response = forbidden("Only the club owner can delete the club");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the club owner can delete the club",
    });
  });
});

describe("notFound", () => {
  it("returns 404 with the supplied message", async () => {
    const response = notFound("Club not found");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Club not found" });
  });
});

describe("serverError", () => {
  it("returns 500 with the generic Failed to <action> body", async () => {
    const response = serverError("fetch club");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch club",
    });
  });

  it("never leaks the underlying cause into the response body", async () => {
    const response = serverError("update event");
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toEqual({ error: "Failed to update event" });
    expect(Object.keys(body)).toEqual(["error"]);
  });
});
