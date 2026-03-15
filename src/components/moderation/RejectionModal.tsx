"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REJECTION_CATEGORIES, type RejectionCategory } from "@/types";
import { XCircle, Loader2 } from "lucide-react";

interface RejectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: "event" | "club";
  onSubmit: (category: RejectionCategory, message: string) => Promise<void>;
}

export function RejectionModal({
  open,
  onOpenChange,
  itemName,
  itemType,
  onSubmit,
}: RejectionModalProps) {
  const [category, setCategory] = useState<RejectionCategory | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category || !message.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(category as RejectionCategory, message.trim());
      setCategory("");
      setMessage("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = category !== "" && message.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <XCircle className="h-5 w-5 text-red-500" />
            Reject {itemType === "event" ? "Event" : "Club"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Rejecting <span className="font-medium text-zinc-700 dark:text-zinc-300">&quot;{itemName}&quot;</span>.
            Please provide a reason so the organizer understands what needs to change.
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RejectionCategory)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Select a reason...</option>
              {Object.entries(REJECTION_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Details <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what needs to change..."
              rows={4}
              className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              This message will be visible to the organizer. Keep it under 500 characters.
            </p>
          </div>
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
            disabled={!isValid || submitting}
            className="inline-flex items-center gap-1.5 justify-center h-9 px-4 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
