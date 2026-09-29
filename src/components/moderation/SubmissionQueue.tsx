"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  ListingReportAdminRecord,
  ListingReportResolveInput,
  SubmissionAdminRecord,
  SubmissionReviewInput,
  SubmissionReviewResult,
} from "@/contracts/intake";
import { readResponse } from "@/components/discovery/presentation";

type Tab = "submissions" | "reports";
type SubmissionStatus = SubmissionAdminRecord["status"];
type ReportStatus = ListingReportAdminRecord["status"];

const KIND_LABELS: Record<SubmissionAdminRecord["kind"], string> = {
  event: "Event",
  hackathon: "Hackathon",
  job: "Job or internship",
  program: "Program",
  resource: "Resource",
  company_request: "Hiring request",
};
const REASON_LABELS: Record<ListingReportAdminRecord["reason"], string> = {
  wrong_date: "Wrong date or time",
  dead_link: "Broken link",
  scam: "Looks like a scam",
  duplicate: "Duplicate listing",
  other: "Something else",
};
const inputStyle = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";

function draftHref(item: { target_opportunity_id: string | null; target_resource_id: string | null }): string | null {
  if (item.target_opportunity_id) return `/moderation/opportunities?id=${item.target_opportunity_id}`;
  if (item.target_resource_id) return `/moderation/resources?id=${item.target_resource_id}`;
  return null;
}

function reportTargetHref(report: ListingReportAdminRecord): string {
  if (report.kind === "event") return `/events/${report.target_id}`;
  if (report.kind === "opportunity") return `/moderation/opportunities?id=${report.target_id}`;
  return `/moderation/resources?id=${report.target_id}`;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return readResponse<T>(
    await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  );
}

function SubmissionsPanel() {
  const [status, setStatus] = useState<SubmissionStatus>("pending");
  const [items, setItems] = useState<SubmissionAdminRecord[]>([]);
  const [selected, setSelected] = useState<SubmissionAdminRecord | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href: string | null } | null>(null);

  const refresh = useCallback(async (next: SubmissionStatus) => {
    const body = await readResponse<{ items: SubmissionAdminRecord[] }>(
      await fetch(`/api/admin/submissions?status=${next}&limit=100`, { cache: "no-store" })
    );
    setItems(body.items);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    refresh(status)
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load submissions."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [status, refresh]);

  async function open(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    setReason("");
    try {
      const body = await readResponse<{ item: SubmissionAdminRecord }>(
        await fetch(`/api/admin/submissions/${id}`, { cache: "no-store" })
      );
      setSelected(body.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open submission.");
    } finally {
      setBusy(false);
    }
  }

  async function review(action: SubmissionReviewInput["action"]) {
    if (!selected) return;
    const payload: SubmissionReviewInput =
      action === "reject"
        ? { action, expected_updated_at: selected.updated_at, reason: reason.trim() }
        : action === "spam"
          ? { action, expected_updated_at: selected.updated_at, reason: reason.trim() || undefined }
          : { action, expected_updated_at: selected.updated_at };
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await patchJson<SubmissionReviewResult>(`/api/admin/submissions/${selected.id}`, payload);
      const updated = { ...selected, ...result.submission };
      setSelected(updated);
      setReason("");
      setNotice({
        text: action === "convert" ? "Converted to a draft. Check it and publish from the editor." : action === "reject" ? "Rejected." : "Marked as spam.",
        href: action === "convert" ? draftHref(updated) : null,
      });
      await refresh(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review submission.");
    } finally {
      setBusy(false);
    }
  }

  const detailEntries = selected ? Object.entries(selected.details ?? {}) : [];
  const selectedDraft = selected ? draftHref(selected) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <section aria-label="Submission list" className="grid content-start gap-3">
        <label htmlFor="submission-status" className="text-sm font-medium">
          Status
        </label>
        <select id="submission-status" className={inputStyle} value={status} onChange={(e) => { setSelected(null); setStatus(e.target.value as SubmissionStatus); }}>
          <option value="pending">Pending</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
          <option value="spam">Spam</option>
        </select>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">Loading submissions…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void open(item.id)}
                  aria-current={selected?.id === item.id ? "true" : undefined}
                  className="w-full rounded-lg border border-border p-3 text-left text-sm aria-[current=true]:border-primary"
                >
                  <span className="block text-xs uppercase tracking-wider text-muted-foreground">{KIND_LABELS[item.kind]}</span>
                  <span className="block font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.organization} · {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Submission detail" className="grid content-start gap-4">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && (
          <p role="status" className="text-sm">
            {notice.text}{" "}
            {notice.href && (
              <Link href={notice.href} className="font-medium underline">
                Open draft
              </Link>
            )}
          </p>
        )}
        {!selected ? (
          <p className="text-sm text-muted-foreground">Choose a submission to review it.</p>
        ) : (
          <article className="grid gap-4 rounded-xl border border-border p-5">
            <header>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {KIND_LABELS[selected.kind]} · {selected.status}
              </p>
              <h2 className="text-xl font-semibold">{selected.title}</h2>
              <p className="text-sm text-muted-foreground">{selected.organization}</p>
            </header>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-medium">Link</dt>
                <dd className="break-all">
                  {selected.source_url ? (
                    <a href={selected.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                      {selected.source_url}
                    </a>
                  ) : (
                    "None given"
                  )}
                </dd>
              </div>
              {detailEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="font-medium">{key.replace(/_/g, " ")}</dt>
                  <dd className="whitespace-pre-wrap break-words">{value}</dd>
                </div>
              ))}
              <div className="rounded-lg bg-muted p-3">
                <dt className="font-medium">Private contact (never published)</dt>
                <dd>{selected.contact_name || "No name"} · {selected.contact_email || "No email"}</dd>
              </div>
              {selected.review_reason && (
                <div>
                  <dt className="font-medium">Review reason</dt>
                  <dd>{selected.review_reason}</dd>
                </div>
              )}
            </dl>
            {selectedDraft && !notice?.href && (
              <Link href={selectedDraft} className="text-sm font-medium underline">
                Open draft
              </Link>
            )}
            {selected.status === "pending" && (
              <div className="grid gap-3 border-t border-border pt-4">
                <label htmlFor="review-reason" className="text-sm font-medium">
                  Reason (required to reject)
                </label>
                <textarea id="review-reason" className={inputStyle} rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`${button} bg-foreground text-background`} disabled={busy} onClick={() => void review("convert")}>
                    Convert to draft
                  </button>
                  <button type="button" className={button} disabled={busy || !reason.trim()} onClick={() => void review("reject")}>
                    Reject
                  </button>
                  <button type="button" className={button} disabled={busy} onClick={() => void review("spam")}>
                    Spam
                  </button>
                </div>
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
}

function ReportsPanel() {
  const [status, setStatus] = useState<ReportStatus>("open");
  const [items, setItems] = useState<ListingReportAdminRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (next: ReportStatus) => {
    const body = await readResponse<{ items: ListingReportAdminRecord[] }>(
      await fetch(`/api/admin/listing-reports?status=${next}&limit=100`, { cache: "no-store" })
    );
    setItems(body.items);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    refresh(status)
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load reports."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [status, refresh]);

  async function resolve(report: ListingReportAdminRecord, action: ListingReportResolveInput["action"]) {
    const payload: ListingReportResolveInput = { action, note: notes[report.id]?.trim() || undefined };
    setBusy(report.id);
    setError(null);
    try {
      await patchJson(`/api/admin/listing-reports/${report.id}`, payload);
      await refresh(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update report.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid max-w-xs gap-1.5">
        <label htmlFor="report-status" className="text-sm font-medium">
          Status
        </label>
        <select id="report-status" className={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading reports…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((report) => (
            <li key={report.id} className="grid gap-2 rounded-xl border border-border p-4 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {report.kind} · {REASON_LABELS[report.reason]} · {new Date(report.created_at).toLocaleDateString()}
              </p>
              <Link href={reportTargetHref(report)} className="font-medium underline">
                {report.target_title ?? "Listing no longer available"}
              </Link>
              {report.details && <p className="whitespace-pre-wrap break-words">{report.details}</p>}
              {report.resolution_note && <p className="text-muted-foreground">Note: {report.resolution_note}</p>}
              {report.status === "open" && (
                <div className="grid gap-2">
                  <label htmlFor={`note-${report.id}`} className="text-xs font-medium">
                    Note (optional)
                  </label>
                  <input
                    id={`note-${report.id}`}
                    className={inputStyle}
                    maxLength={1000}
                    value={notes[report.id] ?? ""}
                    onChange={(e) => setNotes((old) => ({ ...old, [report.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button type="button" className={button} disabled={busy === report.id} onClick={() => void resolve(report, "resolve")}>
                      Resolve
                    </button>
                    <button type="button" className={button} disabled={busy === report.id} onClick={() => void resolve(report, "dismiss")}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Moderation queue for public intake (M3 P1-09): submissions (with their
 * private contact, admin only) and listing reports. */
export function SubmissionQueue() {
  const [tab, setTab] = useState<Tab>("submissions");
  const tabs: ReadonlyArray<readonly [Tab, string]> = [
    ["submissions", "Submissions"],
    ["reports", "Listing reports"],
  ];
  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Submissions and reports</h1>
      <div role="tablist" aria-label="Intake queues" className="mb-6 flex gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            id={`tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => setTab(value)}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium aria-selected:border-foreground aria-selected:bg-foreground aria-selected:text-background"
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "submissions" ? <SubmissionsPanel /> : <ReportsPanel />}
      </div>
    </div>
  );
}
