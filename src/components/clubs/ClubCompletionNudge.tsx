"use client";

import { useState } from "react";
import { CheckCircle, Circle, X } from "lucide-react";
import type { Club } from "@/types";

interface ClubCompletionNudgeProps {
  club: Club;
  memberCount: number;
  eventCount: number;
  pendingInviteCount: number;
  onNavigate: (tab: string) => void;
}

interface ChecklistItem {
  key: string;
  complete: boolean;
  label: string;
  tab: string;
}

export default function ClubCompletionNudge({
  club,
  memberCount,
  eventCount,
  pendingInviteCount,
  onNavigate,
}: ClubCompletionNudgeProps) {
  const [dismissed, setDismissed] = useState(false);

  const items: ChecklistItem[] = [
    {
      key: "logo",
      complete: club.logo_url !== null,
      label: "Add a logo — clubs with logos get 3× more followers",
      tab: "settings",
    },
    {
      key: "description",
      complete: !!(club.description && club.description.length > 50),
      label:
        "Write a description — help students understand what you're about",
      tab: "settings",
    },
    {
      key: "instagram",
      complete: club.instagram_handle !== null,
      label: "Link your Instagram — let members find you on social",
      tab: "settings",
    },
    {
      key: "coorganizer",
      complete: memberCount > 1 || pendingInviteCount > 0,
      label:
        "Invite a co-organizer — teams that share the load post 2× more events",
      tab: "members",
    },
    {
      key: "event",
      complete: eventCount > 0,
      label: "Create your first event — start building your audience",
      tab: "events",
    },
  ];

  const completedCount = items.filter((i) => i.complete).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  if (dismissed || percentage === 100) return null;

  return (
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6 relative">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss completion nudge"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Headline */}
      <h3 className="text-lg font-semibold text-foreground">
        Your club is {percentage}% complete
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        Members who see a logo, description, and social link are 3× more likely
        to follow.
      </p>

      {/* Progress bar */}
      <div className="mt-4 h-2 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist */}
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.key}>
            {item.complete ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm line-through text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ) : (
              <button
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-2 text-left group w-full"
              >
                <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
