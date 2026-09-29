"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bookmark, Check } from "lucide-react";
import type { DiscoveryItem } from "@/contracts/discovery";
import { useAuthStore } from "@/store/useAuthStore";
import { SignInButton } from "@/components/auth/SignInButton";
import { publishSaveChange } from "./saveChanges";
import { ListingFacts } from "./ListingFacts";
import { ReportListingButton } from "@/components/intake/ReportListingButton";
import { listingKey, listingLabels, readResponse } from "./presentation";

function DetailSave({ item }: { item: DiscoveryItem }) {
  const user = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingSave = useRef(false);
  const saveRevision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const abort = new AbortController();
    const revision = saveRevision.current;
    fetch(
      `/api/saved/status?identities=${encodeURIComponent(listingKey(item))}`,
      { signal: abort.signal, cache: "no-store" }
    )
      .then(readResponse<{ saved: { kind: string; id: string }[] }>)
      .then((body) => {
        if (abort.signal.aborted || pendingSave.current || revision !== saveRevision.current) return;
        setSaved(body.saved.some((entry) => entry.id === item.id && entry.kind === item.kind));
      })
      .catch(() => {});
    return () => abort.abort();
  }, [user, item]);
  async function toggle() {
    if (!user || pendingSave.current) return;
    pendingSave.current = true;
    saveRevision.current += 1;
    setBusy(true);
    setError(null);
    try {
      const body = await readResponse<{ saved: boolean }>(
        await fetch(`/api/opportunities/${item.id}/save`, {
          method: saved ? "DELETE" : "PUT",
        })
      );
      setSaved(body.saved);
      publishSaveChange({ userId: user.id, kind: item.kind, id: item.id, saved: body.saved });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again."
      );
    } finally {
      saveRevision.current += 1;
      pendingSave.current = false;
      setBusy(false);
    }
  }
  if (!user)
    return (
      <div className="mt-5 border-t border-border pt-5">
        <p className="mb-3 text-sm text-muted-foreground">
          Sign in to save this opportunity.
        </p>
        <SignInButton />
      </div>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={saved}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium disabled:opacity-50"
      >
        {saved ? <Check size={16} /> : <Bookmark size={16} />}
        {busy
          ? "Saving…"
          : saved
            ? "Saved to your shortlist"
            : "Save for later"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}{" "}
          <Link href="/onboarding" className="underline">
            Account setup
          </Link>
        </p>
      )}
    </>
  );
}

export function OpportunityDetail({ item }: { item: DiscoveryItem }) {
  const userId = useAuthStore((s) => s.user?.id);
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/discover"
        className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> All opportunities
      </Link>
      <div className="mb-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wider">
        <span>{listingLabels[item.listing_type]}</span>
        {item.is_pick && <span className="text-primary">Ady’s Pick</span>}
        {item.closed && <span className="text-muted-foreground">Closed</span>}
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <article className="min-w-0">
          <p className="mb-3 text-sm text-muted-foreground">
            {item.organization}
          </p>
          <h1 className="break-words text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
            {item.title}
          </h1>
          {item.curator_note && (
            <div className="my-8 border-l-2 border-primary pl-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                Why it’s here
              </h2>
              <p className="text-lg leading-relaxed">{item.curator_note}</p>
              {item.is_pick && item.pick_reason && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Ady’s Pick: {item.pick_reason}
                </p>
              )}
            </div>
          )}
          <div className="my-8 whitespace-pre-wrap break-words text-base leading-8 text-muted-foreground">
            {item.description}
          </div>
          <section className="border-t border-border py-6">
            <h2 className="mb-3 text-lg font-semibold">Who it’s for</h2>
            <p className="text-sm leading-relaxed">
              {item.eligibility_text ?? "Check eligibility with organizer"}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              University relevance:{" "}
              {item.relevance_scope === "cross_campus"
                ? "Cross-campus"
                : item.relevance_scope === "specific"
                  ? "Selected university communities"
                  : "Not specified"}
              . This does not establish eligibility or institutional
              endorsement.
            </p>
          </section>
          {item.fields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.fields.map((field) => (
                <Link
                  key={field}
                  href={`/discover?field=${encodeURIComponent(field)}`}
                  className="rounded-full border border-border px-3 py-1 text-xs"
                >
                  {field}
                </Link>
              ))}
            </div>
          )}
        </article>
        <aside className="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-28">
          <h2 className="mb-5 text-sm font-semibold">The essentials</h2>
          <ListingFacts item={item} />
          {item.closed ? (
            <p className="mt-6 rounded-lg bg-muted p-4 text-sm">
              This opportunity has closed. Explore the feed for what’s next.
            </p>
          ) : item.action_url && item.application_mode === "external" ? (
            <a
              href={item.action_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              {item.listing_type === "event" ||
              item.listing_type === "networking"
                ? "Register with organizer"
                : "Apply with organizer"}
              <ArrowUpRight size={16} />
            </a>
          ) : (
            <p className="mt-6 rounded-lg bg-muted p-4 text-sm">
              {item.action_note ??
                "Check the source for participation details."}
            </p>
          )}
          <DetailSave key={`${userId ?? "guest"}:${listingKey(item)}`} item={item} />
          <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
            Confirm current details with the organizer.
          </p>
          <div className="mt-3">
            <ReportListingButton kind="opportunity" id={item.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
