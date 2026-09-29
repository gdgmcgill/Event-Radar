"use client";
import { useState, type FormEvent } from "react";
import type { SubmissionInput } from "@/contracts/intake";
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

type Kind = SubmissionInput["kind"];
type WorkModeValue = "in_person" | "remote" | "hybrid";
type CategoryValue = "career" | "applications" | "hackathons" | "academics" | "funding" | "campus_life";

const KINDS: ReadonlyArray<readonly [Kind, string]> = [
  ["event", "Event"],
  ["hackathon", "Hackathon"],
  ["job", "Job or internship"],
  ["program", "Program"],
  ["resource", "Resource"],
];
const WORK_MODES: ReadonlyArray<readonly [WorkModeValue, string]> = [
  ["in_person", "In person"],
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
];
const CATEGORIES: ReadonlyArray<readonly [CategoryValue, string]> = [
  ["career", "Career"],
  ["applications", "Applications"],
  ["hackathons", "Hackathons"],
  ["academics", "Academics"],
  ["funding", "Funding"],
  ["campus_life", "Campus life"],
];

const EMPTY: Record<string, string> = {
  title: "",
  organization: "",
  source_url: "",
  description: "",
  starts_on: "",
  deadline_on: "",
  location: "",
  work_mode: "",
  category: "",
  audience: "",
  contact_name: "",
  contact_email: "",
  website: "",
};

/** Builds the typed body for the chosen kind. Fields that belong to another
 * kind are never sent, and empty optional fields are omitted. */
export function buildSubmission(kind: Kind, v: Record<string, string>): SubmissionInput {
  const common = {
    title: v.title.trim(),
    organization: v.organization.trim(),
    source_url: v.source_url.trim(),
    description: v.description.trim(),
    contact_name: optional(v.contact_name),
    contact_email: optional(v.contact_email),
    website: v.website ? v.website : undefined,
  };
  if (kind === "event" || kind === "hackathon")
    return { kind, ...common, starts_on: optional(v.starts_on), location: optional(v.location) };
  if (kind === "job" || kind === "program")
    return {
      kind,
      ...common,
      deadline_on: optional(v.deadline_on),
      location: optional(v.location),
      work_mode: optional(v.work_mode) as WorkModeValue | undefined,
    };
  return {
    kind,
    ...common,
    category: optional(v.category) as CategoryValue | undefined,
    audience: optional(v.audience),
  };
}

function validate(kind: Kind, v: Record<string, string>): Record<string, string> {
  const errors = requireFields(v, ["title", "organization", "source_url", "description"]);
  if (!errors.source_url && !isHttpUrl(v.source_url)) errors.source_url = "Use a full link starting with https://";
  if (!errors.source_url && kind === "resource" && !/^https:\/\//i.test(v.source_url.trim()))
    errors.source_url = "Resources need an https:// link";
  if (v.contact_email.trim() && !isEmail(v.contact_email)) errors.contact_email = "Enter a valid email address";
  return errors;
}

export function SubmitForm() {
  const [kind, setKind] = useState<Kind>("event");
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const found = validate(kind, values);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus("Check the highlighted fields.");
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const outcome = await sendIntake("/api/submissions", buildSubmission(kind, values));
      if (outcome.kind === "sent") setSent(true);
      else if (outcome.kind === "rate") setStatus(RATE_MESSAGE);
      else if (outcome.kind === "rejected") setStatus(outcome.message);
      else setStatus(NETWORK_MESSAGE);
    } catch {
      setStatus(NETWORK_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  if (sent) return <SentNotice />;

  const dated = kind === "event" || kind === "hackathon";
  const role = kind === "job" || kind === "program";
  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      <SelectField id="kind" label="What are you submitting?" value={kind} onChange={(value) => setKind(value as Kind)} options={KINDS} required />
      <Field id="title" label="Title" value={values.title} onChange={set("title")} error={errors.title} required maxLength={200} />
      <Field id="organization" label="Organization" value={values.organization} onChange={set("organization")} error={errors.organization} required maxLength={200} />
      <Field
        id="source_url"
        label="Link"
        type="url"
        value={values.source_url}
        onChange={set("source_url")}
        error={errors.source_url}
        hint="Where students can confirm the details, starting with https://"
        required
        maxLength={2048}
      />
      <Field
        id="description"
        label="Description"
        value={values.description}
        onChange={set("description")}
        error={errors.description}
        hint="Plain text, up to 2,000 characters. No HTML."
        required
        maxLength={2000}
        multiline
        rows={6}
      />
      {dated && (
        <>
          <Field id="starts_on" label="Date" type="date" value={values.starts_on} onChange={set("starts_on")} />
          <Field id="location" label="Location" value={values.location} onChange={set("location")} maxLength={200} />
        </>
      )}
      {role && (
        <>
          <Field id="deadline_on" label="Application deadline" type="date" value={values.deadline_on} onChange={set("deadline_on")} />
          <Field id="location" label="Location" value={values.location} onChange={set("location")} maxLength={200} />
          <SelectField id="work_mode" label="Work mode" value={values.work_mode} onChange={set("work_mode")} options={WORK_MODES} placeholder="Not specified" />
        </>
      )}
      {kind === "resource" && (
        <>
          <SelectField id="category" label="Category" value={values.category} onChange={set("category")} options={CATEGORIES} placeholder="Not specified" />
          <Field id="audience" label="Who it's for" value={values.audience} onChange={set("audience")} maxLength={200} />
        </>
      )}
      <fieldset className="grid gap-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">Contact (optional)</legend>
        <p className="text-xs text-muted-foreground">
          Your contact details stay private. They are used only to ask about this submission and are never published.
        </p>
        <Field id="contact_name" label="Your name (optional)" value={values.contact_name} onChange={set("contact_name")} maxLength={120} autoComplete="name" />
        <Field
          id="contact_email"
          label="Your email (optional)"
          type="email"
          value={values.contact_email}
          onChange={set("contact_email")}
          error={errors.contact_email}
          maxLength={254}
          autoComplete="email"
        />
      </fieldset>
      <Honeypot value={values.website} onChange={set("website")} />
      {status && <FormStatus>{status}</FormStatus>}
      <button type="submit" disabled={sending} className="rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50">
        {sending ? "Sending…" : "Send for review"}
      </button>
    </form>
  );
}
