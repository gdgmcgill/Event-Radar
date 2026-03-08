"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { SignInButton } from "@/components/auth/SignInButton";
import { LogIn, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function CreateEventPageContent() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId") ?? undefined;
  const { user, loading } = useAuthStore();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-10 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 mb-6 text-sm">
          <a className="text-slate-500 hover:text-primary transition-colors" href="/">
            Dashboard
          </a>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="text-primary font-semibold">Create Event</span>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Create New Event
          </h1>
          <p className="text-slate-500 mt-2">
            Bring your campus together with a memorable experience.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="flex-1 space-y-6">
              <Skeleton className="h-10 w-48 rounded-xl" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
            <div className="lg:w-96 space-y-4">
              <Skeleton className="h-8 w-32 rounded-xl" />
              <Skeleton className="h-80 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-border p-8 max-w-lg mx-auto">
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
          <CreateEventForm clubId={clubId} />
        )}
      </main>
    </div>
  );
}

export default function CreateEventPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-screen bg-background">
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-10 py-8">
            <nav className="flex items-center gap-2 mb-6 text-sm">
              <span className="text-slate-500">Dashboard</span>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span className="text-primary font-semibold">Create Event</span>
            </nav>
            <div className="mb-8">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Create New Event
              </h1>
              <p className="text-slate-500 mt-2">
                Bring your campus together with a memorable experience.
              </p>
            </div>
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="flex-1 space-y-6">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="lg:w-96 space-y-4">
                <Skeleton className="h-8 w-32 rounded-xl" />
                <Skeleton className="h-80 w-full rounded-2xl" />
              </div>
            </div>
          </main>
        </div>
      }
    >
      <CreateEventPageContent />
    </Suspense>
  );
}
