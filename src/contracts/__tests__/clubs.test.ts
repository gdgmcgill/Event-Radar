/**
 * The clubs and organizer-request contracts, input by input (plan 06-09,
 * REFAC-15, DEC-65, DEC-66).
 *
 * Every expected 400 body below is COPIED from the 06-07 table
 * (src/__tests__/contracts/badRequestTable.ts), the club-links suite
 * (src/__tests__/api/review05/club-links.test.ts) or the club PRESERVE suites,
 * not re-derived: a contract is correct only if it answers the same first 400
 * the handler's own ladder answered, in the same order. `field` is asserted
 * through the same `fieldFor` keys the routes pass. Valid inputs are asserted
 * to parse to the values the handler used before.
 *
 * The rows marked DEC-66 are the one club-link rule: an absolute http(s) URL
 * is kept, a scheme-less host path is stored with https:// prefixed, any
 * other scheme answers `Invalid URL for <field>`. The rows marked F-094 are
 * the other deliberate changes: a wrongly typed field now answers the
 * contract's 400 where the handler threw or coerced it.
 */

import { imageBytes } from "../../__tests__/helpers/imageBytes";
import { z } from "zod";
import { checkFile, parseForm, parseWith, readQuery } from "@/server/body";
import {
  CLUB_BANNER_UPLOAD,
  CLUB_CREATE_FIELD_KEYS,
  CLUB_LOGO_UPLOAD,
  CLUB_UPDATE_FIELD_KEYS,
  ClubAppealBody,
  ClubCreateBody,
  ClubDeleteBody,
  ClubImageForm,
  ClubInviteBody,
  ClubLinkFields,
  ClubMemberBody,
  ClubMemberRoleBody,
  ClubTransferBody,
  ClubUpdateBody,
  OrganizerRequestBody,
  TrendingQuery,
  normalizeClubLink,
} from "@/contracts/clubs";

async function firstError(
  schema: z.ZodType,
  input: unknown,
  fieldFor?: readonly string[]
) {
  const result = parseWith(schema, input, { fieldFor });
  if (result.ok) return { ok: true as const, data: result.data };
  return {
    ok: false as const,
    status: result.response.status,
    body: await result.response.json(),
  };
}

async function refused(
  schema: z.ZodType,
  input: unknown,
  fieldFor?: readonly string[]
) {
  const outcome = await firstError(schema, input, fieldFor);
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

const UNSAFE = [
  "javascript:alert(1)",
  "JavaScript:alert(document.cookie)",
  "java\tscript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "ftp://x",
];

// ─── The one link rule (DEC-66) ──────────────────────────────────────────────

describe("normalizeClubLink and ClubLinkFields (DEC-66)", () => {
  it("keeps an absolute http(s) URL byte for byte", () => {
    expect(normalizeClubLink("https://x.org/a")).toBe("https://x.org/a");
    expect(normalizeClubLink("http://127.0.0.1:54321/storage/v1/x.png")).toBe(
      "http://127.0.0.1:54321/storage/v1/x.png"
    );
    // The handler trims; the rule does not rewrite what it keeps.
    expect(normalizeClubLink(" https://club.example/x ")).toBe(
      " https://club.example/x "
    );
  });

  it("stores a scheme-less host path with https:// prefixed", () => {
    expect(normalizeClubLink("instagram.com/club")).toBe(
      "https://instagram.com/club"
    );
    expect(normalizeClubLink("yourclub.com")).toBe("https://yourclub.com");
    expect(normalizeClubLink(" club.ca ")).toBe("https://club.ca");
  });

  it.each(UNSAFE)("refuses %p (another scheme)", (value) => {
    expect(normalizeClubLink(value)).toBeNull();
  });

  it.each(["x", "not a link", "/relative/path", "my club.ca"])(
    "refuses %p (neither a URL nor a host path)",
    (value) => {
      expect(normalizeClubLink(value)).toBeNull();
    }
  );

  it("leaves a blank string for the handler to clear", () => {
    expect(normalizeClubLink("  ")).toBe("  ");
  });

  it("ClubLinkFields maps instagram.com/club to https://instagram.com/club", async () => {
    await expect(
      accepted(ClubLinkFields, { website_url: "instagram.com/club" })
    ).resolves.toEqual({ website_url: "https://instagram.com/club" });
  });

  it("ClubLinkFields refuses javascript:alert(1) with Invalid URL for, and no field", async () => {
    await expect(
      refused(ClubLinkFields, { twitter_url: "javascript:alert(1)" }, CLUB_UPDATE_FIELD_KEYS)
    ).resolves.toEqual({ error: "Invalid URL for twitter_url" });
  });

  it("ClubLinkFields keeps null (clears) and keys that are not links", async () => {
    await expect(
      accepted(ClubLinkFields, { discord_url: null, name: "Club" })
    ).resolves.toEqual({ discord_url: null, name: "Club" });
  });

  it("ClubLinkFields checks the links in the PATCH order", async () => {
    await expect(
      refused(ClubLinkFields, { banner_url: "ftp://a", website_url: "javascript:x" })
    ).resolves.toEqual({ error: "Invalid URL for website_url" });
  });
});

// ─── clubs POST ──────────────────────────────────────────────────────────────

const NEW_CLUB = {
  name: "Contract Society",
  description: "We write schemas",
  category: "academic",
  contact_email: "contracts@mail.mcgill.ca",
};

describe("ClubCreateBody (clubs POST)", () => {
  const post = (body: unknown) => refused(ClubCreateBody, body, CLUB_CREATE_FIELD_KEYS);

  it.each([
    [{ ...NEW_CLUB, website_url: 5 }, { error: "Invalid value for website_url", field: "website_url" }],
    [{ ...NEW_CLUB, logo_url: ["x"] }, { error: "Invalid value for logo_url", field: "logo_url" }],
    [{ ...NEW_CLUB, discord_url: "javascript:alert(1)" }, { error: "Invalid URL for discord_url" }],
    [{ ...NEW_CLUB, name: "" }, { error: "Name, description, and category are required" }],
    [{ ...NEW_CLUB, description: undefined }, { error: "Name, description, and category are required" }],
    [{ ...NEW_CLUB, category: "<i></i>" }, { error: "Name, description, and category are required" }],
    [{ ...NEW_CLUB, contact_email: undefined }, { error: "Contact email is required" }],
    [{ ...NEW_CLUB, contact_email: 5 }, { error: "Contact email is required" }],
    [{ ...NEW_CLUB, contact_email: "not-an-email" }, { error: "Please provide a valid email address" }],
    [{ ...NEW_CLUB, name: "n".repeat(101) }, { error: "Name max 100 chars, description max 500 chars" }],
    [{ ...NEW_CLUB, description: "d".repeat(501) }, { error: "Name max 100 chars, description max 500 chars" }],
    // order rows
    [{ twitter_url: 1 }, { error: "Invalid value for twitter_url", field: "twitter_url" }],
    [{ description: "d", category: "c" }, { error: "Name, description, and category are required" }],
  ])("%j answers the table's 400", async (body, expected) => {
    await expect(post(body)).resolves.toEqual(expected);
  });

  it.each(UNSAFE.slice(0, 5))("refuses website_url %p (club-links)", async (value) => {
    await expect(post({ ...NEW_CLUB, website_url: value })).resolves.toEqual({
      error: "Invalid URL for website_url",
    });
  });

  it.each([[42], [{ a: 1 }], [true]])(
    "refuses a non-string discord_url %p naming the field (club-links)",
    async (value) => {
      await expect(post({ ...NEW_CLUB, discord_url: value })).resolves.toEqual({
        error: "Invalid value for discord_url",
        field: "discord_url",
      });
    }
  );

  it("checks each optional field's type, then its link, in the handler's order", async () => {
    // logo_url is the first optional field: its bad URL answers before a
    // later field's bad type.
    await expect(
      post({ ...NEW_CLUB, logo_url: "javascript:x", website_url: 5 })
    ).resolves.toEqual({ error: "Invalid URL for logo_url" });
    await expect(
      post({ ...NEW_CLUB, instagram_handle: 5, logo_url: "https://x.org/l.png" })
    ).resolves.toEqual({
      error: "Invalid value for instagram_handle",
      field: "instagram_handle",
    });
  });

  it("does not hold instagram_handle to the link rule", async () => {
    const data = await accepted(ClubCreateBody, {
      ...NEW_CLUB,
      instagram_handle: "javascript:club",
    });
    expect(data.instagram_handle).toBe("javascript:club");
  });

  it("F-094: a non-string name answers the required text (was coerced to \"5\")", async () => {
    await expect(
      post({ name: 5, description: "We write schemas", category: "academic" })
    ).resolves.toEqual({ error: "Name, description, and category are required" });
    await expect(post({ ...NEW_CLUB, category: { a: 1 } })).resolves.toEqual({
      error: "Name, description, and category are required",
    });
  });

  it("parses a valid body to the values the handler used", async () => {
    const data = await accepted(ClubCreateBody, {
      ...NEW_CLUB,
      name: " <b>Contract</b> Society ",
      contact_email: " contracts@mail.mcgill.ca ",
      logo_url: "https://x.org/logo.png",
      linkedin_url: "https://linkedin.com/company/x",
      twitter_url: null,
      extra: "ignored",
    });
    expect(data).toEqual({
      name: "Contract Society",
      description: "We write schemas",
      category: "academic",
      // Trimmed by the handler, as before.
      contact_email: " contracts@mail.mcgill.ca ",
      logo_url: "https://x.org/logo.png",
      linkedin_url: "https://linkedin.com/company/x",
      twitter_url: null,
    });
  });

  it("DEC-66: a scheme-less website is stored with https:// prefixed", async () => {
    const data = await accepted(ClubCreateBody, {
      ...NEW_CLUB,
      website_url: "yourclub.com",
      linkedin_url: "https://linkedin.com/company/x",
    });
    expect(data.website_url).toBe("https://yourclub.com");
    expect(data.linkedin_url).toBe("https://linkedin.com/company/x");
  });

  it("DEC-66: a value that is neither a URL nor a host path is refused", async () => {
    await expect(post({ ...NEW_CLUB, website_url: "x" })).resolves.toEqual({
      error: "Invalid URL for website_url",
    });
  });
});

// ─── clubs/[id] PATCH and DELETE ─────────────────────────────────────────────

describe("ClubUpdateBody (clubs/[id] PATCH)", () => {
  const patch = (body: unknown) => refused(ClubUpdateBody, body, CLUB_UPDATE_FIELD_KEYS);

  it.each([
    [{ description: 5 }, { error: "Invalid value for description", field: "description" }],
    [{ banner_url: "ftp://a.ca/b.png" }, { error: "Invalid URL for banner_url" }],
    [{ contact_email: "nope" }, { error: "Invalid email format for contact_email" }],
    [{ status: "approved" }, { error: "No valid fields to update" }],
    // order rows
    [{ website_url: "x", name: 5 }, { error: "Invalid value for name", field: "name" }],
    [{ contact_email: "nope", linkedin_url: "x" }, { error: "Invalid URL for linkedin_url" }],
  ])("%j answers the table's 400", async (body, expected) => {
    await expect(patch(body)).resolves.toEqual(expected);
  });

  it.each(
    ["website_url", "discord_url", "twitter_url", "linkedin_url", "logo_url", "banner_url"].flatMap(
      (field) => UNSAFE.slice(0, 5).map((value) => [field, value] as const)
    )
  )("refuses %s %p (club-links)", async (field, value) => {
    await expect(patch({ [field]: value })).resolves.toEqual({
      error: `Invalid URL for ${field}`,
    });
  });

  it.each([[42], [true], [{ a: 1 }], [["x"]]])(
    "refuses a non-string description %p naming the field (club-links)",
    async (value) => {
      await expect(patch({ description: value })).resolves.toEqual({
        error: "Invalid value for description",
        field: "description",
      });
    }
  );

  it("keeps only whitelisted keys, trimmed; blank and null clear", async () => {
    const data = await accepted(ClubUpdateBody, {
      name: " Club ",
      website_url: " https://club.example/x ",
      discord_url: null,
      twitter_url: "  ",
      status: "approved",
      created_by: "someone",
    });
    expect(data).toEqual({
      name: "Club",
      website_url: "https://club.example/x",
      discord_url: null,
      twitter_url: null,
    });
  });

  it("DEC-66: a scheme-less link is accepted with https:// prefixed (was refused)", async () => {
    await expect(accepted(ClubUpdateBody, { website_url: "club.ca" })).resolves.toEqual({
      website_url: "https://club.ca",
    });
    await expect(
      accepted(ClubUpdateBody, { linkedin_url: " linkedin.com/company/x " })
    ).resolves.toEqual({ linkedin_url: "https://linkedin.com/company/x" });
  });

  it("checks contact_email after the links, on the trimmed value", async () => {
    await expect(
      accepted(ClubUpdateBody, { contact_email: " a@b.ca " })
    ).resolves.toEqual({ contact_email: "a@b.ca" });
    await expect(accepted(ClubUpdateBody, { contact_email: null })).resolves.toEqual({
      contact_email: null,
    });
  });
});

describe("ClubDeleteBody (clubs/[id] DELETE)", () => {
  it("passes confirmName as sent; the name match stays in the handler", async () => {
    await expect(accepted(ClubDeleteBody, { confirmName: "Club" })).resolves.toEqual({
      confirmName: "Club",
    });
    await expect(accepted(ClubDeleteBody, { confirmName: 5 })).resolves.toEqual({
      confirmName: 5,
    });
    await expect(accepted(ClubDeleteBody, {})).resolves.toEqual({});
  });
});

// ─── invites, members, role, transfer, appeal, organizer-requests ────────────

describe("ClubInviteBody (clubs/[id]/invites POST)", () => {
  it.each([
    [{}, "Email is required"],
    [{ email: "" }, "Email is required"],
    [{ email: "not-an-email" }, "Enter a valid email address"],
    [{ email: "   " }, "Enter a valid email address"],
  ])("%j answers %p", async (body, error) => {
    await expect(refused(ClubInviteBody, body)).resolves.toEqual({ error });
  });

  it.each(["person@gmail.com", "person@concordia.ca"])("P1-02 permits invitation to %s without granting authority", async email => {
    await expect(accepted(ClubInviteBody, { email })).resolves.toEqual({ email });
  });

  it("F-094: a non-string email answers the required text (was a 500 on .trim())", async () => {
    await expect(refused(ClubInviteBody, { email: 5 })).resolves.toEqual({
      error: "Email is required",
    });
  });

  it("parses to the normalized email the handler used", async () => {
    await expect(
      accepted(ClubInviteBody, { email: " New.Member@Mail.McGill.ca " })
    ).resolves.toEqual({ email: "new.member@mail.mcgill.ca" });
  });
});

describe("ClubMemberBody (clubs/[id]/members DELETE)", () => {
  it("memberId is required (truthy); any truthy value reaches the handler's lookup", async () => {
    await expect(refused(ClubMemberBody, {})).resolves.toEqual({
      error: "memberId is required",
    });
    await expect(refused(ClubMemberBody, { memberId: "" })).resolves.toEqual({
      error: "memberId is required",
    });
    await expect(accepted(ClubMemberBody, { memberId: 5 })).resolves.toEqual({
      memberId: 5,
    });
  });
});

describe("ClubMemberRoleBody (clubs/[id]/members/role PATCH)", () => {
  const MSG = "Invalid request. Role must be 'organizer'.";
  it.each([
    [{ role: "organizer" }],
    [{ memberId: "m1", role: "owner" }],
    [{ memberId: "m1", role: 5 }],
    [{}],
  ])("%j answers the one message", async (body) => {
    await expect(refused(ClubMemberRoleBody, body)).resolves.toEqual({ error: MSG });
  });

  it("parses memberId and role", async () => {
    await expect(
      accepted(ClubMemberRoleBody, { memberId: "m1", role: "organizer" })
    ).resolves.toEqual({ memberId: "m1", role: "organizer" });
  });
});

describe("ClubTransferBody (clubs/[id]/transfer POST)", () => {
  it("newOwnerId is required; the self and membership rules stay in the handler", async () => {
    await expect(refused(ClubTransferBody, {})).resolves.toEqual({
      error: "newOwnerId is required",
    });
    await expect(accepted(ClubTransferBody, { newOwnerId: "u2" })).resolves.toEqual({
      newOwnerId: "u2",
    });
    await expect(accepted(ClubTransferBody, { newOwnerId: 5 })).resolves.toEqual({
      newOwnerId: 5,
    });
  });
});

describe("ClubAppealBody (clubs/[id]/appeal POST)", () => {
  it.each([[{}], [{ message: " " }], [{ message: 5 }]])(
    "%j answers Appeal message is required (a number threw on .trim(): F-094)",
    async (body) => {
      await expect(refused(ClubAppealBody, body)).resolves.toEqual({
        error: "Appeal message is required",
      });
    }
  );

  it("passes the message as sent; the handler trims it", async () => {
    await expect(accepted(ClubAppealBody, { message: " please " })).resolves.toEqual({
      message: " please ",
    });
  });
});

describe("OrganizerRequestBody (organizer-requests POST)", () => {
  it("club_id is required; message passes as sent", async () => {
    await expect(refused(OrganizerRequestBody, { message: "please" })).resolves.toEqual({
      error: "club_id is required",
    });
    await expect(
      accepted(OrganizerRequestBody, { club_id: "c1", message: "please" })
    ).resolves.toEqual({ club_id: "c1", message: "please" });
    await expect(accepted(OrganizerRequestBody, { club_id: 5 })).resolves.toEqual({
      club_id: 5,
    });
  });
});

// ─── clubs/banner and clubs/logo (multipart) ─────────────────────────────────

describe("ClubImageForm with CLUB_BANNER_UPLOAD and CLUB_LOGO_UPLOAD", () => {
  const MB = 1024 * 1024;

  function file(size: number, type: string, name = "x.png"): File {
    return new File([imageBytes(size, type)], name, { type });
  }

  function formRequest(entries: [string, string | File][]): Request {
    const form = new FormData();
    for (const [key, value] of entries) form.append(key, value);
    return new Request("http://localhost/api/clubs/logo", { method: "POST", body: form });
  }

  async function body(result: Awaited<ReturnType<typeof parseForm>>) {
    if (result.ok) throw new Error("expected a refusal");
    return { status: result.response.status, body: await result.response.json() };
  }

  it.each([
    ["no file", [["clubId", "c1"]] as [string, string | File][]],
    ["no clubId", [["file", file(4, "image/png")]] as [string, string | File][]],
    ["empty clubId", [["file", file(4, "image/png")], ["clubId", ""]] as [string, string | File][]],
  ])("%s answers File and clubId are required", async (_label, entries) => {
    for (const opts of [CLUB_BANNER_UPLOAD, CLUB_LOGO_UPLOAD]) {
      await expect(body(await parseForm(formRequest(entries), ClubImageForm, opts))).resolves.toEqual({
        status: 400,
        body: { error: "File and clubId are required" },
      });
    }
  });

  it("leaves the type and size checks for after the ownership gate", async () => {
    const result = await parseForm(
      formRequest([["file", file(3 * MB, "text/plain")], ["clubId", "c1"]]),
      ClubImageForm,
      CLUB_LOGO_UPLOAD
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fields).toEqual({ clubId: "c1" });
  });

  it.each([
    [CLUB_BANNER_UPLOAD, file(4, "image/gif"), "File must be JPEG, PNG, or WebP"],
    [CLUB_BANNER_UPLOAD, file(5 * MB + 1, "image/png"), "File must be under 5MB"],
    [CLUB_BANNER_UPLOAD, file(5 * MB + 1, "text/plain"), "File must be JPEG, PNG, or WebP"],
    [CLUB_LOGO_UPLOAD, file(4, "text/plain"), "File must be JPEG, PNG, or WebP"],
    [CLUB_LOGO_UPLOAD, file(2 * MB + 1, "image/png"), "File must be under 2MB"],
    [CLUB_LOGO_UPLOAD, file(2 * MB + 1, "text/plain"), "File must be JPEG, PNG, or WebP"],
  ])("checkFile answers the route's text, type before size", async (opts, upload, error) => {
    const refusal = checkFile(upload, opts.file);
    expect(refusal?.status).toBe(400);
    await expect(refusal?.json()).resolves.toEqual({ error });
  });

  it("accepts a file exactly at the limit", () => {
    expect(checkFile(file(2 * MB, "image/webp"), CLUB_LOGO_UPLOAD.file)).toBeNull();
    expect(checkFile(file(5 * MB, "image/jpeg"), CLUB_BANNER_UPLOAD.file)).toBeNull();
  });

  // M0 CERT-02: transport errors are client 400s, not storage failures.
  it.each([CLUB_LOGO_UPLOAD, CLUB_BANNER_UPLOAD])("rejects unreadable forms before upload", async (opts) => {
    for (const contentType of ["application/json", "multipart/form-data; boundary=missing"]) {
      const request = new Request("http://localhost/api/clubs/logo", {
        method: "POST", headers: { "content-type": contentType }, body: "{}",
      });
      await expect(body(await parseForm(request, ClubImageForm, opts)))
        .resolves.toEqual({ status: 400, body: { error: "Invalid multipart form data" } });
    }
  });
});

// ─── clubs/trending GET ──────────────────────────────────────────────────────

describe("TrendingQuery (clubs/trending GET, no 400)", () => {
  it.each([
    ["", 15],
    ["?limit=", 15],
    ["?limit=abc", 15],
    ["?limit=0", 15],
    ["?limit=5", 5],
    ["?limit=5.9", 5],
    ["?limit=500", 100],
    ["?limit=-3", -3],
    ["?limit=7&limit=9", 7],
  ])("%p reads limit %p, as the handler computed it", (query, limit) => {
    expect(readQuery(new URLSearchParams(query), TrendingQuery)).toEqual({ limit });
  });
});
