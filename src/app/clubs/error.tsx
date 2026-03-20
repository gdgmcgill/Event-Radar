"use client";

import Link from "next/link";
import { Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClubsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        We couldn&apos;t load the clubs page. This is usually temporary — please
        try again.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/clubs">Back to Clubs</Link>
        </Button>
      </div>
    </div>
  );
}
