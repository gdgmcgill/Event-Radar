"use client";
import { useState, type FormEvent } from "react";
import type { CompanyRequestInput } from "@/contracts/intake";
import {
  Field,
  FormStatus,
  Honeypot,
  NETWORK_MESSAGE,
  RATE_MESSAGE,
  SelectField,
  SentNotice,
  isEmail,
  isHttpUrl,
  optional,
  requireFields,
  sendIntake,
} from "./fields";

type WorkModeValue = CompanyRequestInput["work_mode"];
type EmploymentValue = CompanyRequestInput["employment_type"];

const WORK_MODES: ReadonlyArray<readonly [WorkModeValue, string]> = [
  ["in_person", "In person"],
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
];
const EMPLOYMENT: ReadonlyArray<readonly [EmploymentValue, string]> = [
  ["internship", "Internship"],
  ["part_time", "Part-time"],
  ["full_time", "Full-time"],
  ["contract", "Contract"],
];

const REQUIRED = [
  "company_name",
  "company_context",
  "role_title",
  "duties",
  "must_have_skills",
  "hours",
  "compensation",
  "location",
  "work_mode",
  "start_date",
  "employment_type",
  "why_worth_it",
  "contact_name",
  "contact_email",
] as const;

const EMPTY: Record<string, string> = Object.fromEntries(
  [...REQUIRED, "nice_to_have_skills", "source_url", "website"].map((key) => [key, ""])
);

export function buildCompanyRequest(v: Record<string, string>): CompanyRequestInput {
  return {
    company_name: v.company_name.trim(),
    company_context: v.company_context.trim(),
    role_title: v.role_title.trim(),
    duties: v.duties.trim(),
    must_have_skills: v.must_have_skills.trim(),
    nice_to_have_skills: optional(v.nice_to_have_skills),
    hours: v.hours.trim(),
    compensation: v.compensation.trim(),
    location: v.location.trim(),
    work_mode: v.work_mode as WorkModeValue,
    start_date: v.start_date.trim(),
    employment_type: v.employment_type as EmploymentValue,
    why_worth_it: v.why_worth_it.trim(),
    source_url: optional(v.source_url),
    contact_name: v.contact_name.trim(),
    contact_email: v.contact_email.trim(),
    website: v.website ? v.website : undefined,
  };
}

function validate(v: Record<string, string>): Record<string, string> {
  const errors = requireFields(v, REQUIRED);
  if (!errors.contact_email && !isEmail(v.contact_email)) errors.contact_email = "Enter a valid email address";
  if (v.source_url.trim() && !isHttpUrl(v.source_url)) errors.source_url = "Use a full link starting with https://";
  return errors;
}

export function CompanyRequestForm() {
  const [values, setValues] = useState<Record<string, string>>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (key: string) => (value: string) => {
    setValues((old) => ({ ...old, [key]: value }));
    setErrors((old) => {
      if (!old[key]) return old;
      const next = { ...old };
      delete next[key];
      return next;
    });
  };
  const field = (key: string) => ({ id: key, value: values[key], onChange: set(key), error: errors[key] });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus("Check the highlighted fields.");
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const outcome = await sendIntake("/api/company-requests", buildCompanyRequest(values));
      if (outcome.kind === "sent") setSent(true);
      else if (outcome.kind === "rate") setStatus(RATE_MESSAGE);
      else if (outcome.kind === "rejected") {
        const field = outcome.field;
        if (field && field in values) {
          setErrors({ [field]: outcome.message });
          setStatus("Check the highlighted fields.");
        } else setStatus(outcome.message);
      }
      else setStatus(NETWORK_MESSAGE);
    } catch {
      setStatus(NETWORK_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  if (sent) return <SentNotice />;

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-base font-semibold">The company</legend>
        <Field {...field("company_name")} label="Company name" required maxLength={200} autoComplete="organization" />
        <Field {...field("company_context")} label="About the company" required maxLength={1000} multiline rows={3} />
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-base font-semibold">The role</legend>
        <Field {...field("role_title")} label="Role title" required maxLength={200} />
        <Field {...field("duties")} label="What the student will do" required maxLength={3000} multiline rows={5} />
        <Field {...field("must_have_skills")} label="Must-have skills" required maxLength={1000} multiline rows={3} />
        <Field {...field("nice_to_have_skills")} label="Nice-to-have skills (optional)" maxLength={1000} multiline rows={3} />
        <Field {...field("hours")} label="Hours" required maxLength={120} hint="For example: 15 hours a week, flexible" />
        <Field {...field("compensation")} label="Compensation" required maxLength={200} />
        <Field {...field("location")} label="Location" required maxLength={200} />
        <SelectField {...field("work_mode")} label="Work mode" options={WORK_MODES} placeholder="Choose one" required />
        <Field {...field("start_date")} label="Start date" required maxLength={60} />
        <SelectField {...field("employment_type")} label="Employment type" options={EMPLOYMENT} placeholder="Choose one" required />
        <Field {...field("why_worth_it")} label="Why it's worth it for a student" required maxLength={1000} multiline rows={3} />
        <Field {...field("source_url")} label="Job posting link (optional)" type="url" maxLength={2048} hint="Students apply on your site." />
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">Who we should contact</legend>
        <p className="text-xs text-muted-foreground">
          Your contact details stay private. They are used only to ask about this request and are never published or copied into a listing.
        </p>
        <Field {...field("contact_name")} label="Your name" required maxLength={120} autoComplete="name" />
        <Field {...field("contact_email")} label="Your work email" type="email" required maxLength={254} autoComplete="email" />
      </fieldset>
      <Honeypot value={values.website} onChange={set("website")} />
      {status && <FormStatus>{status}</FormStatus>}
      <button type="submit" disabled={sending} className="rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">
        {sending ? "Sending…" : "Send hiring request"}
      </button>
    </form>
  );
}
