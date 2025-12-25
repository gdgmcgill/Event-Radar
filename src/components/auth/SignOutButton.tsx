"use client";

/**
 * Sign out button component
 */

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  /** Compact mode shows only icon */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Tooltip text */
  title?: string;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function SignOutButton({
  compact = false,
  className,
  title,
  variant = "outline",
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Attempt sign out with timeout to prevent hanging
      const signOutPromise = supabase.auth.signOut();
      const result = await Promise.race([
        signOutPromise,
        new Promise<{ error: null }>((resolve) =>
          setTimeout(() => resolve({ error: null }), 3000)
        ),
      ]);

      if ("error" in result && result.error) {
        console.error("Sign out error:", result.error);
      }

      // Navigate to home
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Unexpected sign out error:", err);
      // Fallback: force a full reload
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  };

  if (compact) {
    return (
      <Button
        onClick={handleSignOut}
        variant="ghost"
        size="icon"
        disabled={isLoading}
        className={cn("text-muted-foreground hover:text-destructive", className)}
        title={title ?? "Sign out"}
      >
        <LogOut className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSignOut}
      variant={variant}
      disabled={isLoading}
      className={className}
      title={title}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isLoading ? "Signing out..." : "Sign out"}
    </Button>
  );
}