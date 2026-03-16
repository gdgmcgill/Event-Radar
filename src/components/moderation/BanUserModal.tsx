"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Ban, Loader2 } from "lucide-react";

interface BanUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onSubmit: (data: {
    reason: string;
    duration_days?: number;
    suspend_content: boolean;
  }) => Promise<void>;
}

const DURATION_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "Permanent", value: undefined },
];

export function BanUserModal({
  open,
  onOpenChange,
  userName,
  onSubmit,
}: BanUserModalProps) {
  const [durationDays, setDurationDays] = useState<number | undefined>(
    undefined
  );
  const [reason, setReason] = useState("");
  const [suspendContent, setSuspendContent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        reason: reason.trim(),
        duration_days: durationDays,
        suspend_content: suspendContent,
      });
      setReason("");
      setDurationDays(undefined);
      setSuspendContent(false);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Ban className="h-5 w-5 text-red-500" />
            Ban User
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Banning{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {userName}
            </span>{" "}
            will prevent them from accessing the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Duration <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = durationDays === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setDurationDays(opt.value)}
                    className={`flex-1 h-9 text-sm font-medium rounded-md border transition-colors ${
                      isSelected
                        ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-700"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this user is being banned..."
              rows={4}
              className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={suspendContent}
              onChange={(e) => setSuspendContent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-red-500 focus:ring-red-500/20 dark:border-zinc-600 dark:bg-zinc-950"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Also suspend all of this user&apos;s approved events and clubs
            </span>
          </label>
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
              <Ban className="h-4 w-4" />
            )}
            Ban User
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
