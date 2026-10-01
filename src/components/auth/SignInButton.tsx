"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { LogIn } from "lucide-react";

interface SignInButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
  redirectAfterLogin?: string;
  compact?: boolean;
}

export function SignInButton({ variant = "default", className, redirectAfterLogin, compact }: SignInButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const callback = () => {
    const url = new URL("/auth/callback", window.location.origin);
    const next = redirectAfterLogin ?? `${window.location.pathname}${window.location.search}`;
    if (next && next !== "/") url.searchParams.set("next", next);
    return url;
  };
  const google = async () => {
    setBusy(true); setError("");
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback().toString(), queryParams: { prompt: "select_account" } } });
      if (error) throw error;
    } catch { setError("Google sign-in is unavailable. Try an email code."); setBusy(false); }
  };
  const emailCode = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const supabase = createClient();
      const address = email.trim().toLowerCase();
      if (!sent) {
        const { error } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: callback().toString() } });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: address, token: token.trim(), type: "email" });
        if (error) throw error;
        const destination = callback(); destination.searchParams.set("verified", "1");
        window.location.assign(destination.toString());
      }
    } catch { setError(sent ? "That code is invalid or expired. Try again or request a new code." : "We couldn’t send a code. Please try again shortly."); }
    finally { setBusy(false); }
  };
  return <>
    <Button onClick={() => setOpen(true)} variant={variant} className={className} aria-label="Sign In">
      <LogIn className={compact ? "h-4 w-4 sm:mr-2" : "mr-2 h-4 w-4"} />
      <span className={compact ? "hidden sm:inline" : undefined}>Sign In</span>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Welcome to UNI-VERSE</DialogTitle><DialogDescription>Use any email you can verify. Your university is optional for browsing.</DialogDescription></DialogHeader>
        <Button onClick={google} disabled={busy} variant="outline">Continue with Google</Button>
        <div className="text-center text-sm text-muted-foreground">or use an email code</div>
        <form onSubmit={emailCode} className="space-y-4">
          <div className="space-y-2"><label htmlFor="signin-email">Email address</label><Input id="signin-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy || sent} maxLength={254} /></div>
          {sent && <div className="space-y-2"><p className="text-sm text-muted-foreground">Check your inbox for your sign-in code.</p><label htmlFor="signin-code">Email code</label><Input id="signin-code" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e => setToken(e.target.value)} required minLength={6} maxLength={10} disabled={busy} /></div>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : sent ? "Verify and continue" : "Send sign-in code"}</Button>
          {sent && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSent(false); setToken(""); setError(""); }}>Use another email or request a new code</Button>}
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
