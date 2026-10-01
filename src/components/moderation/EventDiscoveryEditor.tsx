"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { z } from "zod";
import {
  EventEditorialMetadata,
  EventMetadataBody,
  EventMergeBody,
} from "@/contracts/opportunities";
import { UUID } from "@/contracts/discovery";
import { readResponse } from "@/components/discovery/presentation";

type Metadata = z.output<typeof EventEditorialMetadata>;
type Loaded = {
  event: { id: string; title: string };
  data: Metadata;
  updated_at: string | null;
  can_assign_pick: boolean;
};
const control =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** Enrich authoritative legacy events in place; never copy them into opportunities. */
export function EventDiscoveryEditor() {
  const [id, setId] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [data, setData] = useState<Metadata | null>(null);
  const [fieldsText, setFieldsText] = useState("");
  const [universities, setUniversities] = useState<
    { id: string; name: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/universities", { signal: abort.signal })
      .then(readResponse<{ universities: { id: string; name: string }[] }>)
      .then((body) => setUniversities(body.universities))
      .catch(() => {});
    return () => abort.abort();
  }, []);
  function field<K extends keyof Metadata>(name: K, value: Metadata[K]) {
    setData((old) => (old ? { ...old, [name]: value } : old));
    setNotice(null);
    setDirty(true);
  }
  async function load(eventId = id) {
    if (!UUID.safeParse(eventId).success) {
      setError("Enter a valid event UUID from its existing event URL.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = await readResponse<Loaded>(
        await fetch(`/api/admin/events/${eventId}/discovery`, {
          cache: "no-store",
        })
      );
      setLoaded(body);
      setData(EventEditorialMetadata.parse(body.data));
      setFieldsText(body.data.fields.join(", "));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load metadata.");
    } finally {
      setBusy(false);
    }
  }
  async function merge() {
    if (!loaded || dirty) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const [kind, canonicalId] = mergeTarget.split(":");
      const body = EventMergeBody.parse({
        expected_updated_at: loaded.updated_at,
        canonical: { kind, id: canonicalId },
        reason: mergeReason,
      });
      await readResponse(
        await fetch(`/api/admin/events/${loaded.event.id}/discovery`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
      await load(loaded.event.id);
      setNotice(
        "Duplicate merged. Discovery shows the canonical listing; original event history remains."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not merge event.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!loaded || !data) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = EventMetadataBody.safeParse({
        expected_updated_at: loaded.updated_at,
        data,
      });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" · ")
        );
      await readResponse(
        await fetch(`/api/admin/events/${loaded.event.id}/discovery`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        })
      );
      await load(loaded.event.id);
      setNotice(
        "Event discovery context saved. Its existing URL, saves, and ownership are preserved."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save metadata.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mb-8 rounded-xl border border-border bg-card p-5 sm:p-6">
      <summary className="cursor-pointer font-semibold">
        Enrich an existing campus event
      </summary>
      <p className="my-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Add audience context and an editorial note without creating a duplicate
        opportunity. Event approval and event dates stay in the original event
        queue.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label className="flex-1">
          <span className="sr-only">Existing event UUID</span>
          <input
            className={control}
            placeholder="Existing event UUID"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Load event
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      {loaded && data && (
        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3 className="text-lg font-semibold">
            {loaded.event.title}{" "}
            <Link
              href={`/events/${loaded.event.id}`}
              className="ml-2 text-xs font-normal underline"
            >
              Open event ↗
            </Link>
          </h3>
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Discovery type
              <select
                className={control}
                value={data.listing_type}
                onChange={(e) =>
                  field(
                    "listing_type",
                    e.target.value as Metadata["listing_type"]
                  )
                }
              >
                <option value="event">Event</option>
                <option value="hackathon">Hackathon</option>
                <option value="networking">Networking</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              University relevance
              <select
                className={control}
                value={data.relevance_scope}
                onChange={(e) => {
                  field(
                    "relevance_scope",
                    e.target.value as Metadata["relevance_scope"]
                  );
                  if (e.target.value !== "specific")
                    field("university_ids", []);
                }}
              >
                <option value="specific">Selected universities</option>
                <option value="cross_campus">Cross-campus</option>
                <option value="unknown">Not confirmed</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Organizer affiliation
              <select
                className={control}
                value={data.organizer_university_id ?? ""}
                onChange={(e) =>
                  field("organizer_university_id", e.target.value || null)
                }
              >
                <option value="">None / unknown</option>
                {universities.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
            </label>
            {data.relevance_scope === "specific" && (
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="mb-2 text-sm font-medium">
                  Relevant universities
                </legend>
                {universities.map((uni) => (
                  <label
                    key={uni.id}
                    className="mr-5 inline-flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={data.university_ids.includes(uni.id)}
                      onChange={(e) =>
                        field(
                          "university_ids",
                          e.target.checked
                            ? [...data.university_ids, uni.id]
                            : data.university_ids.filter(
                                (value) => value !== uni.id
                              )
                        )
                      }
                    />
                    {uni.name}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Eligibility
              <input
                className={control}
                value={data.eligibility_text ?? ""}
                onChange={(e) =>
                  field("eligibility_text", e.target.value || null)
                }
                placeholder="Unknown eligibility is displayed as ‘Check eligibility with organizer’."
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Curator note
              <textarea
                className={control}
                rows={3}
                value={data.curator_note ?? ""}
                onChange={(e) => field("curator_note", e.target.value || null)}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Fields (comma separated)
              <input
                className={control}
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
            <label className="space-y-1.5 text-sm font-medium">
              Editorial priority
              <input
                type="number"
                min={0}
                max={100}
                disabled={!loaded.can_assign_pick}
                className={control}
                value={data.editorial_priority}
                onChange={(e) =>
                  field("editorial_priority", Number(e.target.value))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!loaded.can_assign_pick}
                checked={data.is_pick}
                onChange={(e) => field("is_pick", e.target.checked)}
              />
              Ady’s Pick (configured curator only)
            </label>
            {data.is_pick && (
              <label className="space-y-1.5 text-sm font-medium">
                Pick explanation
                <input
                  disabled={!loaded.can_assign_pick}
                  className={control}
                  value={data.pick_reason ?? ""}
                  onChange={(e) => field("pick_reason", e.target.value || null)}
                />
              </label>
            )}
            <label className="space-y-1.5 text-sm font-medium">
              Registration deadline
              <select
                className={control}
                value={data.deadline_precision}
                onChange={(e) => {
                  field(
                    "deadline_precision",
                    e.target.value as Metadata["deadline_precision"]
                  );
                  field("deadline_date", null);
                  field("deadline_at", null);
                }}
              >
                <option value="none">None specified</option>
                <option value="date">Date only</option>
                <option value="datetime">Exact time</option>
              </select>
            </label>
            {data.deadline_precision === "date" && (
              <label className="space-y-1.5 text-sm font-medium">
                Deadline date
                <input
                  type="date"
                  required
                  className={control}
                  value={data.deadline_date ?? ""}
                  onChange={(e) =>
                    field("deadline_date", e.target.value || null)
                  }
                />
              </label>
            )}
            {data.deadline_precision === "datetime" && (
              <label className="space-y-1.5 text-sm font-medium">
                Deadline instant (UTC)
                <input
                  type="datetime-local"
                  required
                  className={control}
                  value={data.deadline_at?.slice(0, 16) ?? ""}
                  onChange={(e) =>
                    field(
                      "deadline_at",
                      e.target.value ? `${e.target.value}:00Z` : null
                    )
                  }
                />
              </label>
            )}
            <label className="space-y-1.5 text-sm font-medium">
              Source timezone
              <input
                className={control}
                value={data.source_timezone}
                onChange={(e) => field("source_timezone", e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.timezone_assumed}
                onChange={(e) => field("timezone_assumed", e.target.checked)}
              />
              Timezone assumed
            </label>
          </fieldset>
          <label className="block space-y-1.5 text-sm font-medium">
            Duplicate review note
            <textarea
              className={control}
              rows={2}
              value={data.duplicate_review_note ?? ""}
              onChange={(e) =>
                field("duplicate_review_note", e.target.value || null)
              }
            />
            <span className="block text-xs font-normal text-muted-foreground">
              Explain why a matched listing is a distinct edition before
              approving it in the event queue.
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save event context"}
          </button>
        </form>
      )}
      {loaded && (
        <details className="mt-5 border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-medium">
            Merge a confirmed duplicate event
          </summary>
          <p className="my-3 text-xs text-muted-foreground">
            Only an approved public event can become an alias. Save context
            edits first.
          </p>
          <label className="mb-3 block space-y-1.5 text-sm">
            Canonical identity (event:UUID or opportunity:UUID)
            <input
              className={control}
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
            />
          </label>
          <label className="mb-3 block space-y-1.5 text-sm">
            Merge reason
            <input
              className={control}
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || dirty || !mergeReason || !mergeTarget}
            onClick={() => {
              if (
                window.confirm("Merge this event into the canonical listing?")
              )
                void merge();
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-40"
          >
            Merge duplicate event
          </button>
        </details>
      )}
    </details>
  );
}
