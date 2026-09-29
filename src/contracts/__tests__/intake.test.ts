import {
  CompanyRequestBody,
  ListingReportBody,
  ListingReportResolveBody,
  SubmissionAdminQuery,
  SubmissionBody,
  SubmissionReviewBody,
  toIntakeDetails,
} from "../intake";

const job = {
  kind: "job" as const,
  title: "Research assistant",
  organization: "Neuro lab",
  source_url: "https://example.org/ra",
  description: "Help run experiments.",
};

const company = {
  company_name: "Acme Robotics",
  company_context: "We build warehouse robots.",
  role_title: "Junior developer",
  duties: "Write and test TypeScript services.",
  must_have_skills: "TypeScript",
  hours: "15 hours a week",
  compensation: "$22/hour",
  location: "Montréal",
  work_mode: "hybrid" as const,
  start_date: "January 2027",
  employment_type: "part_time" as const,
  why_worth_it: "Real mentorship.",
  contact_name: "Pat Recruiter",
  contact_email: "hiring@acme.example",
};

describe("SubmissionBody", () => {
  it("accepts a valid job submission", () => {
    expect(SubmissionBody.safeParse(job).success).toBe(true);
  });

  it("rejects a forged status or editorial key", () => {
    expect(SubmissionBody.safeParse({ ...job, status: "published" }).success).toBe(false);
    expect(SubmissionBody.safeParse({ ...job, is_pick: true }).success).toBe(false);
  });

  it("rejects a javascript: source URL", () => {
    expect(SubmissionBody.safeParse({ ...job, source_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("rejects a 2001-character description", () => {
    expect(SubmissionBody.safeParse({ ...job, description: "a".repeat(2001) }).success).toBe(false);
    expect(SubmissionBody.safeParse({ ...job, description: "a".repeat(2000) }).success).toBe(true);
  });

  it("rejects raw HTML in the description", () => {
    expect(SubmissionBody.safeParse({ ...job, description: "Apply <script>alert(1)</script>" }).success).toBe(false);
  });

  it("rejects a field that belongs to another kind", () => {
    expect(SubmissionBody.safeParse({ ...job, starts_on: "2027-01-01" }).success).toBe(false);
    expect(SubmissionBody.safeParse({ ...job, kind: "event", starts_on: "2027-01-01" }).success).toBe(true);
  });

  it("requires an https source for a resource suggestion", () => {
    const resource = { ...job, kind: "resource" as const, category: "career" as const };
    expect(SubmissionBody.safeParse(resource).success).toBe(true);
    expect(SubmissionBody.safeParse({ ...resource, source_url: "http://example.org/ra" }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(SubmissionBody.safeParse({ ...job, kind: "company_request" }).success).toBe(false);
  });
});

describe("CompanyRequestBody", () => {
  it("accepts a complete hiring request", () => {
    expect(CompanyRequestBody.safeParse(company).success).toBe(true);
  });

  it("rejects a request without a contact email", () => {
    const { contact_email: _omit, ...rest } = company;
    void _omit;
    expect(CompanyRequestBody.safeParse(rest).success).toBe(false);
  });

  it("rejects a forged status key", () => {
    expect(CompanyRequestBody.safeParse({ ...company, status: "published" }).success).toBe(false);
  });

  it("rejects a multibyte request whose details exceed the stored byte budget", () => {
    const euro = (n: number) => "€".repeat(n); // 1 UTF-16 unit, 3 UTF-8 bytes
    const heavy = {
      ...company,
      company_context: euro(1000),
      duties: euro(3000),
      must_have_skills: euro(1000),
      nice_to_have_skills: euro(1000),
      why_worth_it: euro(1000),
    };
    const result = CompanyRequestBody.safeParse(heavy);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Submission is too long.");
    // The same characters in ASCII stay within budget.
    expect(CompanyRequestBody.safeParse({ ...heavy, company_context: "a".repeat(1000), duties: "a".repeat(3000), must_have_skills: "a".repeat(1000), nice_to_have_skills: "a".repeat(1000), why_worth_it: "a".repeat(1000) }).success).toBe(true);
  });
});

describe("ListingReportBody", () => {
  const report = { kind: "event" as const, id: "ad080001-0000-4000-8000-000000000001", reason: "dead_link" as const };
  it("accepts a valid report and rejects a guessed non-UUID id or unknown reason", () => {
    expect(ListingReportBody.safeParse(report).success).toBe(true);
    expect(ListingReportBody.safeParse({ ...report, id: "1 OR 1=1" }).success).toBe(false);
    expect(ListingReportBody.safeParse({ ...report, reason: "spam" }).success).toBe(false);
    expect(ListingReportBody.safeParse({ ...report, details: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("toIntakeDetails", () => {
  it("keeps only the per-kind extra fields, trimmed, omitting empties", () => {
    const parsed = SubmissionBody.parse({ ...job, location: "  Montréal  ", work_mode: "remote", contact_email: "a@b.example", website: "" });
    expect(toIntakeDetails(parsed)).toEqual({ description: "Help run experiments.", location: "Montréal", work_mode: "remote" });
  });

  it("never carries company contact fields into details", () => {
    const details = toIntakeDetails(CompanyRequestBody.parse({ ...company, nice_to_have_skills: " " }));
    expect(details).not.toHaveProperty("contact_email");
    expect(details).not.toHaveProperty("contact_name");
    expect(details).not.toHaveProperty("company_name");
    expect(details).not.toHaveProperty("nice_to_have_skills");
    expect(details.duties).toBe(company.duties);
  });
});

describe("admin review contracts", () => {
  it("defaults the queue to pending and bounds the limit", () => {
    expect(SubmissionAdminQuery.parse({})).toEqual({ status: "pending", limit: 50 });
    expect(SubmissionAdminQuery.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("requires a reason to reject and a version for every action", () => {
    const at = "2026-09-29T00:00:00Z";
    expect(SubmissionReviewBody.safeParse({ action: "reject", expected_updated_at: at }).success).toBe(false);
    expect(SubmissionReviewBody.safeParse({ action: "reject", expected_updated_at: at, reason: "Duplicate" }).success).toBe(true);
    expect(SubmissionReviewBody.safeParse({ action: "convert" }).success).toBe(false);
    expect(SubmissionReviewBody.safeParse({ action: "convert", expected_updated_at: at, status: "published" }).success).toBe(false);
    expect(ListingReportResolveBody.safeParse({ action: "resolve", note: "Fixed" }).success).toBe(true);
    expect(ListingReportResolveBody.safeParse({ action: "delete" }).success).toBe(false);
  });
});
