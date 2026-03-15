"use client";

import { type ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reusable card-wrapper class for scroll row items */
export const CARD_WRAPPER_CLASS =
  "min-w-[260px] sm:min-w-[280px] md:min-w-[320px] w-[calc(85vw-2rem)] sm:w-[300px] md:w-[340px] lg:w-[320px] flex-shrink-0";

/** Consistent padding for section headers and scroll rows */
export const SECTION_PADDING = "px-6 md:px-10 lg:px-12";

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  /** Count shown after the title (e.g. 5) */
  count?: number;
  /** Label for the count (default: "event") — pluralized automatically */
  countLabel?: string;
  /** Icon element rendered before the title */
  icon?: ReactNode;
  /** Show a live pulsing dot after the title */
  liveIndicator?: boolean;
  /** Right-side action (e.g. "See All" button, refresh button) */
  action?: ReactNode;
}

export function SectionHeader({
  title,
  count,
  countLabel = "event",
  icon,
  liveIndicator,
  action,
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${SECTION_PADDING} mb-5`}>
      <h3 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
        {icon}
        {title}
        {liveIndicator && (
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
        )}
        {count !== undefined && count > 0 && (
          <span className="text-sm font-medium text-muted-foreground">
            {count} {countLabel}{count !== 1 ? "s" : ""}
          </span>
        )}
      </h3>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionSkeleton — loading placeholder (3 pulse cards)
// ---------------------------------------------------------------------------

interface SectionSkeletonProps {
  /** Header content rendered above the skeleton cards */
  header: ReactNode;
}

export function SectionSkeleton({ header }: SectionSkeletonProps) {
  return (
    <section>
      {header}
      <div className={`flex ${SECTION_PADDING} gap-3`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`${CARD_WRAPPER_CLASS} aspect-[16/10] rounded-3xl bg-muted animate-pulse`}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SectionError — error state with retry button
// ---------------------------------------------------------------------------

interface SectionErrorProps {
  message: string;
  onRetry: () => void;
}

export function SectionError({ message, onRetry }: SectionErrorProps) {
  return (
    <section className={SECTION_PADDING}>
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{message}</p>
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="gap-2 cursor-pointer"
        >
          <RefreshCcw className="h-3 w-3" />
          Try Again
        </Button>
      </div>
    </section>
  );
}
