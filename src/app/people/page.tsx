"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import FollowUserButton from "@/components/users/FollowUserButton";

type UserResult = {
  id: string;
  name: string;
  avatar_url: string | null;
  faculty: string | null;
  year: string | null;
  isFollowing: boolean;
  isFriend: boolean;
};

export default function PeoplePage() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [friends, setFriends] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Load friends on mount
  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      try {
        const res = await fetch("/api/users/me/friends");
        if (!res.ok) return;
        const data = await res.json();
        setFriends(
          (data.friends ?? []).map((f: any) => ({
            ...f,
            isFollowing: true,
            isFriend: true,
          }))
        );
      } catch {
        // Non-critical
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [user]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.users ?? []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Find People</h1>
        <p className="text-muted-foreground">Sign in to search for people and add friends.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Find People</h1>
        <p className="text-muted-foreground">
          Search for students and add them as friends.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Search Results */}
      {query.trim().length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Results
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!loading && results.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No users found for &quot;{query}&quot;
              </p>
            ) : (
              <div className="space-y-2">
                {results.map((person) => (
                  <UserRow key={person.id} person={person} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      {query.trim().length < 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Your Friends ({friends.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFriends ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No friends yet. Search for people above to follow them — when they follow you back, you become friends.
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((person) => (
                  <UserRow key={person.id} person={person} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserRow({ person }: { person: UserResult }) {
  const initials = (person.name ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
      <Link href={`/users/${person.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        {person.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.avatar_url}
            alt={person.name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{person.name ?? "User"}</p>
          <div className="flex gap-1.5">
            {person.year && (
              <span className="text-xs text-muted-foreground">{person.year}</span>
            )}
            {person.faculty && (
              <span className="text-xs text-muted-foreground">
                {person.year ? "·" : ""} {person.faculty}
              </span>
            )}
          </div>
        </div>
      </Link>
      {person.isFriend && (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
          Friends
        </Badge>
      )}
      <FollowUserButton
        userId={person.id}
        initialFollowing={person.isFollowing}
        initialIsFriend={person.isFriend}
      />
    </div>
  );
}
