"use client";
import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import type { ListingReportInput } from "@/contracts/intake";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormStatus, Honeypot, NETWORK_MESSAGE, RATE_MESSAGE, inputStyle, optional, sendIntake } from "./fields";

type Reason = ListingReportInput["reason"];
const REASONS: ReadonlyArray<readonly [Reason, string]> = [
  ["wrong_date", "Wrong date or time"],
  ["dead_link", "Broken link"],
  ["scam", "Looks like a scam"],
  ["duplicate", "Duplicate listing"],
  ["other", "Something else"],
];

/** "Report a problem" for a public listing (M3 P1-09). The dialog (Radix)
 * traps focus, closes on Escape and returns focus to the trigger. Anonymous
 * reports are allowed; nothing about the reporter is shown back. */
export function ReportListingButton({ kind, id }: { kind: ListingReportInput["kind"]; id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && sent) {
      setSent(false);
      setReason("");
      setDetails("");
    }
    if (!next) setStatus(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (!reason) {
      setStatus("Choose what's wrong with this listing.");
      return;
    }
    setSending(true);
    setStatus(null);
    const body: ListingReportInput = { kind, id, reason, details: optional(details), website: website ? website : undefined };
    try {
      const outcome = await sendIntake("/api/listing-reports", body);
      if (outcome.kind === "sent") setSent(true);
      else if (outcome.kind === "rate") setStatus(RATE_MESSAGE);
      else if (outcome.kind === "missing") setStatus("This listing is no longer available.");
      else setStatus(outcome.message);
    } catch {
      setStatus(NETWORK_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:underline">
          <Flag size={14} aria-hidden="true" />
          Report a problem
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a problem with this listing</DialogTitle>
          <DialogDescription>A person reviews every report. You don&apos;t need an account.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <p role="status" className="text-sm">
            Thanks — we&apos;ll take a look.
          </p>
        ) : (
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">What&apos;s wrong?</legend>
              {REASONS.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-1.5">
              <label htmlFor="report-details" className="text-sm font-medium">
                Details (optional)
              </label>
              <textarea id="report-details" value={details} maxLength={1000} rows={3} className={inputStyle} onChange={(event) => setDetails(event.target.value)} />
            </div>
            <Honeypot value={website} onChange={setWebsite} />
            {status && <FormStatus>{status}</FormStatus>}
            <button type="submit" disabled={sending} className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
              {sending ? "Sending…" : "Send report"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
