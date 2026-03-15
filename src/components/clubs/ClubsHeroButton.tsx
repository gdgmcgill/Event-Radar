"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Building2 } from "lucide-react";

export function ClubsHeroButton() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasClubs = useAuthStore((s) => s.hasClubs);
  const loading = useAuthStore((s) => s.loading);

  // While auth is loading, don't render anything
  if (loading) return null;

  // Show if user has clubs OR has the club_organizer role (fallback)
  const isOrganizer = user?.roles?.includes("club_organizer");
  if (!user || (!hasClubs && !isOrganizer)) return null;

  return (
    <button
      onClick={() => {
        router.push("/clubs?tab=my-clubs");
      }}
      className="px-6 md:px-8 py-4 md:py-5 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white font-bold border border-white/30 dark:border-white/15 rounded-2xl hover:bg-white/30 dark:hover:bg-white/20 transition-all flex items-center gap-3 shadow-lg"
    >
      <Building2 className="h-5 w-5" />
      My Clubs
    </button>
  );
}
