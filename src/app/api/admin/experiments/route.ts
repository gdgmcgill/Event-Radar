import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { parseBody } from "@/server/body";
import { ExperimentCreateBody } from "@/contracts/admin";

export async function GET(_request: NextRequest) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!experiments || experiments.length === 0) {
    return NextResponse.json({ experiments: [] });
  }

  const experimentIds = experiments.map((e) => e.id);

  const { data: variants, error: variantsError } = await supabase
    .from("experiment_variants")
    .select("*")
    .in("experiment_id", experimentIds);

  if (variantsError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("experiment_assignments")
    .select("experiment_id")
    .in("experiment_id", experimentIds);

  if (assignmentsError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const assignmentCounts: Record<string, number> = {};
  for (const a of assignments ?? []) {
    assignmentCounts[a.experiment_id] =
      (assignmentCounts[a.experiment_id] ?? 0) + 1;
  }

  const variantsByExperiment: Record<string, typeof variants> = {};
  for (const v of variants ?? []) {
    if (!variantsByExperiment[v.experiment_id]) {
      variantsByExperiment[v.experiment_id] = [];
    }
    variantsByExperiment[v.experiment_id].push(v);
  }

  const enrichedExperiments = experiments.map((exp) => ({
    ...exp,
    variants: variantsByExperiment[exp.id] ?? [],
    total_assignments: assignmentCounts[exp.id] ?? 0,
  }));

  return NextResponse.json({ experiments: enrichedExperiments });
}

export async function POST(request: NextRequest) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;
  const supabase = ctx.supabase;

  // The name, then at least two variants (src/contracts/admin.ts).
  const parsed = await parseBody(request, ExperimentCreateBody);
  if (!parsed.ok) return parsed.response;
  const { name, description, target_metric, start_date, end_date, variants } =
    parsed.data;

  const { data: experiment, error: expError } = await supabase
    .from("experiments")
    .insert({
      name,
      description: description || null,
      target_metric: target_metric || null,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .select()
    .single();

  if (expError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const variantRows = variants.map((v) => ({
    experiment_id: experiment.id,
    name: v.name,
    config: (v.config ?? {}) as import("@/lib/supabase/types").Json,
    weight: v.weight ?? 1,
  }));

  const { data: createdVariants, error: varError } = await supabase
    .from("experiment_variants")
    .insert(variantRows)
    .select();

  if (varError) {
    // Clean up the experiment on variant creation failure
    await supabase.from("experiments").delete().eq("id", experiment.id);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    { experiment: { ...experiment, variants: createdVariants } },
    { status: 201 }
  );
}
