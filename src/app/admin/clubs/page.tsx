"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface OrganizerInfo {
  name: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<OrganizerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchClubs() {
      const res = await fetch("/api/admin/clubs");
      if (res.ok) {
        const data = await res.json();
        setClubs(data.clubs ?? []);
      }
      setLoading(false);
    }
    fetchClubs();
  }, []);

  const filtered = clubs.filter((c) => {
    if (!searchQuery) return true;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Clubs / Organizers</h2>
        <p className="text-sm text-muted-foreground">
          {clubs.length} organizers found
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search organizers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No organizers found.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organizer List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((club) => (
                <div
                  key={club.name}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <p className="font-medium text-sm">{club.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {club.total} event{club.total !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {club.approved > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      >
                        {club.approved} approved
                      </Badge>
                    )}
                    {club.pending > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      >
                        {club.pending} pending
                      </Badge>
                    )}
                    {club.rejected > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      >
                        {club.rejected} rejected
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
