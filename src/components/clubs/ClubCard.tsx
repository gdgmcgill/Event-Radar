"use client";

import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Club } from "@/types";

interface ClubCardProps {
  club: Club;
  role: "owner" | "organizer";
  memberCount: number;
}

export function ClubCard({ club, role, memberCount }: ClubCardProps) {
  return (
    <Link href={`/my-clubs/${club.id}`}>
      <Card className="group cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          {/* Club logo */}
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={club.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <Users className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Club info */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">
              {club.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                className={
                  role === "owner"
                    ? "bg-[#561c24] text-white hover:bg-[#561c24]/90"
                    : "bg-[#c7c7a3] text-foreground hover:bg-[#c7c7a3]/90"
                }
              >
                {role === "owner" ? "Owner" : "Organizer"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
