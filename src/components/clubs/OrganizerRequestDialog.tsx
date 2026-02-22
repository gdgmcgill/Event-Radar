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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OrganizerRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  clubName: string;
  onSuccess?: () => void;
}

export function OrganizerRequestDialog({
  open,
  onOpenChange,
  clubId,
  clubName,
  onSuccess,
}: OrganizerRequestDialogProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/organizer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ club_id: clubId, message: message || null }),
      });

      if (res.status === 409) {
        setError("You already have a pending request for this club.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit request");
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage("");
      setError(null);
      setSuccess(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Request Organizer Access</DialogTitle>
          <DialogDescription>
            Request to become an organizer for {clubName}. An admin will review
            your request.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Your request has been submitted. You will gain access once an admin
              approves it.
            </p>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="request-message"
                className="text-sm font-semibold text-foreground"
              >
                Message{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <textarea
                id="request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell the admins why you should be an organizer for this club..."
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
