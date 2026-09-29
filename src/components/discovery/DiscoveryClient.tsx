"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DiscoveryItem, DiscoveryPage } from "@/contracts/discovery";
import { useAuthStore } from "@/store/useAuthStore";
import { SignInButton } from "@/components/auth/SignInButton";
import { ListingCard } from "./ListingCard";
import { publishSaveChange, subscribeSaveChanges } from "./saveChanges";
import { listingKey, listingLabels, readResponse } from "./presentation";

type University = { id: string; name: string };
const control =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm";

export function DiscoveryClient({
  savedOnly = false,
}: {
  savedOnly?: boolean;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useSearchParams().toString();
  // Unmount all private state immediately on account switch or sign out.
  return (
    <DiscoverySession
      key={`${userId ?? "guest"}:${query}`}
      userId={userId}
      savedOnly={savedOnly}
    />
  );
}

function DiscoverySession({
  savedOnly,
  userId,
}: {
  savedOnly: boolean;
  userId?: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const query = savedOnly ? "" : params.toString();
  const [page, setPage] = useState<DiscoveryPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [universities, setUniversities] = useState<University[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const pendingSaves = useRef(new Set<string>());
  const saveRevisions = useRef(new Map<string, number>());
  // A saved-list snapshot may have been read before an unsave completed.
  // Keep local successful removals authoritative across retries/pagination.
  // This session is remounted on account/query changes, so no state leaks.
  const locallyUnsaved = useRef(new Set<string>());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!savedOnly || !userId) return;
    return subscribeSaveChanges(userId, change => {
      const key = listingKey(change);
      if (change.saved) locallyUnsaved.current.delete(key);
      else locallyUnsaved.current.add(key);
      // A mutation from the previous screen may finish after this screen's
      // first read. Refetch only after the server confirms that write.
      setRetry(value => value + 1);
    });
  }, [savedOnly, userId]);

  useEffect(() => {
    const abort = new AbortController();
    if (savedOnly && !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPage(null);
    fetch(`${savedOnly ? "/api/saved" : "/api/discovery"}?${query}`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(readResponse<DiscoveryPage>)
      .then((data) => {
        if (abort.signal.aborted) return;
        const currentItems = () => savedOnly
          ? data.items.filter(item => !locallyUnsaved.current.has(listingKey(item)))
          : data.items;
        setPage(() => ({ ...data, items: currentItems() }));
        if (savedOnly) setSaved(() => new Set(currentItems().map(listingKey)));
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [query, savedOnly, userId, retry]);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/universities", { signal: abort.signal })
      .then(readResponse<{ universities: University[] }>)
      .then((body) => setUniversities(body.universities))
      .catch(() => {});
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!userId || savedOnly || !page?.items.length) return;
    const abort = new AbortController();
    const keys = page.items.slice(-50).map(listingKey);
    const revisions = new Map(keys.map(key => [key, saveRevisions.current.get(key) ?? 0]));
    const identities = keys.join(",");
    fetch(`/api/saved/status?identities=${encodeURIComponent(identities)}`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(
        readResponse<{ saved: { kind: "event" | "opportunity"; id: string }[] }>
      )
      .then((body) => {
        if (abort.signal.aborted) return;
        const received = new Set(body.saved.map(listingKey));
        setSaved((old) => {
          const next = new Set(old);
          for (const key of keys) {
            // A read started before or during a mutation cannot undo the
            // mutation's authoritative response, including an unsave.
            if (pendingSaves.current.has(key) || revisions.get(key) !== (saveRevisions.current.get(key) ?? 0)) continue;
            if (received.has(key)) next.add(key);
            else next.delete(key);
          }
          return next;
        });
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setSaveMessage(
            "Saved status could not load. You can still save an item safely."
          );
      });
    return () => abort.abort();
  }, [page, userId, savedOnly]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/discover${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  };
  const saveItem = useCallback(
    async (item: DiscoveryItem) => {
      if (!userId) {
        setSaveMessage("Sign in to keep opportunities in your saved list.");
        return;
      }
      const key = listingKey(item);
      if (pendingSaves.current.has(key)) return;
      pendingSaves.current.add(key);
      saveRevisions.current.set(key, (saveRevisions.current.get(key) ?? 0) + 1);
      setSaving(new Set(pendingSaves.current));
      setSaveMessage(null);
      try {
        const result = await readResponse<{ saved: boolean }>(
          await fetch(
            `/api/${item.kind === "event" ? "events" : "opportunities"}/${item.id}/save`,
            { method: saved.has(key) ? "DELETE" : "PUT" }
          )
        );
        if (result.saved) locallyUnsaved.current.delete(key);
        else locallyUnsaved.current.add(key);
        setSaved((old) => {
          const next = new Set(old);
          if (result.saved) next.add(key);
          else next.delete(key);
          return next;
        });
        if (savedOnly && !result.saved)
          setPage((old) =>
            old
              ? {
                  ...old,
                  items: old.items.filter((entry) => listingKey(entry) !== key),
                }
              : old
          );
        publishSaveChange({ userId, kind: item.kind, id: item.id, saved: result.saved });
      } catch (e) {
        setSaveMessage(
          e instanceof Error ? e.message : "Could not save. Please try again."
        );
      } finally {
        saveRevisions.current.set(key, (saveRevisions.current.get(key) ?? 0) + 1);
        pendingSaves.current.delete(key);
        setSaving(new Set(pendingSaves.current));
      }
    },
    [saved, userId, savedOnly]
  );

  async function loadMore() {
    if (!page?.next_cursor || more) return;
    const currentQuery = query;
    setMore(true);
    setError(null);
    const next = new URLSearchParams(query);
    next.set("cursor", page.next_cursor);
    try {
      const result = await readResponse<DiscoveryPage>(
        await fetch(`${savedOnly ? "/api/saved" : "/api/discovery"}?${next}`, {
          cache: "no-store",
        })
      );
      // A navigation unmount or changed query must not mix two result sets.
      setPage((old) =>
        old && old.as_of === result.as_of && currentQuery === query
          ? {
              ...result,
              items: [
                ...old.items,
                ...result.items.filter(
                  (item) =>
                    (!savedOnly || !locallyUnsaved.current.has(listingKey(item))) &&
                    !old.items.some(
                      (previous) => listingKey(previous) === listingKey(item)
                    )
                ),
              ],
            }
          : old
      );
      if (savedOnly)
        setSaved((old) => new Set([...old, ...result.items.map(listingKey)]
          .filter(key => !locallyUnsaved.current.has(key))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more.");
    } finally {
      setMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-10 max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {savedOnly ? "Your shortlist" : "Montreal & beyond"}
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl">
          {savedOnly ? (
            "Worth coming back to."
          ) : (
            <>
              Your next opportunity
              <br className="hidden sm:block" /> starts here.
            </>
          )}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
          {savedOnly
            ? "Events and opportunities you’ve saved, together in one place."
            : "Events, hackathons, jobs, and programs. Explore what’s happening across campus and what comes next."}
        </p>
      </div>
      {savedOnly && !userId ? (
        <div className="rounded-xl border border-border p-8">
          <h2 className="mb-3 text-xl font-semibold">
            Keep a shortlist of what matters.
          </h2>
          <p className="mb-5 text-muted-foreground">
            Sign in with any verified email to save opportunities.
          </p>
          <SignInButton />
        </div>
      ) : (
        <>
          {!savedOnly && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateFilter(
                  "q",
                  String(new FormData(e.currentTarget).get("q") ?? "")
                );
              }}
              className="mb-8 space-y-4 rounded-xl border border-border p-4 sm:p-5"
            >
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">Search opportunities</span>
                  <input
                    key={params.get("q")}
                    name="q"
                    defaultValue={params.get("q") ?? ""}
                    maxLength={120}
                    placeholder="Search opportunities, organizations, or interests"
                    className={control}
                  />
                </label>
                <button
                  className="rounded-lg bg-foreground px-4 text-sm font-medium text-background"
                  type="submit"
                >
                  Search
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1 text-xs font-medium">
                  Type
                  <select
                    className={control}
                    value={params.get("type") ?? ""}
                    onChange={(e) => updateFilter("type", e.target.value)}
                  >
                    <option value="">All opportunities</option>
                    {Object.entries(listingLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium">
                  University relevance
                  <select
                    className={control}
                    value={params.get("university") ?? ""}
                    onChange={(e) => updateFilter("university", e.target.value)}
                  >
                    <option value="">McGill + cross-campus</option>
                    {universities.map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name} + cross-campus
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Date / deadline
                  <select
                    className={control}
                    value={params.get("window") ?? "upcoming"}
                    onChange={(e) => updateFilter("window", e.target.value)}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="this_week">This week (Toronto)</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Field
                  <select
                    className={control}
                    value={params.get("field") ?? ""}
                    onChange={(e) => updateFilter("field", e.target.value)}
                  >
                    <option value="">All fields</option>
                    {[
                      "technology",
                      "business",
                      "design",
                      "science",
                      "arts",
                      "community",
                    ].map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                    {params.get("field") &&
                      ![
                        "technology",
                        "business",
                        "design",
                        "science",
                        "arts",
                        "community",
                      ].includes(params.get("field")!) && (
                        <option value={params.get("field")!}>
                          {params.get("field")}
                        </option>
                      )}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Work mode
                  <select
                    className={control}
                    value={params.get("work_mode") ?? ""}
                    onChange={(e) => updateFilter("work_mode", e.target.value)}
                  >
                    <option value="">Any location</option>
                    <option value="in_person">In person</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <p>
                  University relevance is not eligibility. Check each listing.
                </p>
                {query && (
                  <Link href="/discover" className="underline">
                    Clear filters
                  </Link>
                )}
              </div>
            </form>
          )}
          {saveMessage && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-border p-4 text-sm"
            >
              {saveMessage}
              {!userId && (
                <div className="mt-3">
                  <SignInButton />
                </div>
              )}
              {userId && (
                <Link href="/onboarding" className="ml-2 underline">
                  Account setup
                </Link>
              )}
            </div>
          )}
          {loading && (
            <p role="status" className="py-12 text-muted-foreground">
              Loading opportunities…
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-destructive/30 p-5"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-3 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}
          {page && (
            <>
              <div className="mb-4 flex items-baseline justify-between border-b border-border pb-3">
                <h2 className="text-sm font-semibold">
                  {savedOnly ? "Saved for later" : "Explore the opportunities"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {page.items.length} shown
                </span>
              </div>
              {page.items.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {page.items.map((item) => (
                    <ListingCard
                      key={listingKey(item)}
                      item={item}
                      saved={saved.has(listingKey(item))}
                      busy={saving.has(listingKey(item))}
                      onSave={() => void saveItem(item)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
                  <h3 className="text-xl font-semibold">
                    {savedOnly
                      ? "Your shortlist is ready for its first find."
                      : "Nothing here just yet."}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {savedOnly
                      ? "Save an event or opportunity to find it here."
                      : "Try another filter or check back as new opportunities are added."}
                  </p>
                  <Link
                    className="mt-5 inline-block font-semibold underline"
                    href="/discover"
                  >
                    {savedOnly ? "Explore opportunities" : "Clear filters"}
                  </Link>
                </div>
              )}
              {page.next_cursor && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    disabled={more}
                    onClick={() => void loadMore()}
                    className="rounded-lg border border-border px-6 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {more ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
