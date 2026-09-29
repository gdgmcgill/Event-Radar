"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ResourceAdminRecord, ResourceData } from "@/contracts/resources";
import {
  RESOURCE_CATEGORY_LABELS,
  ResourceCreateBody,
  ResourceFields,
} from "@/contracts/resources";
import { findUnsafeMarkdown } from "@/lib/markdown/parse";
import { SafeMarkdown } from "@/lib/markdown/SafeMarkdown";
import { readResponse } from "@/components/discovery/presentation";

const inputStyle =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50";

const initial = (): ResourceData => ({
  ...ResourceCreateBody.parse({
    slug: "draft",
    resource_type: "guide",
    title: "Draft",
    summary: "Draft summary",
    body_markdown: "Draft body.",
    category: "career",
    audience: "Everyone",
    author_name: "Draft",
  }),
  slug: "",
  title: "",
  summary: "",
  body_markdown: "",
  audience: "",
  author_name: "",
});

function editable(item: ResourceAdminRecord): ResourceData {
  return ResourceCreateBody.parse(
    Object.fromEntries(
      Object.keys(ResourceFields.shape).map((key) => [
        key,
        item[key as keyof ResourceAdminRecord],
      ])
    )
  );
}

export function ResourceEditor() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ResourceAdminRecord[]>([]);
  const [record, setRecord] = useState<ResourceAdminRecord | null>(null);
  const [form, setForm] = useState<ResourceData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  async function refresh() {
    const body = await readResponse<{ items: ResourceAdminRecord[] }>(
      await fetch("/api/admin/resources?limit=100", { cache: "no-store" })
    );
    setItems(body.items);
    return body.items;
  }

  function accept(item: ResourceAdminRecord) {
    setRecord(item);
    setForm(editable(item));
    setDirty(false);
  }

  async function open(id: string) {
    if (dirty && !window.confirm("Discard the unsaved changes to this resource?"))
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = await readResponse<{ item: ResourceAdminRecord }>(
        await fetch(`/api/admin/resources/${id}`, { cache: "no-store" })
      );
      accept(body.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open resource.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    refresh()
      .then((list) => {
        if (!active) return;
        const preselect = searchParams.get("id");
        if (preselect && list.some((item) => item.id === preselect)) {
          void open(preselect);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load resources.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function field<K extends keyof ResourceData>(name: K, value: ResourceData[K]) {
    setForm((old) => ({ ...old, [name]: value }));
    setDirty(true);
    setNotice(null);
  }

  /** Fix round 1, minor: switching type left the OTHER type's field behind
   * in form state (hidden from the UI, but still present), which silently
   * failed the shape rule and disabled Save with no visible reason. Clearing
   * the fields the new type does not use keeps the form and the validation
   * it is judged against in agreement. */
  function changeType(nextType: ResourceData["resource_type"]) {
    setForm((old) => ({
      ...old,
      resource_type: nextType,
      body_markdown: nextType === "guide" ? old.body_markdown : null,
      external_url: nextType === "external" ? old.external_url : null,
    }));
    setDirty(true);
    setNotice(null);
  }

  const bodyIssue =
    form.resource_type === "guide" ? findUnsafeMarkdown(form.body_markdown ?? "") : null;
  const validation = ResourceCreateBody.safeParse(form);
  // Fix round 1, minor: a shape-rule failure (e.g. a stale external_url left
  // over from a previous type) must be visible, not just a disabled button.
  const validationMessage = !validation.success
    ? validation.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" · ")
    : null;

  async function persist(action: "edit" | "publish" | "archive") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action !== "edit" && dirty)
        throw new Error("Save your draft changes before changing its status.");
      const validated = ResourceCreateBody.safeParse(form);
      if (!validated.success)
        throw new Error(
          validated.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" · ")
        );
      const body = record
        ? action === "edit"
          ? { action, expected_updated_at: record.updated_at, data: validated.data }
          : { action, expected_updated_at: record.updated_at }
        : validated.data;
      const result = await readResponse<{ item: ResourceAdminRecord }>(
        await fetch(record ? `/api/admin/resources/${record.id}` : "/api/admin/resources", {
          method: record ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
      accept(result.item);
      setNotice(
        action === "publish"
          ? "Published. The resource is available to students."
          : action === "archive"
            ? "Archived. The resource is no longer public."
            : "Draft changes saved."
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!record) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("expected_updated_at", record.updated_at);
      const result = await readResponse<{ item: ResourceAdminRecord }>(
        await fetch(`/api/admin/resources/${record.id}/file`, { method: "POST", body: form })
      );
      accept(result.item);
      setNotice("File uploaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Editorial desk
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Resources</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Author guides, link external resources, and attach templates for
          students to download.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        <aside className="min-w-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved changes?")) {
                setRecord(null);
                setForm(initial());
                setDirty(false);
                setError(null);
                setNotice(null);
              }
            }}
            className="mb-4 w-full rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            + New resource
          </button>
          {loading && <p role="status">Loading resources…</p>}
          <nav aria-label="Resource drafts" className="max-h-[60vh] space-y-2 overflow-y-auto">
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
                  {item.status} · {item.resource_type}
                </span>
              </button>
            ))}
          </nav>
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
              <div role="alert" className="break-words rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
                {error}
              </div>
            )}
            {notice && (
              <p role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-4 text-sm">
                {notice}
              </p>
            )}
            <fieldset disabled={busy} className="space-y-6 disabled:opacity-70">
              <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">The resource</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Title
                    <input
                      className={inputStyle}
                      value={form.title}
                      onChange={(e) => field("title", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    URL slug
                    <input
                      className={inputStyle}
                      value={form.slug}
                      onChange={(e) => field("slug", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Type
                    <select
                      className={inputStyle}
                      value={form.resource_type}
                      onChange={(e) =>
                        changeType(e.target.value as ResourceData["resource_type"])
                      }
                    >
                      <option value="guide">Guide</option>
                      <option value="external">External link</option>
                      <option value="template">Template</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Category
                    <select
                      className={inputStyle}
                      value={form.category}
                      onChange={(e) =>
                        field("category", e.target.value as ResourceData["category"])
                      }
                    >
                      {Object.entries(RESOURCE_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm font-medium">
                  Summary
                  <textarea
                    className={inputStyle}
                    rows={2}
                    value={form.summary}
                    onChange={(e) => field("summary", e.target.value)}
                  />
                </label>
                {form.resource_type === "guide" && (
                  <label className="block space-y-1.5 text-sm font-medium">
                    Body (Markdown)
                    <textarea
                      className={inputStyle}
                      rows={12}
                      value={form.body_markdown ?? ""}
                      onChange={(e) => field("body_markdown", e.target.value)}
                    />
                    {bodyIssue && (
                      <span className="block text-xs font-normal text-destructive">
                        {bodyIssue}
                      </span>
                    )}
                  </label>
                )}
                {form.resource_type === "external" && (
                  <label className="block space-y-1.5 text-sm font-medium">
                    External URL
                    <input
                      className={inputStyle}
                      type="url"
                      value={form.external_url ?? ""}
                      onChange={(e) => field("external_url", e.target.value || null)}
                    />
                  </label>
                )}
                {form.resource_type === "template" && (
                  <div className="space-y-1.5 text-sm font-medium">
                    <label htmlFor="resource-file">Template file (PDF, DOCX, XLSX, PPTX)</label>
                    <input
                      id="resource-file"
                      type="file"
                      disabled={!record}
                      accept=".pdf,.docx,.xlsx,.pptx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadFile(file);
                      }}
                    />
                    {!record && (
                      <p className="text-xs font-normal text-muted-foreground">
                        Save a draft before attaching a file.
                      </p>
                    )}
                    {record?.file_name && (
                      <p className="text-xs font-normal text-muted-foreground">
                        Current file: {record.file_name}
                      </p>
                    )}
                  </div>
                )}
              </section>
              <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
                <h3 className="font-semibold">Attribution</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Audience
                    <input
                      className={inputStyle}
                      value={form.audience}
                      onChange={(e) => field("audience", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Author name
                    <input
                      className={inputStyle}
                      value={form.author_name}
                      onChange={(e) => field("author_name", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Author URL
                    <input
                      className={inputStyle}
                      type="url"
                      value={form.author_url ?? ""}
                      onChange={(e) => field("author_url", e.target.value || null)}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Source note
                    <input
                      className={inputStyle}
                      value={form.source_note ?? ""}
                      onChange={(e) => field("source_note", e.target.value || null)}
                    />
                  </label>
                </div>
              </section>
              {validationMessage && (
                <p role="alert" className="text-xs text-destructive">
                  Cannot save yet: {validationMessage}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-border py-5">
                <button
                  type="submit"
                  disabled={busy || !validation.success}
                  className="rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-40"
                >
                  {busy ? "Saving…" : record ? "Save changes" : "Save draft"}
                </button>
                {record && (
                  <>
                    <button
                      type="button"
                      disabled={dirty || record.status === "published"}
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
                      <a
                        href={`/resources/${record.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        View published resource ↗
                      </a>
                    )}
                  </>
                )}
              </div>
            </fieldset>
          </form>
        </div>
        <aside aria-label="Draft preview" className="min-w-0">
          <div className="rounded-xl border border-primary/30 bg-card p-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              Preview
            </p>
            <h3 className="text-lg font-semibold">{form.title || "Untitled"}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{form.summary}</p>
            {form.resource_type === "guide" && (
              <div className="mt-4 text-sm">
                <SafeMarkdown source={form.body_markdown ?? ""} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
