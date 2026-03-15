"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";

interface AppealFormProps {
  itemType: "event" | "club";
  itemId: string;
  onSuccess: () => void;
}

export function AppealForm({ itemType, itemId, onSuccess }: AppealFormProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const endpoint =
        itemType === "event"
          ? `/api/events/${itemId}/appeal`
          : `/api/clubs/${itemId}/appeal`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit appeal");
        return;
      }

      setMessage("");
      onSuccess();
    } catch {
      setError("Failed to submit appeal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-orange-500" />
        Submit an Appeal
      </h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Explain what you&apos;ve changed and why this {itemType} should be reconsidered.
      </p>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe the changes you've made..."
        rows={3}
        className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 resize-none"
      />
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitting}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
          Submit Appeal
        </button>
      </div>
    </div>
  );
}
