"use client";

/**
 * My Events page - Display user's saved events
 * TODO: Implement saved events fetching, filtering, and removal
 */

import { EventGrid } from "@/components/events/EventGrid";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/auth/SignInButton";
import { Calendar } from "lucide-react";

export default function MyEventsPage() {
  // TODO: Fetch saved events for the current user
  // TODO: Implement filtering and sorting

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          My Events
        </h1>
        <p className="text-muted-foreground">
          Events you've saved for later
        </p>
      </div>

      {/* TODO: Check if user is authenticated */}
      {/* If not authenticated, show sign in prompt */}
      {/* If authenticated, show saved events */}

      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Sign in to save and view your events
        </p>
        <SignInButton />
      </div>

      {/* TODO: Replace with actual saved events */}
      {/* <EventGrid events={savedEvents} showSaveButton={true} /> */}
    </div>
  );
}

