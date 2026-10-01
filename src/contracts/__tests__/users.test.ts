/**
 * The users and profile contracts, input by input (plan 06-09, REFAC-15,
 * DEC-65).
 *
 * Every expected 400 body below is COPIED from the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts) or the user and profile
 * PRESERVE suites, not re-derived: a contract is correct only if it answers
 * the same first 400 the handler's own ladder answered, in the same order.
 * None of these routes emits `field`. Valid inputs are asserted to parse to
 * the values the handler used before (trimmed where it trimmed, as sent where
 * it stored the value as sent), and the query contracts to the values the
 * handler read, with no new 400.
 */

import { imageBytes } from "../../__tests__/helpers/imageBytes";
import { z } from "zod";
import { parseForm, parseWith, readQuery } from "@/server/body";
import { VALID_INTEREST_TAGS } from "@/lib/constants";
import { EventTag } from "@/types";
import {
  AVATAR_UPLOAD,
  InferredTagBody,
  InterestsBody,
  PROFILE_BANNER_UPLOAD,
  ProfileImageForm,
  SavedEventsQuery,
  UserSearchQuery,
  UserUpdateBody,
} from "@/contracts/users";

async function firstError(schema: z.ZodType, input: unknown) {
  const result = parseWith(schema, input);
  if (result.ok) return { ok: true as const, data: result.data };
  return {
    ok: false as const,
    status: result.response.status,
    body: await result.response.json(),
  };
}

async function refused(schema: z.ZodType, input: unknown) {
  const outcome = await firstError(schema, input);
  if (outcome.ok) throw new Error(`expected a 400 for ${JSON.stringify(input)}`);
  expect(outcome.status).toBe(400);
  return outcome.body;
}

async function accepted<S extends z.ZodType>(
  schema: S,
  input: unknown
): Promise<z.output<S>> {
  const outcome = await firstError(schema, input);
  if (!outcome.ok) throw new Error(`unexpected 400 ${JSON.stringify(outcome.body)}`);
  return outcome.data as z.output<S>;
}

// ─── users/[id] PATCH ────────────────────────────────────────────────────────

describe("UserUpdateBody (users/[id] PATCH)", () => {
  const NAME = "Name must be between 2 and 50 characters long";

  it.each([
    [{ name: " a " }, NAME],
    [{ name: "n".repeat(51) }, NAME],
    [{ name: 5 }, NAME],
    [{ name: null }, NAME],
    [{ avatar_url: 5 }, "Avatar URL must be a string or null"],
    [{ avatar_url: "avatar.png" }, "Invalid Avatar URL format"],
    [{ banner_url: true }, "Banner URL must be a string or null"],
    [{ banner_url: "banner.png" }, "Invalid Banner URL format"],
    [{ interest_tags: "academic" }, "interest_tags must be an array"],
    [{ interest_tags: null }, "interest_tags must be an array"],
    [{ interest_tags: ["academic", "knitting"] }, "Invalid tag values provided in interest_tags"],
    [{ interest_tags: [5] }, "Invalid tag values provided in interest_tags"],
    [{ pronouns: 1 }, "Pronouns must be a string or null"],
    [{ year: 2 }, "Year must be a string or null"],
    [{ faculty: ["Arts"] }, "Faculty must be a string or null"],
    [{ visibility: "friends" }, "Visibility must be 'public' or 'private'"],
    [{ visibility: null }, "Visibility must be 'public' or 'private'"],
    [{ onboarding_completed: "yes" }, "onboarding_completed must be a boolean"],
    [{ email: "x@mail.mcgill.ca" }, "No fields to update"],
    [{}, "No fields to update"],
    // order rows
    [{ visibility: "x", name: "a" }, NAME],
    [{ year: 1, pronouns: 1 }, "Pronouns must be a string or null"],
    [{ onboarding_completed: 1, avatar_url: "bad" }, "Invalid Avatar URL format"],
  ])("%j answers %p", async (body, error) => {
    await expect(refused(UserUpdateBody, body)).resolves.toEqual({ error });
  });

  it("parses to the payload the handler built (trimmed name and URLs, the rest as sent)", async () => {
    await expect(
      accepted(UserUpdateBody, {
        name: "  Ada Lovelace ",
        avatar_url: " https://cdn.test/a.png ",
        banner_url: "",
        interest_tags: [EventTag.ACADEMIC],
        pronouns: " she/her ",
        year: null,
        faculty: "Arts",
        visibility: "private",
        onboarding_completed: true,
        email: "ignored@mail.mcgill.ca",
      })
    ).resolves.toEqual({
      name: "Ada Lovelace",
      avatar_url: "https://cdn.test/a.png",
      banner_url: null,
      interest_tags: [EventTag.ACADEMIC],
      pronouns: " she/her ",
      year: null,
      faculty: "Arts",
      visibility: "private",
      onboarding_completed: true,
    });
  });

  it("clears avatar_url and banner_url on null or blank", async () => {
    await expect(
      accepted(UserUpdateBody, { avatar_url: null, banner_url: "   " })
    ).resolves.toEqual({ avatar_url: null, banner_url: null });
  });

  it("accepts every tag the handler accepted (EventTag values and quick filters)", async () => {
    await expect(
      accepted(UserUpdateBody, { interest_tags: VALID_INTEREST_TAGS })
    ).resolves.toEqual({ interest_tags: VALID_INTEREST_TAGS });
    await expect(accepted(UserUpdateBody, { interest_tags: [] })).resolves.toEqual({
      interest_tags: [],
    });
  });

  it("a URL the handler accepted is still accepted (any scheme new URL() parses)", async () => {
    await expect(
      accepted(UserUpdateBody, { avatar_url: "http://127.0.0.1:54321/storage/v1/x.png" })
    ).resolves.toEqual({ avatar_url: "http://127.0.0.1:54321/storage/v1/x.png" });
  });
});

// ─── profile/interests PUT and profile/inferred-tags DELETE ──────────────────

describe("InterestsBody (profile/interests PUT)", () => {
  it.each([
    [{ interest_tags: "academic" }, "interest_tags must be an array"],
    [{}, "interest_tags must be an array"],
    [{ interest_tags: ["knitting"] }, "Invalid tag values provided"],
    [{ interest_tags: [5] }, "Invalid tag values provided"],
  ])("%j answers %p", async (body, error) => {
    await expect(refused(InterestsBody, body)).resolves.toEqual({ error });
  });

  it("parses the tags as sent", async () => {
    await expect(
      accepted(InterestsBody, { interest_tags: [EventTag.SOCIAL, EventTag.ACADEMIC] })
    ).resolves.toEqual({ interest_tags: [EventTag.SOCIAL, EventTag.ACADEMIC] });
    await expect(accepted(InterestsBody, { interest_tags: [] })).resolves.toEqual({
      interest_tags: [],
    });
  });
});

describe("InferredTagBody (profile/inferred-tags DELETE)", () => {
  it.each([[{}], [{ tag: "" }], [{ tag: ["academic"] }], [{ tag: 5 }]])(
    "%j answers tag is required and must be a string",
    async (body) => {
      await expect(refused(InferredTagBody, body)).resolves.toEqual({
        error: "tag is required and must be a string",
      });
    }
  );

  it("parses the tag as sent", async () => {
    await expect(accepted(InferredTagBody, { tag: "academic" })).resolves.toEqual({
      tag: "academic",
    });
  });
});

// ─── profile/avatar and profile/banner (multipart; type before size) ─────────

describe("ProfileImageForm with AVATAR_UPLOAD and PROFILE_BANNER_UPLOAD", () => {
  const MB = 1024 * 1024;

  function file(size: number, type: string): File {
    return new File([imageBytes(size, type)], "x.bin", { type });
  }

  function formRequest(entries: [string, string | File][]): Request {
    const form = new FormData();
    for (const [key, value] of entries) form.append(key, value);
    return new Request("http://localhost/api/profile/avatar", { method: "POST", body: form });
  }

  async function outcome(result: Awaited<ReturnType<typeof parseForm>>) {
    if (result.ok) return { ok: true };
    return { status: result.response.status, body: await result.response.json() };
  }

  it.each([
    [AVATAR_UPLOAD, [], "No file provided"],
    [AVATAR_UPLOAD, [["file", file(4, "text/plain")]], "Invalid file type. Allowed: JPEG, PNG, WebP, GIF"],
    [AVATAR_UPLOAD, [["file", file(5 * MB + 1, "image/png")]], "File too large. Maximum size is 5MB"],
    [AVATAR_UPLOAD, [["file", file(5 * MB + 1, "text/plain")]], "Invalid file type. Allowed: JPEG, PNG, WebP, GIF"],
    [PROFILE_BANNER_UPLOAD, [], "No file provided"],
    [PROFILE_BANNER_UPLOAD, [["file", file(4, "image/gif")]], "Invalid file type. Allowed: JPEG, PNG, WebP"],
    [PROFILE_BANNER_UPLOAD, [["file", file(8 * MB + 1, "image/png")]], "File too large. Maximum size is 8MB"],
    [PROFILE_BANNER_UPLOAD, [["file", file(8 * MB + 1, "text/plain")]], "Invalid file type. Allowed: JPEG, PNG, WebP"],
  ] as const)("answers the route's text (%#)", async (opts, entries, error) => {
    const result = await parseForm(
      formRequest(entries as unknown as [string, string | File][]),
      ProfileImageForm,
      opts
    );
    await expect(outcome(result)).resolves.toEqual({ status: 400, body: { error } });
  });

  it("accepts a file at the limit of each route's own types", async () => {
    for (const [opts, upload] of [
      [AVATAR_UPLOAD, file(5 * MB, "image/gif")],
      [PROFILE_BANNER_UPLOAD, file(8 * MB, "image/webp")],
    ] as const) {
      const result = await parseForm(formRequest([["file", upload]]), ProfileImageForm, opts);
      expect(result.ok).toBe(true);
    }
  });

  // M0 CERT-02: both profile upload endpoints reject malformed transport.
  it.each([AVATAR_UPLOAD, PROFILE_BANNER_UPLOAD])("rejects unreadable forms before upload", async (opts) => {
    for (const contentType of ["application/json", "multipart/form-data; boundary=missing"]) {
      const request = new Request("http://localhost/api/profile/avatar", {
        method: "POST", headers: { "content-type": contentType }, body: "{}",
      });
      await expect(outcome(await parseForm(request, ProfileImageForm, opts)))
        .resolves.toEqual({ status: 400, body: { error: "Invalid multipart form data" } });
    }
  });
});

// ─── users/saved-events GET and users/search GET (no 400) ────────────────────

describe("SavedEventsQuery (users/saved-events GET)", () => {
  it.each([
    ["", { sort: "recent", include_past: false }],
    ["?sort=", { sort: "recent", include_past: false }],
    ["?sort=date", { sort: "date", include_past: false }],
    ["?sort=title&include_past=true", { sort: "title", include_past: true }],
    ["?sort=bogus&include_past=1", { sort: "bogus", include_past: false }],
    ["?include_past=TRUE", { sort: "recent", include_past: false }],
  ])("%p reads %j", (query, expected) => {
    expect(readQuery(new URLSearchParams(query), SavedEventsQuery)).toEqual(expected);
  });
});

describe("UserSearchQuery (users/search GET)", () => {
  it.each([
    ["", undefined],
    ["?q=", ""],
    ["?q=%20a%20", "a"],
    ["?q=%20Ada%20", "Ada"],
    ["?q=ab&q=cd", "ab"],
  ])("%p reads q %p (trimmed, as the handler read it)", (query, q) => {
    expect(readQuery(new URLSearchParams(query), UserSearchQuery)).toEqual({ q });
  });
});
