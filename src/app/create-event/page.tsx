"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { SignInButton } from "@/components/auth/SignInButton";
import { Plus, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreateEventPage() {
  const { user, loading } = useAuthStore();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page Header */}
      <section className="w-full pt-12 pb-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Create Event
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Submit your event to be shared with the McGill community. Events require admin approval before appearing on the platform.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-border p-8">
            <div className="rounded-full bg-primary/10 p-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Sign in to create events</h3>
            <p className="text-muted-foreground max-w-md">
              You need to be signed in with your McGill account to submit events.
            </p>
            <SignInButton variant="default" />
          </div>
        ) : (
          <CreateEventForm />
        )}
      </div>
    </div>
  );
}
