import { NextResponse } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import type { Json } from "@/lib/supabase/types";
export async function adminContext() {
  const ctx = await createRequestContext();
  const active = requireActiveUser(ctx); if (!active.ok) return { ok: false as const, response: active.response };
  const admin = requireRole(ctx, "admin"); if (!admin.ok) return { ok: false as const, response: admin.response };
  return { ok: true as const, ctx, user: admin.user, canPick: !!process.env.CURATOR_USER_ID && process.env.CURATOR_USER_ID === admin.user.id };
}
export function mutationError(error: { code: string; message: string }) {
  const status = error.code === "40001" || error.code === "23505" ? 409 : error.code === "42501" ? 403 : error.code === "P0002" ? 404 : ["22023", "23514", "23503"].includes(error.code) ? 400 : null;
  if (!status) throw error;
  return NextResponse.json({ error: error.code === "23505" ? "That slug is already in use" : error.code === "23514" ? "Listing violates a data constraint" : error.message }, { status });
}
export async function adminOpportunity(id: string) {
  const db = getElevatedClient();
  const { data: item, error } = await db.from("opportunities").select("*,opportunity_universities(university_id)").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!item) return null;
  const { data: duplicates, error: duplicateError } = await db.rpc("discovery_duplicate_candidates", { p_kind: "opportunity", p_id: id });
  if (duplicateError) throw duplicateError;
  const { opportunity_universities, ...rest } = item;
  return { item: { ...rest, university_ids: opportunity_universities.map((row) => row.university_id) }, duplicates: duplicates as Json };
}
