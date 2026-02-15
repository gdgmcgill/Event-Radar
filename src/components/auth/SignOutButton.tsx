"use client";

/**
 * Sign out button component
 */

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
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
  const signOut = useAuthStore((state) => state.signOut);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      // Use the auth store's signOut which clears both the Supabase
      // session and the store state atomically
      await signOut();

      // Navigate to home and refresh server state
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Unexpected sign out error:", err);
      // Fallback: force a full reload to clear all state
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