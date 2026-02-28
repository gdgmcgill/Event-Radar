"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  Instagram,
  Heart,
} from "lucide-react";
import type { Club } from "@/types";

interface ClubOverviewTabProps {
  club: Club;
  memberCount: number;
  pendingInvitesCount: number | null;
  role: "owner" | "organizer";
  followerCount: number;
}

export function ClubOverviewTab({
  club,
  memberCount,
  pendingInvitesCount,
  role,
  followerCount,
}: ClubOverviewTabProps) {
  const statusConfig = {
    approved: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      label: "Approved",
      className: "text-green-600",
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      label: "Pending",
      className: "text-amber-600",
    },
    rejected: {
      icon: <XCircle className="h-5 w-5 text-red-500" />,
      label: "Rejected",
      className: "text-red-600",
    },
  };

  const status = statusConfig[club.status ?? "pending"];

  return (
    <div className="space-y-6">
      {/* Club Info Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {club.name}
              </h2>
              {club.description ? (
                <p className="text-muted-foreground">{club.description}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  No description provided.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {club.category ? (
                <Badge variant="outline">{club.category}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Uncategorized
                </Badge>
              )}

              {club.instagram_handle && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Instagram className="h-4 w-4" />
                  <span>@{club.instagram_handle}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Members stat */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Members
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{memberCount}</p>
        </div>

        {/* Followers stat */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Followers
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{followerCount}</p>
        </div>

        {/* Pending Invitations stat (owner only) */}
        {role === "owner" && pendingInvitesCount !== null && (
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium text-muted-foreground">
                Pending Invitations
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {pendingInvitesCount}
            </p>
          </div>
        )}

        {/* Club Status stat */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3 mb-2">
            {status.icon}
            <span className="text-sm font-medium text-muted-foreground">
              Club Status
            </span>
          </div>
          <p className={`text-2xl font-bold ${status.className}`}>
            {status.label}
          </p>
        </div>
      </div>
    </div>
  );
}
