"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EVENT_CATEGORIES, QUICK_FILTER_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { Pencil, Save, X, Heart } from "lucide-react";
import InterestTagSelector from "@/components/profile/InterestTagSelector";

type InterestsCardProps = {
  userId?: string;
  initialTags: string[];
};

function normalizeInterests(interest_tags: unknown): string[] {
  if (!interest_tags) return [];
  if (Array.isArray(interest_tags)) {
    return interest_tags.filter(
      (tag): tag is string => tag && typeof tag === "string"
    );
  }
  return [];
}

function getTagLabel(tag: string): string {
  return EVENT_CATEGORIES[tag as EventTag]?.label ?? QUICK_FILTER_CATEGORIES[tag]?.label ?? tag;
}

export default function InterestsCard({ userId, initialTags }: InterestsCardProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(
    normalizeInterests(initialTags)
  );
  const [editingTags, setEditingTags] = useState<string[]>(selectedTags);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditingTags(selectedTags);
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditingTags(selectedTags);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/interests", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interest_tags: editingTags,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update interests");
      }

      setSelectedTags(editingTags);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-red-600/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-600" /> My Interests
        </h3>
        {!isEditing && selectedTags.length > 0 && (
          <button
            onClick={handleEdit}
            className="text-xs text-red-600 font-bold hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <InterestTagSelector
            selected={editingTags}
            onChange={(tags) => {
              setEditingTags(tags);
              setError(null);
            }}
          />

          {error && (
            <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="gap-2 text-slate-500"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {selectedTags.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500 mb-3">No interests added yet</p>
              <button
                onClick={handleEdit}
                className="text-sm text-red-600 font-semibold hover:underline"
              >
                Add your first interest
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-red-600/10 text-red-600 text-sm font-medium rounded-full"
                >
                  {getTagLabel(tag)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
