import { NextRequest } from "next/server";
import { IntakeNotConfigured, clientHash } from "../clientHash";

const request = (ip: string) =>
  new NextRequest("http://localhost/api/submissions", { method: "POST", headers: { "x-real-ip": ip } });

const original = process.env.INTAKE_HASH_SECRET;
const originalVercel = process.env.VERCEL;
afterEach(() => {
  if (original === undefined) delete process.env.INTAKE_HASH_SECRET;
  else process.env.INTAKE_HASH_SECRET = original;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("clientHash", () => {
  it("gives the same 64-hex value for the same address", () => {
    process.env.INTAKE_HASH_SECRET = "test-secret-one";
    const first = clientHash(request("203.0.113.9"));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(clientHash(request("203.0.113.9"))).toBe(first);
  });

  it("never contains the raw address", () => {
    process.env.INTAKE_HASH_SECRET = "test-secret-one";
    const hash = clientHash(request("203.0.113.9"));
    expect(hash).not.toContain("203.0.113.9");
    expect(hash).not.toBe("203.0.113.9");
  });

  it("changes with the secret, so the hash cannot be recomputed without it", () => {
    process.env.INTAKE_HASH_SECRET = "test-secret-one";
    const one = clientHash(request("203.0.113.9"));
    process.env.INTAKE_HASH_SECRET = "test-secret-two";
    expect(clientHash(request("203.0.113.9"))).not.toBe(one);
  });

  it("separates different addresses and falls back to a local salt when unset", () => {
    delete process.env.INTAKE_HASH_SECRET;
    expect(clientHash(request("203.0.113.9"))).toMatch(/^[0-9a-f]{64}$/);
    expect(clientHash(request("203.0.113.9"))).not.toBe(clientHash(request("203.0.113.10")));
  });

  it("refuses to run on a hosted deploy without a secret instead of using the public salt", () => {
    delete process.env.INTAKE_HASH_SECRET;
    process.env.VERCEL = "1";
    expect(() => clientHash(request("203.0.113.9"))).toThrow(IntakeNotConfigured);
  });

  it("uses the configured secret on a hosted deploy", () => {
    process.env.INTAKE_HASH_SECRET = "hosted-secret";
    process.env.VERCEL = "1";
    expect(clientHash(request("203.0.113.9"))).toMatch(/^[0-9a-f]{64}$/);
  });
});
