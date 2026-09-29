"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type {
  OpportunityAdminRecord,
  OpportunityData,
} from "@/contracts/opportunities";
import {
  OpportunityCreateBody,
  OpportunityFields,
} from "@/contracts/opportunities";
import type { DiscoveryItem } from "@/contracts/discovery";
import {
  listingHref,
  listingLabels,
  readResponse,
} from "@/components/discovery/presentation";

type Duplicate = Pick<DiscoveryItem, "kind" | "id" | "title" | "source_url">;
type EditorResponse = {
  item: OpportunityAdminRecord;
  duplicates?: Duplicate[];
};
type University = { id: string; name: string };
const inputStyle =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50";
const initial = (): OpportunityData => ({
  ...OpportunityCreateBody.parse({
    title: "Draft",
    slug: "draft",
    description: "Draft",
    organization: "Draft",
    listing_type: "hackathon",
    relevance_scope: "cross_campus",
  }),
  title: "",
  slug: "",
  description: "",
  organization: "",
});
function editable(item: OpportunityAdminRecord): OpportunityData {
  return OpportunityCreateBody.parse(
    Object.fromEntries(
      Object.keys(OpportunityFields.shape).map((key) => [
        key,
        item[key as keyof OpportunityAdminRecord],
      ])
    )
  );
}

export function OpportunityEditor({
  canAssignPick,
}: {
  canAssignPick: boolean;
}) {
  const [items, setItems] = useState<OpportunityAdminRecord[]>([]);
  const [record, setRecord] = useState<OpportunityAdminRecord | null>(null);
  const [form, setForm] = useState<OpportunityData>(initial);
  const [fieldsText, setFieldsText] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirtyState] = useState(false);
  // `open` runs from effects and callbacks that captured an older render, so
  // the unsaved-changes check reads a ref that is always current.
  const dirtyRef = useRef(false);
  const setDirty = (value: boolean) => {
    dirtyRef.current = value;
    setDirtyState(value);
  };
  // While a `?id=` listing is being opened the form stays disabled, so
  // nothing typed into the blank draft can be overwritten when it arrives.
  const [preselecting, setPreselecting] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [mergeReason, setMergeReason] = useState("");

  async function refresh() {
    const body = await readResponse<{ items: OpportunityAdminRecord[] }>(
      await fetch("/api/admin/opportunities?limit=100", { cache: "no-store" })
    );
    setItems(body.items);
  }
  useEffect(() => {
    let active = true;
    // `?id=` opens one listing directly, e.g. the draft a converted public
    // submission just created (M3 P1-09). It is fetched by id, so it opens
    // even when it is not among the 100 most recent listings.
    const preselect = new URLSearchParams(window.location.search).get("id");
    if (preselect) {
      setPreselecting(true);
      void open(preselect).finally(() => {
        if (active) setPreselecting(false);
      });
    }
    Promise.all([
      fetch("/api/admin/opportunities?limit=100", { cache: "no-store" }).then(
        readResponse<{ items: OpportunityAdminRecord[] }>
      ),
      fetch("/api/universities").then(
        readResponse<{ universities: University[] }>
      ),
    ])
      .then(([list, catalog]) => {
        if (active) {
          setItems(list.items);
          setUniversities(catalog.universities);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function field<K extends keyof OpportunityData>(
    name: K,
    value: OpportunityData[K]
  ) {
    setForm((old) => ({ ...old, [name]: value }));
    setDirty(true);
    setNotice(null);
  }
  function accept(body: EditorResponse) {
    setRecord(body.item);
    setForm(editable(body.item));
    setFieldsText(body.item.fields.join(", "));
    setDuplicates(body.duplicates ?? []);
    setDirty(false);
    setMergeTarget("");
    setMergeReason("");
  }
  async function open(id: string) {
    if (
      dirtyRef.current &&
      !window.confirm("Discard the unsaved changes to this listing?")
    )
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      accept(
        await readResponse<EditorResponse>(
          await fetch(`/api/admin/opportunities/${id}`, { cache: "no-store" })
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open listing.");
    } finally {
      setBusy(false);
    }
  }
  async function persist(action: "edit" | "publish" | "archive" | "merge") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action !== "edit" && dirty)
        throw new Error("Save your draft changes before changing its status.");
      const validated = OpportunityCreateBody.safeParse(form);
      if (!validated.success)
        throw new Error(
          validated.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" · ")
        );
      const canonicalParts = mergeTarget.split(":");
      const body = record
        ? action === "edit"
          ? {
              action,
              expected_updated_at: record.updated_at,
              data: validated.data,
            }
          : action === "merge"
            ? {
                action,
                expected_updated_at: record.updated_at,
                canonical: { kind: canonicalParts[0], id: canonicalParts[1] },
                reason: mergeReason,
              }
            : { action, expected_updated_at: record.updated_at }
        : validated.data;
      const result = await readResponse<EditorResponse>(
        await fetch(
          record
            ? `/api/admin/opportunities/${record.id}`
            : "/api/admin/opportunities",
          {
            method: record ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        )
      );
      accept(result);
      setNotice(
        action === "publish"
          ? "Published. The listing is available in discovery."
          : action === "archive"
            ? "Archived. The listing is no longer public."
            : action === "merge"
              ? "Merged into the canonical listing."
              : "Draft changes saved."
      );
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  function quickAdd(source: string) {
    try {
      const url = new URL(source);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      const raw = decodeURIComponent(
        url.pathname.split("/").filter(Boolean).at(-1) ?? ""
      ).replace(/[-_]/g, " ");
      const title = raw || "New opportunity";
      const organization = url.hostname.replace(/^www\./, "");
      setForm((old) => ({
        ...old,
        source_url: url.href,
        action_url: url.href,
        organization,
        title: title.slice(0, 200),
        slug:
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 120) || "new-opportunity",
      }));
      setDirty(true);
      setError(null);
      setNotice(
        "URL copied into the draft. Review the inferred title and organization; the source was not fetched."
      );
    } catch {
      setError("Enter a valid http or https source URL.");
    }
  }
  const text = (
    name: keyof OpportunityData,
    label: string,
    opts: {
      required?: boolean;
      type?: string;
      help?: string;
      disabled?: boolean;
    } = {}
  ) => (
    <label className="block space-y-1.5 text-sm font-medium">
      {label}
      <input
        className={inputStyle}
        type={opts.type ?? "text"}
        required={opts.required}
        disabled={opts.disabled}
        value={String(form[name] ?? "")}
        onChange={(e) =>
          field(
            name,
            (e.target.value ||
              ([
                "location",
                "title",
                "slug",
                "organization",
                "source_timezone",
              ].includes(name)
                ? ""
                : null)) as never
          )
        }
      />
      {opts.help && (
        <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
          {opts.help}
        </span>
      )}
    </label>
  );
  const instant = (
    name: "starts_at" | "ends_at" | "deadline_at" | "review_at" | "checked_at",
    label: string
  ) => (
    <label className="block space-y-1.5 text-sm font-medium">
      {label} (UTC)
      <input
        className={inputStyle}
        type="datetime-local"
        value={form[name]?.slice(0, 16) ?? ""}
        onChange={(e) =>
          field(name, e.target.value ? `${e.target.value}:00Z` : null)
        }
      />
      <span className="block text-xs font-normal text-muted-foreground">
        Enter the UTC instant; public display uses the source timezone.
      </span>
    </label>
  );
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Editorial desk
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Opportunities
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Curate, check eligibility, and publish. Existing campus events
            remain in their original event queue.
          </p>
        </div>
        <Link
          href="/discover"
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Open discovery ↗
        </Link>
      </div>
      <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved changes?")) {
                setRecord(null);
                setForm(initial());
                setFieldsText("");
                setDirty(false);
                setDuplicates([]);
                setError(null);
                setNotice(null);
              }
            }}
            className="mb-4 w-full rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            + New opportunity
          </button>
          {loading && <p role="status">Loading listings…</p>}
          <nav
            aria-label="Opportunity drafts"
            className="max-h-[60vh] space-y-2 overflow-y-auto"
          >
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => void open(item.id)}
                disabled={busy}
                className={`w-full rounded-lg border p-3 text-left ${record?.id === item.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="mt-1 block text-xs capitalize text-muted-foreground">
                  {item.status} · {listingLabels[item.listing_type]}
                </span>
              </button>
            ))}
          </nav>
          {items.length === 100 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing the 100 most recent listings.
            </p>
          )}
        </aside>
        <div className="min-w-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void persist("edit");
            }}
            className="space-y-6"
          >
            {error && (
              <div
                role="alert"
                className="break-words rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
              >
                {error}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() =>
                    record
                      ? void open(record.id)
                      : void refresh().catch((e) => setError(e.message))
                  }
                >
                  Reload latest
                </button>
              </div>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-4 text-sm"
              >
                {notice}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {record ? "Edit listing" : "Quick add"}{" "}
                <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                  {record?.status ?? "New draft"}
                  {dirty ? " · Unsaved changes" : ""}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="text-sm underline"
              >
                {preview ? "Close preview" : "Preview draft"}
              </button>
            </div>
            {preview && (
              <section
                aria-label="Draft preview"
                className="rounded-xl border border-primary/30 bg-card p-6"
              >
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Draft preview · {listingLabels[form.listing_type]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {form.organization}
                </p>
                <h3 className="mt-2 text-2xl font-semibold">{form.title}</h3>
                {form.is_pick && (
                  <p className="mt-3 text-sm font-medium text-primary">
                    Ady’s Pick — {form.pick_reason}
                  </p>
                )}
                {form.curator_note && (
                  <p className="my-4 border-l-2 border-primary pl-4">
                    {form.curator_note}
                  </p>
                )}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {form.description}
                </p>
                <p className="mt-4 text-sm">
                  {form.eligibility_text ?? "Check eligibility with organizer"}
                </p>
                <p className="mt-2 text-xs">
                  {form.deadline_date ??
                    form.deadline_at ??
                    form.starts_at ??
                    "Ongoing"}{" "}
                  · {form.source_timezone}
                </p>
              </section>
            )}
            {!record && (
              <div className="rounded-xl border border-border bg-card p-5">
                <label className="text-sm font-medium" htmlFor="quick-source">
                  Start from a source URL
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="quick-source"
                    name="quick-source"
                    type="url"
                    placeholder="https://organizer.example/hackathon"
                    className={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.form?.elements.namedItem(
                        "quick-source"
                      ) as HTMLInputElement | null;
                      quickAdd(input?.value ?? "");
                    }}
                    className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold"
                  >
                    Fill from URL
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Local URL parsing only. Always check the original source
                  before publishing.
                </p>
              </div>
            )}
            <fieldset disabled={busy || preselecting} className="space-y-6 disabled:opacity-70">
              <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">The opportunity</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("title", "Title", { required: true })}
                  {text("slug", "URL slug", { required: true })}
                  <label className="space-y-1.5 text-sm font-medium">
                    Type
                    <select
                      className={inputStyle}
                      value={form.listing_type}
                      onChange={(e) =>
                        field(
                          "listing_type",
                          e.target.value as OpportunityData["listing_type"]
                        )
                      }
                    >
                      {Object.entries(listingLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {text("subtype", "Subtype", {
                    help: "For jobs, use internship, full-time, part-time, or contract.",
                  })}
                  {text("organization", "Organizer / organization", {
                    required: true,
                  })}
                  {text("source_url", "Source URL", {
                    type: "url",
                    required: true,
                  })}
                </div>
                <label className="block space-y-1.5 text-sm font-medium">
                  Description
                  <textarea
                    className={inputStyle}
                    required
                    rows={6}
                    value={form.description}
                    onChange={(e) => field("description", e.target.value)}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Application / registration
                    <select
                      className={inputStyle}
                      value={form.application_mode}
                      onChange={(e) => {
                        field(
                          "application_mode",
                          e.target.value as "external" | "none"
                        );
                        if (e.target.value === "none")
                          field("action_url", null);
                      }}
                    >
                      <option value="external">External organizer link</option>
                      <option value="none">
                        No action link — explain below
                      </option>
                    </select>
                  </label>
                  {form.application_mode === "external"
                    ? text("action_url", "Action URL", {
                        required: true,
                        type: "url",
                      })
                    : text("action_note", "Why there is no action link", {
                        required: true,
                      })}
                </div>
              </section>
              <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">Timing & location</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Deadline precision
                    <select
                      className={inputStyle}
                      value={form.deadline_precision}
                      onChange={(e) => {
                        field(
                          "deadline_precision",
                          e.target
                            .value as OpportunityData["deadline_precision"]
                        );
                        field("deadline_at", null);
                        field("deadline_date", null);
                      }}
                    >
                      <option value="none">No deadline</option>
                      <option value="date">Date only</option>
                      <option value="datetime">Exact time</option>
                    </select>
                  </label>
                  {form.deadline_precision === "date"
                    ? text("deadline_date", "Deadline date", {
                        type: "date",
                        required: true,
                      })
                    : form.deadline_precision === "datetime"
                      ? instant("deadline_at", "Deadline")
                      : instant(
                          "review_at",
                          "Next review (required if evergreen)"
                        )}
                  {instant("starts_at", "Starts")}
                  {instant("ends_at", "Ends")}
                  {text("source_timezone", "Source timezone", {
                    required: true,
                    help: "IANA timezone, e.g. America/Toronto. Date-only deadlines close at the end of this local date.",
                  })}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.timezone_assumed}
                      onChange={(e) =>
                        field("timezone_assumed", e.target.checked)
                      }
                    />
                    Timezone assumed (not confirmed by source)
                  </label>
                  {text("location", "Location")}
                  <label className="space-y-1.5 text-sm font-medium">
                    Work mode
                    <select
                      className={inputStyle}
                      value={form.work_mode}
                      onChange={(e) =>
                        field(
                          "work_mode",
                          e.target.value as OpportunityData["work_mode"]
                        )
                      }
                    >
                      <option value="in_person">In person</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                  {instant("checked_at", "Source last checked")}
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() =>
                        field("checked_at", new Date().toISOString())
                      }
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                    >
                      Mark source checked now
                    </button>
                  </div>
                </div>
              </section>
              <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">Audience & eligibility</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    University relevance
                    <select
                      className={inputStyle}
                      value={form.relevance_scope}
                      onChange={(e) => {
                        field(
                          "relevance_scope",
                          e.target.value as OpportunityData["relevance_scope"]
                        );
                        if (e.target.value !== "specific")
                          field("university_ids", []);
                      }}
                    >
                      <option value="cross_campus">Cross-campus</option>
                      <option value="specific">Selected universities</option>
                      <option value="unknown">Not confirmed</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Organizer affiliation
                    <select
                      className={inputStyle}
                      value={form.organizer_university_id ?? ""}
                      onChange={(e) =>
                        field("organizer_university_id", e.target.value || null)
                      }
                    >
                      <option value="">None / independent</option>
                      {universities.map((uni) => (
                        <option key={uni.id} value={uni.id}>
                          {uni.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {form.relevance_scope === "specific" && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">
                      Relevant universities
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {universities.map((uni) => (
                        <label
                          key={uni.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={form.university_ids.includes(uni.id)}
                            onChange={(e) =>
                              field(
                                "university_ids",
                                e.target.checked
                                  ? [...form.university_ids, uni.id]
                                  : form.university_ids.filter(
                                      (id) => id !== uni.id
                                    )
                              )
                            }
                          />
                          {uni.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                {text("eligibility_text", "Eligibility", {
                  help: "Separate from relevance and organizer affiliation. Leave blank only when not confirmed; students will be told to check with the organizer.",
                })}
                <label className="block space-y-1.5 text-sm font-medium">
                  Fields (comma separated)
                  <input
                    className={inputStyle}
                    value={fieldsText}
                    onChange={(e) => {
                      setFieldsText(e.target.value);
                      field(
                        "fields",
                        e.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      );
                    }}
                  />
                </label>
              </section>
              <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">Editorial context</h3>
                <label className="block space-y-1.5 text-sm font-medium">
                  Curator note
                  <textarea
                    className={inputStyle}
                    rows={3}
                    value={form.curator_note ?? ""}
                    onChange={(e) =>
                      field("curator_note", e.target.value || null)
                    }
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Editorial priority (0–100)
                    <input
                      className={inputStyle}
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canAssignPick}
                      value={form.editorial_priority}
                      onChange={(e) =>
                        field("editorial_priority", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!canAssignPick}
                      checked={form.is_pick}
                      onChange={(e) => field("is_pick", e.target.checked)}
                    />
                    Ady’s Pick
                  </label>
                </div>
                {!canAssignPick && (
                  <p className="text-xs text-muted-foreground">
                    Only the configured curator can assign or change Ady’s Pick.
                  </p>
                )}
                {form.is_pick &&
                  text("pick_reason", "Pick explanation", {
                    required: true,
                    disabled: !canAssignPick,
                  })}
                {text("duplicate_review_note", "Duplicate review note", {
                  help: "If a possible match is a different edition or opportunity, record why it should remain separate.",
                })}
              </section>
              {duplicates.length > 0 && (
                <section className="space-y-4 rounded-xl border border-amber-400/50 bg-amber-50/50 p-5 dark:bg-amber-950/10">
                  <h3 className="font-semibold">
                    Possible duplicates — review before publishing
                  </h3>
                  <ul className="space-y-2">
                    {duplicates.map((item) => (
                      <li key={`${item.kind}:${item.id}`} className="text-sm">
                        <Link
                          href={listingHref(item)}
                          target="_blank"
                          className="underline"
                        >
                          {item.title}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.kind} · {item.id}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-border py-5">
                <button
                  type="submit"
                  className="rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background"
                >
                  {busy ? "Saving…" : record ? "Save changes" : "Save draft"}
                </button>
                {record && (
                  <>
                    <button
                      type="button"
                      disabled={
                        dirty ||
                        record.status === "published" ||
                        !!record.canonical_event_id ||
                        !!record.canonical_opportunity_id
                      }
                      onClick={() => void persist("publish")}
                      className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={dirty || record.status === "archived"}
                      onClick={() => void persist("archive")}
                      className="rounded-lg border border-border px-5 py-3 text-sm disabled:opacity-40"
                    >
                      Archive
                    </button>
                    {record.status === "published" && (
                      <Link
                        href={`/opportunities/${record.id}`}
                        className="text-sm underline"
                      >
                        View published listing ↗
                      </Link>
                    )}
                  </>
                )}
              </div>
            </fieldset>
          </form>
          {record &&
            !record.canonical_event_id &&
            !record.canonical_opportunity_id && (
              <details className="mt-6 rounded-lg border border-border p-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Merge a confirmed duplicate
                </summary>
                <p className="my-3 text-xs leading-relaxed text-muted-foreground">
                  Archive this listing and redirect it to an existing public
                  canonical listing. Save any edits first. Recurring editions
                  with different dates should remain separate.
                </p>
                <label className="mb-3 block space-y-1.5 text-sm">
                  Canonical identity (event:UUID or opportunity:UUID)
                  <input
                    className={inputStyle}
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                    placeholder="event:00000000-0000-0000-0000-000000000000"
                  />
                </label>
                <label className="mb-3 block space-y-1.5 text-sm">
                  Merge reason
                  <input
                    className={inputStyle}
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || dirty || !mergeReason || !mergeTarget}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Merge this duplicate into the canonical listing?"
                      )
                    )
                      void persist("merge");
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-40"
                >
                  Merge duplicate
                </button>
              </details>
            )}
        </div>
      </div>
    </div>
  );
}
