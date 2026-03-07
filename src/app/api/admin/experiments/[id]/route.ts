import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    return NextResponse.json(
      { error: variantsError.message },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: assignmentsError.message },
        { status: 500 }
      );
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
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("status" in body) {
    updateData.status = body.status;
    if (body.status === "running") {
      updateData.start_date = new Date().toISOString();
    }
  }

  if ("description" in body) {
    updateData.description = body.description;
  }

  if ("end_date" in body) {
    updateData.end_date = body.end_date;
  }

  const { data: experiment, error } = await supabase
    .from("experiments")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiment });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
