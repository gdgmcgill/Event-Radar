"use client";

import Link from "next/link";
import Image from "next/image";
import { Building2, Calendar, Users } from "lucide-react";

interface ClubDiscoveryCardProps {
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    follower_count: number;
    upcoming_event_count: number;
  };
}

export function ClubDiscoveryCard({ club }: ClubDiscoveryCardProps) {
  return (
    <Link href={`/clubs/${club.id}`} className="block cursor-pointer">
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden group bg-card border border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/30 to-primary/10" />

        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-2">
          <div className="w-14 h-14 rounded-full border-2 border-border/50 shadow-sm overflow-hidden bg-secondary flex items-center justify-center shrink-0">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground/50" />
            )}
          </div>

          <h4 className="text-foreground font-bold text-sm leading-tight text-center line-clamp-1 group-hover:text-primary transition-colors">
            {club.name}
          </h4>

          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              {club.follower_count}
            </span>
            {club.upcoming_event_count > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {club.upcoming_event_count}
              </span>
            )}
          </div>
        </div>

        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </Link>
  );
}
