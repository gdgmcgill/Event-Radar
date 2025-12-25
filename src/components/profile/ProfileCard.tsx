import * as React from "react";
import Image from "next/image";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProfileData = {
  id?: string;
  email?: string;
  name?: string | null;
  avatar_url?: string | null;
  preferences?: any;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

function normalizeInterests(preferences: any): string[] {
  if (!preferences) return [];
  if (Array.isArray(preferences)) return preferences.map(String);
  if (typeof preferences === "string") {
    const trimmed = preferences.trim();
    // try JSON
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {
      // not JSON - fallthrough
    }
    // comma separated
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    // single string
    return [trimmed];
  }
  if (typeof preferences === "object") {
    // common shape: { interests: [...] }
    if (Array.isArray(preferences.interests)) return preferences.interests.map(String);
    // fallback to keys
    return Object.values(preferences).map(String).filter(Boolean);
  }
  return [];
}

export default function ProfileCard({ displayData }: { displayData: ProfileData }) {
  const interests = normalizeInterests(displayData.preferences ?? displayData.interests ?? null);

  const initials = (displayData.name || displayData.email || "").split(" ").map((s) => s[0]).slice(0,2).join("").toUpperCase();

  return (
    <Card className="bg-card rounded-2xl border border-border shadow-md overflow-hidden">
      <CardHeader className="flex items-center gap-4 p-5">
        {displayData.avatar_url ? (
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
            <Image src={displayData.avatar_url} alt={displayData.name ?? "avatar"} width={64} height={64} className="object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center text-lg font-medium text-muted-foreground">
            {initials || "U"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <CardTitle className="text-xl">{displayData.name ?? displayData.email ?? "User"}</CardTitle>
          <p className="text-sm text-muted-foreground truncate">{displayData.email}</p>
        </div>
      </CardHeader>

      <div className="px-5 pb-5 pt-0 flex flex-wrap gap-2">
        {interests.length === 0 ? (
          <span className="text-sm text-muted-foreground">No interests added yet.</span>
        ) : (
          interests.map((tag, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="px-2.5 py-0.5 text-xs font-medium bg-secondary/50 text-secondary-foreground hover:bg-secondary"
            >
              {tag}
            </Badge>
          ))
        )}
      </div>
    </Card>
  );
}
