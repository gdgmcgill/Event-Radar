/**
 * Unit tests for src/lib/observability/scrub.ts — the isomorphic half of the
 * Sentry scrubber (DEC-76, REFAC-21, threat T-06-16-01).
 *
 * Phase 06 · plan 06-16.
 *
 * The contract: `scrubEventFields(event)` returns the event with
 *   - request.cookies, request.data, request.query_string and request.env
 *     deleted, the query string and fragment cut from request.url;
 *   - the cookie, authorization and client-IP request headers deleted (any
 *     case);
 *   - the query string cut from contexts.nextjs.request_path and from the
 *     url/from/to of breadcrumb data;
 *   - every email-shaped substring, anywhere in the event (message, exception
 *     values, breadcrumb messages, extra, contexts, tags), replaced by
 *     "[email]";
 *   - sdkProcessingMetadata left alone (SDK-internal, never serialized).
 * It leaves the user to its caller: the server replaces it with a hash, the
 * browser removes it.
 */

import type { ErrorEvent } from "@sentry/nextjs";
import { redactEmails, scrubEventFields } from "./scrub";

function baseEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: "0123456789abcdef0123456789abcdef",
    message: "failed for student.one@mail.mcgill.ca at /api/events",
    exception: {
      values: [
        {
          type: "Error",
          value: "duplicate key for owner@example.com",
        },
      ],
    },
    request: {
      url: "https://uni-verse.example/api/users/search?q=owner%40example.com&page=2#frag",
      method: "POST",
      query_string: "q=owner@example.com&page=2",
      cookies: { "sb-access-token": "secret-cookie-value" },
      data: '{"email":"student.one@mail.mcgill.ca","password":"hunter2"}',
      env: { REMOTE_ADDR: "203.0.113.9" },
      headers: {
        Cookie: "sb-access-token=secret-cookie-value",
        authorization: "Bearer secret-bearer",
        "x-forwarded-for": "203.0.113.9",
        "X-Real-IP": "203.0.113.9",
        "user-agent": "jest",
        "x-request-id": "3f0c2b1a-9d8e-4f7a-8b6c-5d4e3f2a1b0c",
      },
    },
    contexts: {
      nextjs: {
        request_path: "/events?invite=owner@example.com",
        route_type: "render",
      },
    },
    breadcrumbs: [
      { message: "signed in as owner@example.com", category: "auth" },
      {
        category: "fetch",
        data: {
          url: "http://127.0.0.1:54321/rest/v1/users?email=eq.owner@example.com",
          method: "GET",
          status_code: 200,
        },
      },
    ],
    extra: { note: "contact admin@example.org", nested: { deep: ["x@y.io"] } },
    tags: { route: "/api/events", who: "a.b@c.de" },
    sdkProcessingMetadata: { keep: "internal owner@example.com" },
  } as unknown as ErrorEvent;
}

describe("redactEmails", () => {
  it("replaces every email-shaped substring with [email]", () => {
    expect(redactEmails("a x.y+z@mail.mcgill.ca b c@d.io")).toBe("a [email] b [email]");
  });

  it("leaves text without an email unchanged", () => {
    expect(redactEmails("no address here @ all")).toBe("no address here @ all");
  });
});

describe("scrubEventFields", () => {
  it("deletes request cookies, data, query_string and env", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.request).toBeDefined();
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request).not.toHaveProperty("data");
    expect(event.request).not.toHaveProperty("query_string");
    expect(event.request).not.toHaveProperty("env");
  });

  it("cuts the query string and fragment from request.url", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.request?.url).toBe("https://uni-verse.example/api/users/search");
  });

  it("deletes the cookie, authorization and client-IP headers in any case, keeps the rest", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.request?.headers).toEqual({
      "user-agent": "jest",
      "x-request-id": "3f0c2b1a-9d8e-4f7a-8b6c-5d4e3f2a1b0c",
    });
  });

  it("cuts the query string from contexts.nextjs.request_path", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.contexts?.nextjs?.request_path).toBe("/events");
    expect(event.contexts?.nextjs?.route_type).toBe("render");
  });

  it("cuts the query string from breadcrumb data urls", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.breadcrumbs?.[1]?.data?.url).toBe("http://127.0.0.1:54321/rest/v1/users");
    expect(event.breadcrumbs?.[1]?.data?.status_code).toBe(200);
  });

  it("redacts emails in the message, exception values and breadcrumb messages", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.message).toBe("failed for [email] at /api/events");
    expect(event.exception?.values?.[0]?.value).toBe("duplicate key for [email]");
    expect(event.breadcrumbs?.[0]?.message).toBe("signed in as [email]");
  });

  it("leaves no email-shaped string anywhere in the serialized event", () => {
    const event = scrubEventFields(baseEvent());
    const { sdkProcessingMetadata: _internal, ...sent } = event;
    const json = JSON.stringify(sent);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
    expect(json).not.toContain("secret-cookie-value");
    expect(json).not.toContain("secret-bearer");
    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("203.0.113.9");
  });

  it("leaves sdkProcessingMetadata alone", () => {
    const event = scrubEventFields(baseEvent());
    expect(event.sdkProcessingMetadata).toEqual({ keep: "internal owner@example.com" });
  });

  it("does not touch the user (the caller decides)", () => {
    const event = baseEvent();
    event.user = { id: "u-1" };
    expect(scrubEventFields(event).user).toEqual({ id: "u-1" });
  });

  it("accepts an event with no request, contexts or breadcrumbs", () => {
    const event = { message: "plain", event_id: "e" } as unknown as ErrorEvent;
    expect(scrubEventFields(event)).toEqual({ message: "plain", event_id: "e" });
  });

  it("survives a circular value without throwing", () => {
    const event = baseEvent();
    const loop: Record<string, unknown> = { email: "loop@example.com" };
    loop.self = loop;
    (event.extra as Record<string, unknown>).loop = loop;
    expect(() => scrubEventFields(event)).not.toThrow();
    expect((event.extra as Record<string, Record<string, unknown>>).loop.email).toBe("[email]");
  });
});
