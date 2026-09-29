import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { getDiscoveryAccess } from "@/lib/features";
import { parseWith } from "@/server/body";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { notFound } from "@/server/errors";
import { withRoute } from "@/server/route";
async function save(_request: NextRequest, { params }: { params: Promise<{ id: string }> }, desired: boolean) {
 const ctx = await createRequestContext(); const active = requireActiveUser(ctx); if (!active.ok) return active.response;
 const onboarded = requireOnboarded(ctx); if (!onboarded.ok) return onboarded.response;
 if (!getDiscoveryAccess(ctx).enabled) return notFound("Not found");
 const parsed = parseWith(DetailParams, await params); if (!parsed.ok) return parsed.response;
 const id = parsed.data.id;
 if (desired) {
  const { data, error } = await ctx.supabase.from("opportunities").select("id").eq("id", id).eq("status", "published").is("deleted_at", null).maybeSingle(); if (error) throw error;
  if (!data) return notFound("Opportunity not found");
  const { error: insertError } = await ctx.supabase.from("saved_opportunities").upsert({ user_id: active.user.id, opportunity_id: id }, { onConflict: "user_id,opportunity_id", ignoreDuplicates: true }); if (insertError) throw insertError;
 } else { const { error } = await ctx.supabase.from("saved_opportunities").delete().eq("user_id", active.user.id).eq("opportunity_id", id); if (error) throw error; }
 return NextResponse.json({ saved: desired });
}
export const PUT = withRoute({ cache: "private", action: "save opportunity" }, (request: NextRequest, context: { params: Promise<{ id: string }> }) => save(request, context, true));
export const DELETE = withRoute({ cache: "private", action: "unsave opportunity" }, (request: NextRequest, context: { params: Promise<{ id: string }> }) => save(request, context, false));
