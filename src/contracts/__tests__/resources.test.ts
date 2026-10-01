import { ResourceCreateBody, ResourceFields, ResourceMutationBody } from "../resources";

const base = {
  slug: "career-fair-guide",
  title: "Career fair guide",
  summary: "How to work a career fair",
  category: "career" as const,
  audience: "Undergraduates",
  author_name: "Ady",
};

describe("ResourceCreateBody", () => {
  it("rejects a guide without body text", () => {
    const result = ResourceCreateBody.safeParse({ ...base, resource_type: "guide", body_markdown: null });
    expect(result.success).toBe(false);
  });

  it("accepts a guide with body text", () => {
    const result = ResourceCreateBody.safeParse({ ...base, resource_type: "guide", body_markdown: "Body text." });
    expect(result.success).toBe(true);
  });

  it("rejects an external resource without an https source URL", () => {
    expect(ResourceCreateBody.safeParse({ ...base, resource_type: "external", external_url: null }).success).toBe(false);
    expect(ResourceCreateBody.safeParse({ ...base, resource_type: "external", external_url: "http://example.org" }).success).toBe(false);
    expect(ResourceCreateBody.safeParse({ ...base, resource_type: "external", external_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("accepts an external resource with an https source URL", () => {
    expect(ResourceCreateBody.safeParse({ ...base, resource_type: "external", external_url: "https://example.org" }).success).toBe(true);
  });

  it("rejects a template that also declares an external URL", () => {
    const result = ResourceCreateBody.safeParse({ ...base, resource_type: "template", external_url: "https://example.org" });
    expect(result.success).toBe(false);
  });

  it("accepts a template without an external URL", () => {
    const result = ResourceCreateBody.safeParse({ ...base, resource_type: "template" });
    expect(result.success).toBe(true);
  });

  it("rejects a body containing an iframe", () => {
    const result = ResourceCreateBody.safeParse({
      ...base,
      resource_type: "guide",
      body_markdown: "Safe text <iframe src=\"https://evil.test\"></iframe>",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid slug", () => {
    const result = ResourceCreateBody.safeParse({ ...base, resource_type: "template", slug: "Not A Slug!" });
    expect(result.success).toBe(false);
  });
});

describe("ResourceFields strictness", () => {
  it("rejects an unknown status key", () => {
    const result = ResourceFields.safeParse({ ...base, resource_type: "template", status: "published" });
    expect(result.success).toBe(false);
  });
});

describe("ResourceMutationBody", () => {
  it("rejects an edit payload that tries to set status through data", () => {
    const result = ResourceMutationBody.safeParse({
      action: "edit",
      expected_updated_at: "2026-01-01T00:00:00Z",
      data: { status: "published" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed edit payload", () => {
    const result = ResourceMutationBody.safeParse({
      action: "edit",
      expected_updated_at: "2026-01-01T00:00:00Z",
      data: { title: "Updated title" },
    });
    expect(result.success).toBe(true);
  });

  it("a partial edit never fills in unsent fields with defaulted nulls (fix round 1, IMPORTANT)", () => {
    const result = ResourceMutationBody.safeParse({
      action: "edit",
      expected_updated_at: "2026-01-01T00:00:00Z",
      data: { title: "Updated title" },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.action === "edit") {
      expect(result.data.data).toEqual({ title: "Updated title" });
    }
  });

  it("refuses an edit whose data is empty (M3 final review)", () => {
    const result = ResourceMutationBody.safeParse({
      action: "edit",
      expected_updated_at: "2026-01-01T00:00:00Z",
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts publish and archive with only the expected version", () => {
    expect(
      ResourceMutationBody.safeParse({ action: "publish", expected_updated_at: "2026-01-01T00:00:00Z" }).success
    ).toBe(true);
    expect(
      ResourceMutationBody.safeParse({ action: "archive", expected_updated_at: "2026-01-01T00:00:00Z" }).success
    ).toBe(true);
  });
});
