"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEATURED_DURATION_PRESETS } from "@/lib/constants";
import { Star } from "lucide-react";

interface FeatureEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  existing?: {
    id: string;
    sponsor_name: string | null;
    priority: number;
    starts_at: string;
    ends_at: string;
  };
  onSubmit: () => void;
}

export function FeatureEventModal({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  existing,
  onSubmit,
}: FeatureEventModalProps) {
  const [sponsorName, setSponsorName] = useState(existing?.sponsor_name ?? "");
  const [priority, setPriority] = useState(existing?.priority ?? 0);
  const [startsAt, setStartsAt] = useState(
    existing?.starts_at
      ? new Date(existing.starts_at).toISOString().slice(0, 16)
      : ""
  );
  const [endsAt, setEndsAt] = useState(
    existing?.ends_at
      ? new Date(existing.ends_at).toISOString().slice(0, 16)
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (days: number) => {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    if (!startsAt || !endsAt) {
      setError("Start and end dates are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        event_id: eventId,
        sponsor_name: sponsorName || null,
        priority,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      };

      const url = existing
        ? `/api/admin/featured/${existing.id}`
        : "/api/admin/featured";
      const method = existing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      onSubmit();
      onOpenChange(false);
    } catch {
      setError("Failed to save featured event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {existing ? "Edit Featured Event" : "Feature Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {existing ? "Editing promotion for" : "Promoting"}{" "}
            <strong>{eventTitle}</strong>
          </p>

          <div>
            <label className="text-sm font-medium">
              Sponsor Name (optional)
            </label>
            <Input
              placeholder="e.g. Joe's Coffee"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Duration Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {FEATURED_DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset.days}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Start</label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End</label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Priority</label>
            <Input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Higher priority = appears first in the carousel
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Star className="mr-2 h-4 w-4" />
            {loading
              ? "Saving..."
              : existing
                ? "Update"
                : "Feature Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
