"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Instagram,
  Globe,
  Share2,
  ExternalLink,
  Check,
} from "lucide-react";

interface ClubHeroSocialLinksProps {
  clubName: string;
  clubDescription: string | null;
  clubId: string;
  instagramHandle: string | null;
  twitterUrl: string | null;
  discordUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}

// Simple SVG icons for platforms lucide doesn't cover well
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ClubHeroSocialLinks({
  clubName,
  clubDescription,
  clubId,
  instagramHandle,
  twitterUrl,
  discordUrl,
  linkedinUrl,
  websiteUrl,
}: ClubHeroSocialLinksProps) {
  const [copied, setCopied] = useState(false);

  const hasAnyLink = instagramHandle || twitterUrl || discordUrl || linkedinUrl || websiteUrl;

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/clubs/${clubId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: clubName,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        // Fallback: try clipboard
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          console.warn("Share failed:", err);
        }
      }
    }
  }, [clubName, clubDescription, clubId]);

  const linkClass =
    "flex items-center justify-center w-9 h-9 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-all duration-200";

  return (
    <div className="flex items-center gap-1 bg-black/30 backdrop-blur-xl border border-white/15 rounded-full px-2 py-1.5 shadow-lg shadow-black/20">
      {/* Social Links */}
      {instagramHandle && (
        <Link
          href={`https://instagram.com/${instagramHandle.replace("@", "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="Instagram"
        >
          <Instagram className="h-4 w-4" />
        </Link>
      )}
      {twitterUrl && (
        <Link
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="X / Twitter"
        >
          <XIcon className="h-3.5 w-3.5" />
        </Link>
      )}
      {discordUrl && (
        <Link
          href={discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="Discord"
        >
          <DiscordIcon className="h-4 w-4" />
        </Link>
      )}
      {linkedinUrl && (
        <Link
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="LinkedIn"
        >
          <LinkedInIcon className="h-3.5 w-3.5" />
        </Link>
      )}
      {websiteUrl && (
        <Link
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="Website"
        >
          <Globe className="h-4 w-4" />
        </Link>
      )}

      {/* Divider — only if there are social links */}
      {hasAnyLink && (
        <div className="w-px h-5 bg-white/20 mx-0.5" />
      )}

      {/* Share Button */}
      <button
        onClick={handleShare}
        className={`${linkClass} relative cursor-pointer`}
        aria-label={copied ? "Link copied!" : "Share club"}
        title={copied ? "Link copied!" : "Share"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
