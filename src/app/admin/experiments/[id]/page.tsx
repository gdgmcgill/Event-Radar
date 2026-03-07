"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Variant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown> | null;
  assignments: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "running" | "paused" | "completed";
  target_metric: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  variants: Variant[];
  total_assignments: number;
}

interface VariantResult {
  variant_id: string;
  variant_name: string;
  impressions: number;
  clicks: number;
  saves: number;
  dismissals: number;
  ctr: number;
  save_rate: number;
  dismiss_rate: number;
}

interface Results {
  experiment_id: string;
  target_metric: string;
  is_significant: boolean;
  variants: VariantResult[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

const METRIC_KEY_MAP: Record<string, keyof VariantResult> = {
  ctr: "ctr",
  click_through_rate: "ctr",
  save_rate: "save_rate",
  dismiss_rate: "dismiss_rate",
  impressions: "impressions",
};

function getMetricValue(variant: VariantResult, metric: string): number {
  const key = METRIC_KEY_MAP[metric] ?? "ctr";
  return Number(variant[key]) || 0;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3 rounded-lg border bg-white p-6">
          <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-96 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-4 pt-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg border bg-gray-100"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border bg-gray-100" />
      </div>
    </div>
  );
}

export default function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [expRes, resultsRes] = await Promise.all([
        fetch(`/api/admin/experiments/${id}`),
        fetch(`/api/admin/experiments/${id}/results`),
      ]);

      if (!expRes.ok) {
        const body = await expRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch experiment");
      }

      const expData = await expRes.json();
      setExperiment(expData.experiment);

      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults(resultsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (status: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update status");
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteExperiment = async () => {
    if (!confirm("Are you sure you want to delete this experiment?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete experiment");
      }
      router.push("/admin/experiments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (error || !experiment) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/admin/experiments"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Experiments
          </Link>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
            {error || "Experiment not found"}
          </div>
        </div>
      </div>
    );
  }

  const targetMetric = experiment.target_metric ?? "ctr";
  const maxMetricValue =
    results && results.variants.length > 0
      ? Math.max(...results.variants.map((v) => getMetricValue(v, targetMetric)))
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back link */}
        <Link
          href="/admin/experiments"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Experiments
        </Link>

        {/* Header */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {experiment.name}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[experiment.status]}`}
                >
                  {experiment.status}
                </span>
              </div>
              {experiment.description && (
                <p className="text-gray-600">{experiment.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span>
                  Target metric:{" "}
                  <strong className="text-gray-700">{targetMetric}</strong>
                </span>
                <span>
                  Assignments:{" "}
                  <strong className="text-gray-700">
                    {experiment.total_assignments}
                  </strong>
                </span>
                {experiment.start_date && (
                  <span>
                    Started:{" "}
                    <strong className="text-gray-700">
                      {new Date(experiment.start_date).toLocaleDateString()}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* Status controls */}
            <div className="flex flex-shrink-0 gap-2">
              {experiment.status === "draft" && (
                <>
                  <Button
                    onClick={() => updateStatus("running")}
                    disabled={actionLoading}
                    size="sm"
                    className="gap-1"
                  >
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                  <Button
                    onClick={deleteExperiment}
                    disabled={actionLoading}
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
              {experiment.status === "running" && (
                <>
                  <Button
                    onClick={() => updateStatus("paused")}
                    disabled={actionLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                  <Button
                    onClick={() => updateStatus("completed")}
                    disabled={actionLoading}
                    size="sm"
                    className="gap-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </Button>
                </>
              )}
              {experiment.status === "paused" && (
                <>
                  <Button
                    onClick={() => updateStatus("running")}
                    disabled={actionLoading}
                    size="sm"
                    className="gap-1"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                  <Button
                    onClick={() => updateStatus("completed")}
                    disabled={actionLoading}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Variants config */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experiment.variants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-lg border bg-white p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{variant.name}</h3>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    weight: {variant.weight}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {variant.assignments} assignment
                  {variant.assignments !== 1 ? "s" : ""}
                </p>
                {variant.config && Object.keys(variant.config).length > 0 && (
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                    {JSON.stringify(variant.config, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Results section */}
        {results && results.variants.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Results</h2>

            {/* Significance banner */}
            <div
              className={`rounded-lg border p-4 text-sm font-medium ${
                results.is_significant
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {results.is_significant
                ? "Results are statistically significant."
                : "Results are not yet statistically significant."}
            </div>

            {/* Metrics table */}
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3 text-right">Impressions</th>
                    <th className="px-4 py-3 text-right">CTR %</th>
                    <th className="px-4 py-3 text-right">Save %</th>
                    <th className="px-4 py-3 text-right">Dismiss %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.variants.map((v) => (
                    <tr key={v.variant_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {v.variant_name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {v.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPercent(v.ctr)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPercent(v.save_rate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPercent(v.dismiss_rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bar chart */}
            <div className="rounded-lg border bg-white p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {targetMetric.replace(/_/g, " ").toUpperCase()} by Variant
              </h3>
              <div className="space-y-3">
                {results.variants.map((v) => {
                  const value = getMetricValue(v, targetMetric);
                  const widthPercent =
                    maxMetricValue > 0
                      ? (value / maxMetricValue) * 100
                      : 0;
                  return (
                    <div key={v.variant_id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          {v.variant_name}
                        </span>
                        <span className="tabular-nums text-gray-500">
                          {typeof value === "number" && value <= 1
                            ? formatPercent(value)
                            : value.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-5 rounded-full bg-[#ED1B2F] transition-all duration-500"
                          style={{ width: `${Math.max(widthPercent, 1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
