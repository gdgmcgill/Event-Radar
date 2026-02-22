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
  className?: string;
}

export function SignInButton({ variant = "default", className }: SignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
    <Button onClick={handleSignIn} variant={variant} disabled={isLoading} className={className}>
      <LogIn className="mr-2 h-4 w-4" />
      {isLoading ? "Redirecting..." : "Sign In with McGill Email"}
    </Button>
  );
}