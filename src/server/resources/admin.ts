import { NextResponse } from "next/server";
import type { ResourceAdminRecord } from "@/contracts/resources";
import { badRequest } from "@/server/errors";
import { getElevatedClient } from "@/server/db/elevated";

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

function slugify(base: string): string {
  const slug = base
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return slug || "file";
}

/** Uploads a resource's file to the private bucket. The stored path always
 * starts with the resource's own id (matching the migration's file_path
 * check), so no two resources can collide on a filename. */
export async function uploadResourceFile(
  id: string,
  file: File
): Promise<{ file_path: string; file_name: string; file_size: number }> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const path = `${id}/${slugify(file.name)}.${ext}`;
  const { error } = await getElevatedClient()
    .storage.from("resource-files")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return { file_path: path, file_name: file.name, file_size: file.size };
}
