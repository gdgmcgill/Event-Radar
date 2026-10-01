import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { parseBody } from "@/server/body";
import { ExperimentUpdateBody } from "@/contracts/admin";
import type { TablesUpdate } from "@/lib/supabase/types";
import { logRouteError, withRoute } from "@/server/route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withRoute({ cache: "private", action: "fetch experiment" }, async (_request: NextRequest, { params }: RouteParams) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  const { id } = await params;

  const { data: experiment, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  const { data: variants, error: variantsError } = await supabase
    .from("experiment_variants")
    .select("*")
    .eq("experiment_id", id);

  if (variantsError) {
    logRouteError(variantsError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const variantIds = (variants ?? []).map((v) => v.id);

  let assignmentCountsByVariant: Record<string, number> = {};
  let totalAssignments = 0;

  if (variantIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("experiment_assignments")
      .select("variant_id")
      .in("variant_id", variantIds);

    if (assignmentsError) {
      logRouteError(assignmentsError);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    for (const a of assignments ?? []) {
      assignmentCountsByVariant[a.variant_id] =
        (assignmentCountsByVariant[a.variant_id] ?? 0) + 1;
    }

    totalAssignments = (assignments ?? []).length;
  }

  const enrichedVariants = (variants ?? []).map((v) => ({
    ...v,
    assignments: assignmentCountsByVariant[v.id] ?? 0,
  }));

  return NextResponse.json({
    experiment: {
      ...experiment,
      variants: enrichedVariants,
      total_assignments: totalAssignments,
    },
  });
});

export const PATCH = withRoute({ cache: "private", action: "update experiment" }, async (request: NextRequest, { params }: RouteParams) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  const { id } = await params;
  // status (the table's four values), description and end_date, each only
  // when sent (src/contracts/admin.ts).
  const parsed = await parseBody(request, ExperimentUpdateBody);
  if (!parsed.ok) return parsed.response;
  const { status, description, end_date } = parsed.data;

  // Typed as the experiments update (DI-53).
  const updateData: TablesUpdate<"experiments"> = {
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) {
    updateData.status = status;
    if (status === "running") {
      updateData.start_date = new Date().toISOString();
    }
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  if (end_date !== undefined) {
    updateData.end_date = end_date;
  }

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logRouteError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ experiment });
});

export const DELETE = withRoute({ cache: "private", action: "delete experiment" }, async (_request: NextRequest, { params }: RouteParams) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  const { id } = await params;

  const { data: experiment, error: fetchError } = await supabase
    .from("experiments")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError || !experiment) {
    return NextResponse.json(
      { error: "Experiment not found" },
      { status: 404 }
    );
  }

  if (experiment.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft experiments can be deleted" },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("experiments")
    .delete()
    .eq("id", id);

  if (deleteError) {
    logRouteError(deleteError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
