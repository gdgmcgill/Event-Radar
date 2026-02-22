"use client";

/**
 * Sign in button component for McGill OAuth via Microsoft Azure
 */

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogIn } from "lucide-react";
import { useState } from "react";

interface SignInButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  /** Override where to redirect after login. Defaults to current page. */
  redirectAfterLogin?: string;
}

export function SignInButton({ variant = "default", redirectAfterLogin }: SignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Pass current path as `next` so the callback redirects back here
      const next = redirectAfterLogin ?? window.location.pathname;
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (next && next !== "/") {
        callbackUrl.searchParams.set("next", next);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: callbackUrl.toString(),
          scopes: "openid profile email",
        },
      });

      if (error) {
        console.error("Sign in error:", error.message);
        setIsLoading(false);
      }
      // If successful, user will be redirected - no need to reset loading
    } catch (err) {
      console.error("Unexpected sign in error:", err);
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSignIn} variant={variant} disabled={isLoading}>
      <LogIn className="mr-2 h-4 w-4" />
      {isLoading ? "Redirecting..." : "Sign In with McGill Email"}
    </Button>
  );
}