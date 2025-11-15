"use client";

/**
 * Sign in button component for McGill OAuth
 * TODO: Implement Supabase OAuth flow with McGill email validation
 */

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogIn } from "lucide-react";

export function SignInButton() {
  const handleSignIn = async () => {
    const supabase = createClient();

    // TODO: Implement OAuth sign in
    // 1. Configure OAuth provider (Google, etc.)
    // 2. Validate email domain (@mail.mcgill.ca or @mcgill.ca)
    // 3. Redirect to OAuth provider
    // 4. Handle callback in /auth/callback route

    // Example:
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email'
      },
    });
    if (error) {
      console.error("Error during sign in:", error);
    }
    
    
  };

  return (
    <Button onClick={handleSignIn} variant="default">
      <LogIn className="mr-2 h-4 w-4" />
      Sign In with McGill Email
    </Button>
  );
}

