"use client";

import { useCallback } from "react";
import { Share2 } from "lucide-react";

interface ClubShareButtonProps {
  clubName: string;
  clubDescription: string | null;
  clubId: string;
}

export function ClubShareButton({ clubName, clubDescription, clubId }: ClubShareButtonProps) {
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/clubs/${clubId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: clubName,
          text: clubDescription ?? `Check out ${clubName} on UNI-VERSE`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        // Could add a toast here but keeping it simple
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.warn("Share failed:", err);
      }
    }
  }, [clubName, clubDescription, clubId]);

  return (
    <button
      onClick={handleShare}
      aria-label="Share"
      className="flex items-center justify-center w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full transition-all duration-300 cursor-pointer"
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
