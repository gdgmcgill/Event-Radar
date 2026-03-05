"use client";

import Image from "next/image";
import { Building2, ExternalLink, Users, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Club } from "@/types";

interface ClubOverviewTabProps {
  club: Club;
  followerCount: number;
  memberCount: number;
  onEditClick?: () => void;
}

export function ClubOverviewTab({
  club,
  followerCount,
  memberCount,
  onEditClick,
}: ClubOverviewTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Logo */}
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
              {club.logo_url ? (
                <Image
                  src={club.logo_url}
                  alt={club.name}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-xl object-cover"
                />
              ) : (
                <Building2 className="h-10 w-10 text-muted-foreground" />
              )}
            </div>

            {/* Details */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold">{club.name}</h2>

              {club.description && (
                <p className="mt-2 text-muted-foreground">{club.description}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {club.category && (
                  <Badge variant="secondary">{club.category}</Badge>
                )}
                {club.instagram_handle && (
                  <a
                    href={`https://instagram.com/${club.instagram_handle.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    @{club.instagram_handle.replace(/^@/, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center justify-center gap-6 sm:justify-start">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span>
                    {followerCount}{" "}
                    {followerCount === 1 ? "follower" : "followers"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
              </div>

              {onEditClick && (
                <button
                  onClick={onEditClick}
                  className="mt-4 text-sm font-medium text-primary hover:underline"
                >
                  Edit settings
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
