import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { chiSquaredTest } from "@/lib/experiments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type VariantRow = {
  id: string;
  name: string;
  config: Record<string, unknown>;
  weight: number;
};
type AssignmentRow = { variant_id: string };
type FeedbackRow = { action: string; experiment_variant_id: string | null };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { supabase, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Fetch experiment
  const { data: experiment, error: expError } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (expError || !experiment) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  // Fetch variants
  const { data: variantsRaw, error: varError } = await supabase
    .from("experiment_variants")
    .select("id, name, config, weight")
    .eq("experiment_id", id);

  if (varError) {
    return NextResponse.json({ error: varError.message }, { status: 500 });
  }

  const variants = (variantsRaw ?? []) as VariantRow[];
  const variantIds = variants.map((v) => v.id);

  // Fetch assignments and feedback in parallel
  const [assignmentsResult, feedbackResult] = await Promise.all([
    supabase
      .from("experiment_assignments")
      .select("variant_id")
      .in("variant_id", variantIds),
    supabase
      .from("recommendation_feedback")
      .select("action, experiment_variant_id")
      .in("experiment_variant_id", variantIds),
  ]);

  if (assignmentsResult.error) {
    return NextResponse.json(
      { error: assignmentsResult.error.message },
      { status: 500 }
    );
  }
  if (feedbackResult.error) {
    return NextResponse.json(
      { error: feedbackResult.error.message },
      { status: 500 }
    );
  }

  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const feedback = (feedbackResult.data ?? []) as FeedbackRow[];

  // Count assignments per variant
  const assignmentCounts = new Map<string, number>();
  for (const a of assignments) {
    assignmentCounts.set(a.variant_id, (assignmentCounts.get(a.variant_id) ?? 0) + 1);
  }

  // Group feedback by variant
  const feedbackByVariant = new Map<string, FeedbackRow[]>();
  for (const f of feedback) {
    if (f.experiment_variant_id) {
      const list = feedbackByVariant.get(f.experiment_variant_id) ?? [];
      list.push(f);
      feedbackByVariant.set(f.experiment_variant_id, list);
    }
  }

  // Compute per-variant metrics
  const variantMetrics = variants.map((v) => {
    const rows = feedbackByVariant.get(v.id) ?? [];
    const impressions = rows.filter((r) => r.action === "impression").length;
    const clicks = rows.filter((r) => r.action === "click").length;
    const saves = rows.filter((r) => r.action === "save").length;
    const dismisses = rows.filter((r) => r.action === "dismiss").length;

    const ctr_percent =
      impressions > 0
        ? Math.round((clicks / impressions) * 100 * 100) / 100
        : 0;
    const save_rate_percent =
      impressions > 0
        ? Math.round((saves / impressions) * 100 * 100) / 100
        : 0;
    const dismiss_rate_percent =
      impressions > 0
        ? Math.round((dismisses / impressions) * 100 * 100) / 100
        : 0;

    return {
      variant_id: v.id,
      variant_name: v.name,
      config: v.config,
      weight: v.weight,
      assignments: assignmentCounts.get(v.id) ?? 0,
      impressions,
      clicks,
      saves,
      dismisses,
      ctr_percent,
      save_rate_percent,
      dismiss_rate_percent,
    };
  });

  // Run chi-squared test based on target_metric
  const targetMetric: string = experiment.target_metric ?? "ctr";
  const chiData = variantMetrics.map((m) => {
    let conversions: number;
    if (targetMetric === "save_rate") {
      conversions = m.saves;
    } else if (targetMetric === "dismiss_rate") {
      conversions = m.dismisses;
    } else {
      conversions = m.clicks;
    }
    return { conversions, total: m.impressions };
  });

  const significance = chiSquaredTest(chiData);

  return NextResponse.json({
    experiment,
    variant_metrics: variantMetrics,
    significance,
  });
}
