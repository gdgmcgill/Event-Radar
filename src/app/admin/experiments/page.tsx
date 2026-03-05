"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Play, Pause, CheckCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
  weight: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed";
  target_metric: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  variants: ExperimentVariant[];
  total_assignments: number;
}

interface NewVariant {
  name: string;
  config: string;
  weight: number;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  running: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <FlaskConical className="w-3 h-3" />,
  running: <Play className="w-3 h-3" />,
  paused: <Pause className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMetric, setFormMetric] = useState("ctr");
  const [formVariants, setFormVariants] = useState<NewVariant[]>([
    { name: "control", config: "{}", weight: 50 },
    { name: "treatment", config: '{"lambda": 0.3}', weight: 50 },
  ]);
  const [creating, setCreating] = useState(false);

  const fetchExperiments = useCallback(async () => {
    const res = await fetch("/api/admin/experiments");
    if (res.ok) {
      const data = await res.json();
      setExperiments(data.experiments);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchExperiments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const variants = formVariants.map((v) => ({
      name: v.name,
      config: JSON.parse(v.config || "{}"),
      weight: v.weight,
    }));

    const res = await fetch("/api/admin/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDescription,
        target_metric: formMetric,
        variants,
      }),
    });

    if (res.ok) {
      setShowCreate(false);
      setFormName("");
      setFormDescription("");
      setFormVariants([
        { name: "control", config: "{}", weight: 50 },
        { name: "treatment", config: '{"lambda": 0.3}', weight: 50 },
      ]);
      fetchExperiments();
    }
    setCreating(false);
  };

  const addVariant = () => {
    setFormVariants([...formVariants, { name: "", config: "{}", weight: 50 }]);
  };

  const removeVariant = (idx: number) => {
    if (formVariants.length <= 2) return;
    setFormVariants(formVariants.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, field: keyof NewVariant, value: string | number) => {
    const updated = [...formVariants];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormVariants(updated);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">A/B Experiments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage recommendation experiments and view results
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-8 p-6 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Create Experiment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., diversity-lambda-test"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What this experiment tests..."
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Metric</label>
              <select
                value={formMetric}
                onChange={(e) => setFormMetric(e.target.value)}
                className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="ctr">Click-Through Rate</option>
                <option value="save_rate">Save Rate</option>
                <option value="dismiss_rate">Dismiss Rate</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Variants</label>
                <Button variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="w-3 h-3 mr-1" /> Add Variant
                </Button>
              </div>
              <div className="space-y-3">
                {formVariants.map((v, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => updateVariant(idx, "name", e.target.value)}
                      placeholder="Variant name"
                      className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                    />
                    <input
                      type="text"
                      value={v.config}
                      onChange={(e) => updateVariant(idx, "config", e.target.value)}
                      placeholder='{"lambda": 0.7}'
                      className="flex-1 px-3 py-2 border rounded-md font-mono text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                    <input
                      type="number"
                      value={v.weight}
                      onChange={(e) => updateVariant(idx, "weight", parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                      min={1}
                    />
                    {formVariants.length > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => removeVariant(idx)}>
                        x
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleCreate} disabled={creating || !formName}>
                {creating ? "Creating..." : "Create Experiment"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Experiments Table */}
      {experiments.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No experiments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Metric</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Variants</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Assignments</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {experiments.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/experiments/${exp.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {exp.name}
                    </Link>
                    {exp.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{exp.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[exp.status]}`}>
                      {STATUS_ICONS[exp.status]}
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{exp.target_metric}</td>
                  <td className="px-4 py-3 text-sm">{exp.variants.length}</td>
                  <td className="px-4 py-3 text-sm">{exp.total_assignments}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(exp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
