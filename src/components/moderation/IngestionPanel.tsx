"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EventStatusBodyInput } from "@/contracts/admin";
import type {
  IngestionStatusRecord,
  PersistImagesBodyInput,
  PersistImagesResultRecord,
  StalePendingRecord,
} from "@/contracts/ingestion";
import { readResponse } from "@/components/discovery/presentation";

/** M3 P1-07: ingestion freshness, the delivery log and the stale pending queue. */

const STALE_SUCCESS_MS = 48 * 3_600_000;
const button = "rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";
const EXPIRED_REJECTION: EventStatusBodyInput = {
  status: "rejected",
  category: "incorrect_details",
  message: "This event's date passed before it could be reviewed.",
};

function when(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function isPast(iso: string): boolean {
  const at = Date.parse(iso);
  return !Number.isNaN(at) && at < Date.now();
}

function SummaryCard({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold" data-testid={testId}>{value}</dd>
    </div>
  );
}

export function IngestionPanel() {
  const [status, setStatus] = useState<IngestionStatusRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await readResponse<IngestionStatusRecord>(await fetch("/api/admin/ingestion", { cache: "no-store" })));
  }, []);

  useEffect(() => {
    let active = true;
    refresh()
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load ingestion status."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refresh]);

  async function rejectExpired(event: StalePendingRecord) {
    setBusy(event.id);
    setError(null);
    setNotice(null);
    try {
      await readResponse(await fetch(`/api/admin/events/${event.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(EXPIRED_REJECTION),
      }));
      setNotice(`Rejected "${event.title}" as expired.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject the event.");
    } finally {
      setBusy(null);
    }
  }

  async function persistImages() {
    setBusy("images");
    setError(null);
    setNotice(null);
    try {
      const body: PersistImagesBodyInput = {};
      const result = await readResponse<PersistImagesResultRecord>(await fetch("/api/admin/ingestion/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
      setNotice(
        `Checked ${result.processed} image(s): ${result.persisted} stored, ${result.cleared} expired and cleared, ${result.failed.length} failed.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not persist images.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading ingestion status…</p>;
  if (!status) return <p role="alert" className="text-sm text-red-600">{error ?? "Could not load ingestion status."}</p>;

  const { summary, deliveries, stale } = status;
  const lastSuccess = summary.last_success_at ? Date.parse(summary.last_success_at) : Number.NaN;
  const silent = Number.isNaN(lastSuccess) || Date.now() - lastSuccess > STALE_SUCCESS_MS;

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Ingestion</h2>
        <button type="button" className={button} disabled={busy !== null} onClick={persistImages}>
          {busy === "images" ? "Persisting images…" : "Persist images"}
        </button>
      </header>

      {silent && (
        <p role="status" data-testid="ingestion-silent-warning" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          No successful ingestion in the last 48 hours. Check the delivery log below and the runbook
          (docs/runbooks/ingestion.md).
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Last successful delivery" value={when(summary.last_success_at)} testId="ingestion-last-success" />
        <SummaryCard
          label="Last failed delivery"
          value={`${when(summary.last_failure_at)}${summary.last_error_code ? ` (${summary.last_error_code})` : ""}`}
          testId="ingestion-last-failure"
        />
        <SummaryCard label="Last delivery (any outcome)" value={when(summary.last_delivery_at)} testId="ingestion-last-delivery" />
        <SummaryCard label="Newest Instagram event" value={when(summary.last_ingest_at)} testId="ingestion-last-ingest" />
        <SummaryCard label="Pending review" value={String(summary.pending_review)} testId="ingestion-pending-review" />
        <SummaryCard label="Stale pending" value={String(summary.stale_pending)} testId="ingestion-stale-pending" />
      </dl>

      <section aria-labelledby="deliveries-heading" className="grid gap-3">
        <h3 id="deliveries-heading" className="text-lg font-semibold">Recent deliveries</h3>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4">Received</th>
                  <th scope="col" className="py-2 pr-4">Producer</th>
                  <th scope="col" className="py-2 pr-4">Outcome</th>
                  <th scope="col" className="py-2 pr-4">Events</th>
                  <th scope="col" className="py-2 pr-4">Inserted</th>
                  <th scope="col" className="py-2 pr-4">Duplicates</th>
                  <th scope="col" className="py-2 pr-4">Invalid</th>
                  <th scope="col" className="py-2 pr-4">Error code</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-t border-border" data-testid="ingestion-delivery">
                    <td className="py-2 pr-4">{when(delivery.received_at)}</td>
                    <td className="py-2 pr-4">{delivery.producer}</td>
                    <td className="py-2 pr-4">{delivery.outcome}</td>
                    <td className="py-2 pr-4">{delivery.event_count}</td>
                    <td className="py-2 pr-4">{delivery.inserted}</td>
                    <td className="py-2 pr-4">{delivery.duplicates}</td>
                    <td className="py-2 pr-4">{delivery.invalid}</td>
                    <td className="py-2 pr-4">{delivery.error_code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="stale-heading" className="grid gap-3">
        <h3 id="stale-heading" className="text-lg font-semibold">Stale pending events</h3>
        <p className="text-sm text-muted-foreground">
          Pending for more than 72 hours, or already past their start. Past events are hidden from Pending Review.
        </p>
        {stale.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing stale.</p>
        ) : (
          <ul className="grid gap-2">
            {stale.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3" data-testid="ingestion-stale-event">
                <div className="min-w-0">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Starts {when(event.start_date)} · received {when(event.created_at)}
                    {event.source ? ` · ${event.source}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link className={button} href="/moderation/pending">Review</Link>
                  {isPast(event.start_date) && (
                    <button type="button" className={button} disabled={busy !== null} onClick={() => rejectExpired(event)}>
                      {busy === event.id ? "Rejecting…" : "Reject as expired"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
