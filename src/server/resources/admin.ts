import { NextResponse } from "next/server";
import type { ResourceAdminRecord } from "@/contracts/resources";
import { badRequest } from "@/server/errors";
import { getElevatedClient } from "@/server/db/elevated";
import { log } from "@/server/log";

/** Declared MIME must agree with the bounded file header: PDF starts
 * "%PDF-", every OOXML format (docx/xlsx/pptx) is a zip and starts with the
 * zip local-file signature "PK\x03\x04". This rejects a renamed file whose
 * bytes do not match what it claims to be. */
export async function checkResourceFileContent(file: File): Promise<NextResponse | null> {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const matches = (prefix: number[]) => prefix.every((value, index) => bytes[index] === value);
  const ok = file.type === "application/pdf" ? matches([0x25, 0x50, 0x44, 0x46]) : matches([0x50, 0x4b, 0x03, 0x04]);
  return ok ? null : badRequest("File content does not match its declared type");
}

/** The one place an accepted MIME type maps to a stored extension. Fix
 * round 1, IMPORTANT: the extension is derived from the sniffed/validated
 * type, never from the caller-supplied file name, so a mismatched or hostile
 * `.name` can never choose the stored file's extension. */
const EXT_BY_TYPE: Record<string, "pdf" | "docx" | "xlsx" | "pptx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export async function adminResource(id: string): Promise<ResourceAdminRecord | null> {
  const { data, error } = await getElevatedClient()
    .from("resources")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ResourceAdminRecord | null) ?? null;
}

export async function listAdminResources(q: { status?: "draft" | "published" | "archived"; limit: number }): Promise<ResourceAdminRecord[]> {
  let query = getElevatedClient()
    .from("resources")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(q.limit);
  if (q.status) query = query.eq("status", q.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ResourceAdminRecord[];
}

function slugBase(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "file";
}

/** A short random token so a re-upload never collides with (or races) the
 * file it is about to replace. Hex-only, so it always satisfies the
 * `file_path` CHECK's `[a-z0-9-]` class. */
function randomToken(): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  return uuid.replace(/-/g, "").slice(0, 12);
}

/** Uploads a resource's file to the private bucket at a FRESH path (never the
 * live file's own path, and never `upsert: true`) so an upload that later
 * fails cannot overwrite or race the file a published resource still serves.
 * Fix round 1, IMPORTANT: the caller is responsible for removing this object
 * if the follow-up `curate_resource` edit fails (`removeResourceFile`), and
 * for removing the PREVIOUS file only after that edit succeeds. */
export async function uploadResourceFile(
  id: string,
  file: File
): Promise<{ file_path: string; file_name: string; file_size: number }> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type}`);
  const path = `${id}/${randomToken()}-${slugBase(file.name)}.${ext}`;
  const { error } = await getElevatedClient()
    .storage.from("resource-files")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { file_path: path, file_name: file.name.slice(0, 200), file_size: file.size };
}

/** Best-effort cleanup: never thrown, only logged. Used both to discard an
 * upload whose follow-up RPC failed, and to remove the file a successful
 * edit just replaced. */
export async function removeResourceFile(path: string): Promise<void> {
  const { error } = await getElevatedClient().storage.from("resource-files").remove([path]);
  if (error) log.error("Failed to remove a resource file", { error, scope: "resources", path });
}
