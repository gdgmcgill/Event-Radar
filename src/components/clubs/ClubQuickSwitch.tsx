"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMyClubs } from "@/hooks/useClubs";
import type { Club } from "@/types";

interface MyClubEntry {
  id: string;
  role: "owner" | "organizer";
  club: Club;
  memberCount: number;
}

interface ClubQuickSwitchProps {
  currentClubId: string;
  currentClubName: string;
  currentClubLogo: string | null;
}

export function ClubQuickSwitch({
  currentClubId,
  currentClubName,
  currentClubLogo,
}: ClubQuickSwitchProps) {
  const router = useRouter();
  const { data } = useMyClubs();

  const clubs: MyClubEntry[] = data?.clubs ?? [];

  // If only 1 club, just show the name (no dropdown)
  if (clubs.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <ClubLogo url={currentClubLogo} name={currentClubName} size={20} />
        <span className="font-semibold text-foreground">{currentClubName}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <ClubLogo url={currentClubLogo} name={currentClubName} size={20} />
          <span className="max-w-[160px] truncate font-semibold">
            {currentClubName}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {clubs.map((entry) => (
          <DropdownMenuItem
            key={entry.club.id}
            className={
              entry.club.id === currentClubId ? "bg-accent" : undefined
            }
            onClick={() => router.push(`/my-clubs/${entry.club.id}`)}
          >
            <ClubLogo
              url={entry.club.logo_url}
              name={entry.club.name}
              size={16}
            />
            <span className="ml-2 truncate">{entry.club.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClubLogo({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  size: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded bg-muted"
      style={{ width: size, height: size }}
    >
      <Building2 className="text-muted-foreground" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  );
}
