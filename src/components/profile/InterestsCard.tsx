"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { Pencil, Save, X, Sparkles } from "lucide-react";
import InterestTagSelector from "@/components/profile/InterestTagSelector";

type InterestsCardProps = {
  userId?: string;
  initialTags: EventTag[];
};

function normalizeInterests(interest_tags: any): EventTag[] {
  if (!interest_tags) return [];
  if (Array.isArray(interest_tags)) {
    return interest_tags.filter(
      (tag): tag is EventTag => tag && typeof tag === "string"
    );
  }
  return [];
}

export default function InterestsCard({ userId, initialTags }: InterestsCardProps) {
  const [selectedTags, setSelectedTags] = useState<EventTag[]>(
    normalizeInterests(initialTags)
  );
  const [editingTags, setEditingTags] = useState<EventTag[]>(selectedTags);
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
    <Card className="bg-card border border-border shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Your Interests
          </CardTitle>
        </div>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            {selectedTags.length === 0 ? "Add" : "Edit"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {isEditing ? (
          <div className="space-y-5">
            {/* Editing Mode - Tag Grid */}
            <InterestTagSelector
              selected={editingTags}
              onChange={(tags) => {
                setEditingTags(tags);
                setError(null);
              }}
            />

            {/* Error Display */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              <Button
                onClick={handleCancel}
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Display Mode */
          <div>
            {selectedTags.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  No interests added yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="text-primary"
                >
                  Add your first interest
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => {
                  const category = EVENT_CATEGORIES[tag];
                  return (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="px-3 py-1 text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                    >
                      {category.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}