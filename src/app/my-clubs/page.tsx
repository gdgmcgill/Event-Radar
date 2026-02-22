"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, CalendarCheck, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Club } from "@/types";

interface ClubWithStats {
  membership_id: string;
  membership_role: string;
  club: Club;
  stats: {
    upcoming_events: number;
    pending_events: number;
  };
}

export default function MyClubsPage() {
  const [clubs, setClubs] = useState<ClubWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClubs() {
      try {
        const res = await fetch("/api/my-clubs");
        if (!res.ok) throw new Error("Failed to fetch clubs");
        const data = await res.json();
        setClubs(data.clubs ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clubs");
      } finally {
        setLoading(false);
      }
    }
    fetchClubs();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            My Clubs
          </h1>
          <p className="text-muted-foreground">
            Manage events for clubs you organize
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          My Clubs
        </h1>
        <p className="text-muted-foreground">
          Manage events for clubs you organize
        </p>
      </div>

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {!error && clubs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mb-6" />
          <p className="text-xl font-semibold mb-2 text-foreground">
            No clubs yet
          </p>
          <p className="text-base text-muted-foreground max-w-md mb-6">
            You are not an organizer for any clubs. Browse clubs to request
            organizer access.
          </p>
          <Link href="/clubs">
            <Button>Browse Clubs</Button>
          </Link>
        </div>
      )}

      {!error && clubs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((item) => (
            <Link key={item.membership_id} href={`/my-clubs/${item.club.id}`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-border/60 hover:border-primary/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {item.club.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.club.logo_url}
                        alt={item.club.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {item.club.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {item.membership_role}
                      </Badge>
                    </div>
                  </div>
                </div>

                {item.club.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {item.club.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CalendarCheck className="h-4 w-4 text-green-500" />
                    <span>
                      {item.stats.upcoming_events} upcoming
                    </span>
                  </div>
                  {item.stats.pending_events > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>
                        {item.stats.pending_events} pending
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
