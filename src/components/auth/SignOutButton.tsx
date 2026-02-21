"use client";

/**
 * Sign out button component
 */

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
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
  const signOut = useAuthStore((state) => state.signOut);

  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      // Ensure users can perceive loading feedback before redirect.
      await Promise.all([
        signOut(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);

      // Route through server sign-out to clear HttpOnly auth cookies too
      window.location.replace("/auth/signout");
      return;
    } catch (err) {
      console.error("Unexpected sign out error:", err);
      // Fallback: force a full reload to clear all state
      window.location.replace("/auth/signout");
      return;
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
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <LogOut className="h-5 w-5" />
        )}
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
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="mr-2 h-4 w-4" />
      )}
      {isLoading ? "Signing out.." : "Sign out"}
    </Button>
  );
}