// src/components/events/ReportEventDialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import { Flag, Loader2 } from "lucide-react";

interface ReportEventDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}

export function ReportEventDialog({
  eventId,
  open,
  onOpenChange,
  onReported,
}: ReportEventDialogProps) {
  const [category, setCategory] = useState<RejectionCategory | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setCategory("");
      setMessage("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!category) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        setError("You have already reported this event.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit report.");
        return;
      }

      onReported();
      onOpenChange(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Flag className="h-5 w-5 text-red-500" />
            Report Event
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Why are you reporting this event?
          </p>

          {/* Category selection */}
          <div className="space-y-2">
            {(Object.entries(REJECTION_CATEGORIES) as [RejectionCategory, string][]).map(
              ([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    category === key
                      ? "border-red-500/50 bg-red-500/5 dark:bg-red-500/10"
                      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={key}
                    checked={category === key}
                    onChange={() => setCategory(key)}
                    className="accent-red-500"
                  />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {label}
                  </span>
                </label>
              )
            )}
          </div>

          {/* Optional message */}
          <div className="space-y-1.5">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Additional details (optional)"
              rows={3}
              className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-right">
              {message.length}/500
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!category || submitting}
            className="inline-flex items-center gap-1.5 justify-center h-9 px-4 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            Submit Report
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
