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
import { Star, Calendar, Clock, AlertCircle } from "lucide-react";

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

function DateTimeInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  min?: string;
}) {
  // Split datetime-local into date and time parts
  const datePart = value ? value.slice(0, 10) : "";
  const timePart = value ? value.slice(11, 16) : "";

  const update = (date: string, time: string) => {
    if (date && time) {
      onChange(`${date}T${time}`);
    } else if (date) {
      onChange(`${date}T00:00`);
    } else {
      onChange("");
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={datePart}
            min={min ? min.slice(0, 10) : undefined}
            onChange={(e) => update(e.target.value, timePart || "00:00")}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
        <div className="relative w-[120px]">
          <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="time"
            value={timePart}
            onChange={(e) => update(datePart, e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
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
  const [priority, setPriority] = useState(existing?.priority ?? 1);
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

  const now = new Date().toISOString().slice(0, 16);

  const applyPreset = (days: number) => {
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setStartsAt(start.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    if (!startsAt || !endsAt) {
      setError("Start and end dates are required");
      return;
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("End date must be after start date");
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
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            {existing ? "Edit Featured Event" : "Feature Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Event being featured */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground mb-0.5">
              {existing ? "Editing promotion for" : "Promoting"}
            </p>
            <p className="font-semibold text-sm text-foreground">{eventTitle}</p>
          </div>

          {/* Sponsor */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Sponsor Name
            </label>
            <Input
              placeholder="e.g. Joe's Coffee (optional)"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Displayed as &ldquo;Sponsored by ...&rdquo; if provided
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Priority
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPriority(level)}
                  className={`h-9 w-9 rounded-lg text-sm font-semibold transition-all ${
                    priority === level
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Higher priority = appears first in the featured carousel
            </p>
          </div>

          {/* Duration presets */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Quick Duration
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FEATURED_DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-foreground hover:bg-accent transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date/time pickers */}
          <div className="grid grid-cols-1 gap-4">
            <DateTimeInput
              label="Start Date & Time"
              value={startsAt}
              onChange={setStartsAt}
              min={now}
            />
            <DateTimeInput
              label="End Date & Time"
              value={endsAt}
              onChange={setEndsAt}
              min={startsAt || now}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
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
