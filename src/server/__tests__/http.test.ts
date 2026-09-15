/**
 * Unit tests for the seam's success vocabulary.
 *
 * Every shape asserted here already exists in the tree: a plain JSON body at
 * 200, `{ success: true }` at 200, and a created resource at 201.
 */

import { created, ok, success } from "../http";

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
