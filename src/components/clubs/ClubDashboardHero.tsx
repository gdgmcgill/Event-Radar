"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClubInitials } from "@/components/clubs/ClubInitials";
import type { Club } from "@/types";

interface ClubDashboardHeroProps {
  club: Club;
  followerCount: number;
  memberCount: number;
  eventCount: number;
  onEditBanner?: () => void;
}

function StatusBadge({ status }: { status: Club["status"] }) {
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10">
        Approved
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/10">
        Pending
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/10">
        Rejected
      </Badge>
    );
  }
  return null;
}

export function ClubDashboardHero({
  club,
  followerCount,
  memberCount,
  eventCount,
  onEditBanner,
}: ClubDashboardHeroProps) {
  return (
    <div className="w-full">
      {/* ─── Banner ─── */}
      <div className="relative w-full h-[100px] lg:h-[160px]">
        {/* Background: image or gradient fallback */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          {club.banner_url ? (
            <Image
              src={club.banner_url}
              alt={`${club.name} banner`}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/80 to-slate-800 dark:from-slate-950 dark:via-primary/40 dark:to-slate-900" />
          )}
        </div>

        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20 rounded-xl" />

        {/* Bottom fade into background */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent rounded-b-xl" />

        {/* Pending approval overlay */}
        {club.status === "pending" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl z-10">
            <span className="bg-amber-500/90 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Pending Approval
            </span>
          </div>
        )}

        {/* Edit Banner button — top-right */}
        {onEditBanner && (
          <button
            onClick={onEditBanner}
            className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200"
          >
            <Camera className="h-3 w-3" />
            Edit Banner
          </button>
        )}
      </div>

      {/* ─── Profile Section (overlaps banner) ─── */}
      <div className="relative z-10 -mt-10 px-1">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Club Logo */}
          <div className="w-20 h-20 lg:w-20 lg:h-20 shrink-0 rounded-2xl bg-card border-[3px] border-background shadow-lg overflow-hidden flex items-center justify-center">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <ClubInitials name={club.name} className="w-full h-full rounded-2xl text-2xl" />
            )}
          </div>

          {/* Name + Badges + Stats */}
          <div className="flex-1 min-w-0 pb-1">
            {/* Name row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-foreground tracking-tight truncate">
                {club.name}
              </h2>
              <StatusBadge status={club.status} />
              {club.category && (
                <Badge variant="secondary" className="text-xs">
                  {club.category}
                </Badge>
              )}
            </div>

            {/* Stats inline */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{followerCount}</span>{" "}
                Followers
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="font-semibold text-foreground">{memberCount}</span>{" "}
                Members
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="font-semibold text-foreground">{eventCount}</span>{" "}
                Events
              </span>
            </div>
          </div>

          {/* Action buttons — desktop only */}
          <div className="hidden sm:flex items-center gap-2 pb-1 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clubs/${club.id}`} target="_blank" rel="noopener noreferrer">
                View Public Page
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/create-event?clubId=${club.id}`}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create Event
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
