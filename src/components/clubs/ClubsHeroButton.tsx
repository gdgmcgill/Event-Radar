"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export function ClubsHeroButton() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasClubs = useAuthStore((s) => s.hasClubs);

  // Not authenticated or no clubs → hide the button (the CTA section handles registration)
  if (!user || !hasClubs) return null;

  return (
    <button
      onClick={() => {
        router.push("/clubs?tab=my-clubs#clubs-feed", { scroll: false });
        // Scroll to the tabs area after a tick so the DOM updates
        setTimeout(() => {
          document.getElementById("clubs-feed")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }}
      className="px-6 md:px-8 py-4 md:py-5 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white font-bold border border-white/30 dark:border-white/15 rounded-2xl hover:bg-white/30 dark:hover:bg-white/20 transition-all flex items-center gap-3 shadow-lg"
    >
      My Clubs
    </button>
  );
}
