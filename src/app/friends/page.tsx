"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Users,
  Loader2,
  UserPlus,
  UserCheck,
  X,
  Calendar,
  Building2,
  Sparkles,
  UserX,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { FriendsActivitySection } from "@/components/events/FriendsActivitySection";
import { FriendsOrganizingSection } from "@/components/events/FriendsOrganizingSection";

const RotatingEarth = dynamic(
  () => import("@/components/ui/wireframe-dotted-globe"),
  { ssr: false }
);

/* ─── Types ─────────────────────────────────────────────────────────── */

type UserResult = {
  id: string;
  name: string;
  avatar_url: string | null;
  faculty: string | null;
  year: string | null;
  isFollowing: boolean;
  isFriend: boolean;
};

type Suggestion = UserResult & {
  reason: string;
  reason_type: "club" | "event" | "tags" | "faculty";
};

type Tab = "suggestions" | "friends" | "requests";

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function FriendsPage() {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<Tab>("suggestions");
  const [query, setQuery] = useState("");

  // Data
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [friends, setFriends] = useState<UserResult[]>([]);
  const [requests, setRequests] = useState<UserResult[]>([]);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);

  // Loading
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Fetch suggestions
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/users/me/suggestions");
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(
          (data.suggestions ?? []).map((s: any) => ({
            ...s,
            isFollowing: false,
            isFriend: false,
          }))
        );
      } catch {
        /* non-critical */
      } finally {
        setLoadingSuggestions(false);
      }
    })();
  }, [user]);

  // Fetch friends
  useEffect(() => {
    if (!user) return;
    (async () => {
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
        /* non-critical */
      } finally {
        setLoadingFriends(false);
      }
    })();
  }, [user]);

  // Fetch requests
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/users/me/requests");
        if (!res.ok) return;
        const data = await res.json();
        setRequests(data.requests ?? []);
      } catch {
        /* non-critical */
      } finally {
        setLoadingRequests(false);
      }
    })();
  }, [user]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } catch {
      /* non-critical */
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Unauthenticated state
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Friends</h1>
        <p className="text-muted-foreground max-w-sm">
          Sign in to discover people, build your network, and see what events
          your friends are attending.
        </p>
      </div>
    );
  }

  const isSearching = query.trim().length >= 2;
  const isLoading =
    (activeTab === "suggestions" && loadingSuggestions) ||
    (activeTab === "friends" && loadingFriends) ||
    (activeTab === "requests" && loadingRequests) ||
    (isSearching && loadingSearch);

  // Count for current section header
  const currentCount = isSearching
    ? searchResults.length
    : activeTab === "suggestions"
      ? suggestions.length
      : activeTab === "friends"
        ? friends.length
        : requests.length;

  return (
    <div className="flex-1 min-w-0">
      {/* ── Hero Section (matches /clubs hero) ─────────────────────── */}
      <section className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden">
        {/* Background — dark base with subtle primary accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/5" />
        {/* Grid texture */}
        <div className="absolute inset-0 bg-grid-white/[0.03]" />

        {/* Globe — anchored to the right of the hero, vertically centered */}
        <div className="absolute right-4 lg:right-[5%] top-1/2 -translate-y-1/2 hidden md:block pointer-events-auto z-0">
          <RotatingEarth
            width={460}
            height={460}
          />
        </div>

        {/* Bottom blend into page background */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background from-10% via-background/40 via-50% to-transparent z-10" />

        <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-32 z-10">
          <span className="inline-block px-5 py-2 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-6 border border-white/30 dark:border-white/15 shadow-xl [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
            Campus Network
          </span>

          <h2 className="text-white text-4xl sm:text-5xl lg:text-7xl font-black leading-[0.9] tracking-tighter mb-6">
            Find Your People
          </h2>

          <p className="text-white/80 text-lg lg:text-xl font-medium max-w-xl mb-8 leading-relaxed">
            Connect with students who share your interests. See what events
            your friends are attending and never go alone.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="#friends-feed"
              className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-base md:text-lg font-bold rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center gap-3"
            >
              Browse People
            </a>
          </div>
        </div>
      </section>

      {/* ── Popular with Friends ────────────────────────────────────── */}
      <div className="pt-8 space-y-8">
        <FriendsActivitySection />
        <FriendsOrganizingSection />
      </div>

      {/* ── Search & Tab Filters (matches /clubs search bar position) ── */}
      <div id="friends-feed" className="px-6 lg:px-10 pt-6 lg:pt-8">
        <div className="space-y-3">
          {/* Search Row */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-10 bg-secondary/60 dark:bg-secondary border border-border rounded-full pl-10 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tab Pills (matches clubs category pills style) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-0.5 -mx-0.5 scrollbar-hide">
            <TabPill
              label="Suggestions"
              active={activeTab === "suggestions" && !isSearching}
              onClick={() => {
                setActiveTab("suggestions");
                setQuery("");
              }}
            />
            <TabPill
              label={`My Friends${!loadingFriends && friends.length > 0 ? ` (${friends.length})` : ""}`}
              active={activeTab === "friends" && !isSearching}
              onClick={() => {
                setActiveTab("friends");
                setQuery("");
              }}
            />
            <TabPill
              label="Requests"
              active={activeTab === "requests" && !isSearching}
              onClick={() => {
                setActiveTab("requests");
                setQuery("");
              }}
              badge={requests.length > 0 ? requests.length : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Main Content (matches /clubs main section) ─────────────── */}
      <main className="px-6 lg:px-10 py-6 lg:py-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            {isSearching
              ? `Results for "${query}"`
              : activeTab === "suggestions"
                ? "Suggested for You"
                : activeTab === "friends"
                  ? "Your Friends"
                  : "Follow Requests"}
          </h2>
          {!isLoading && currentCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {currentCount} {currentCount !== 1 ? "people" : "person"}
            </span>
          )}
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-pulse"
              >
                <div className="p-6 pb-4 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-muted mb-4" />
                  <div className="h-5 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-24 bg-muted rounded mb-4" />
                  <div className="h-9 w-full bg-muted rounded-lg" />
                </div>
                <div className="border-t border-border bg-secondary/30 p-4">
                  <div className="h-3 w-28 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results */}
        {!isLoading && isSearching && (
          <>
            {searchResults.length === 0 ? (
              <EmptyState
                icon={<Search className="h-12 w-12 text-muted-foreground/30" />}
                title={`No results for "${query}"`}
                description="Try a different name or check the spelling."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Suggestions Tab */}
        {!isLoading && !isSearching && activeTab === "suggestions" && (
          <>
            {suggestions.length === 0 ? (
              <EmptyState
                icon={
                  <Sparkles className="h-12 w-12 text-muted-foreground/30" />
                }
                title="No suggestions yet"
                description="Join clubs and RSVP to events to get personalized suggestions."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suggestions.map((person) => (
                  <SuggestionCard key={person.id} person={person} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Friends Tab */}
        {!isLoading && !isSearching && activeTab === "friends" && (
          <>
            {friends.length === 0 ? (
              <EmptyState
                icon={<Users className="h-12 w-12 text-muted-foreground/30" />}
                title="No friends yet"
                description="Follow people and when they follow you back, they'll appear here."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {friends.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Requests Tab */}
        {!isLoading && !isSearching && activeTab === "requests" && (
          <>
            {requests.length === 0 ? (
              <EmptyState
                icon={
                  <UserPlus className="h-12 w-12 text-muted-foreground/30" />
                }
                title="No pending requests"
                description="When someone follows you, they'll show up here so you can follow them back."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {requests.map((person) => (
                  <RequestCard
                    key={person.id}
                    person={person}
                    onFollowBack={(id) => {
                      setRequests((prev) =>
                        prev.filter((r) => r.id !== id)
                      );
                      const matched = requests.find((r) => r.id === id);
                      if (matched) {
                        setFriends((prev) => [
                          ...prev,
                          { ...matched, isFollowing: true, isFriend: true },
                        ]);
                      }
                    }}
                    onDismiss={(id) => {
                      setRequests((prev) =>
                        prev.filter((r) => r.id !== id)
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Bottom CTA (matches /clubs "Don't see your club?" CTA) ── */}
        <div className="mt-16 mb-4 rounded-2xl border border-border bg-card p-8 md:p-10 text-center">
          <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
            Looking for someone specific?
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Use the search bar above to find any student by name. Follow them
            and they&apos;ll get notified — when they follow back, you become friends.
          </p>
          <button
            onClick={() => {
              const searchInput = document.querySelector<HTMLInputElement>(
                '#friends-feed input[type="text"]'
              );
              searchInput?.focus();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/20 cursor-pointer"
          >
            <Search className="h-4 w-4" />
            Search Students
          </button>
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function TabPill({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center justify-center px-5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer gap-2",
        active
          ? "bg-foreground text-background shadow-sm"
          : "bg-card border border-border text-muted-foreground hover:bg-secondary"
      )}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="bg-primary text-white text-[10px] font-bold py-0.5 px-1.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon}
      <h2 className="text-lg font-semibold mt-4">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function UserAvatar({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
  const initials = (name ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-20 h-20 rounded-full border-4 border-card shadow-sm overflow-hidden bg-secondary flex items-center justify-center shrink-0">
      {src ? (
        <Image
          src={src}
          alt={name}
          width={80}
          height={80}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xl font-bold text-primary">{initials}</span>
      )}
    </div>
  );
}

function FollowButton({
  userId,
  initialFollowing,
  initialIsFriend,
  onFollowChange,
}: {
  userId: string;
  initialFollowing: boolean;
  initialIsFriend: boolean;
  onFollowChange?: (following: boolean, isFriend: boolean) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isFriend, setIsFriend] = useState(initialIsFriend);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const method = following ? "DELETE" : "POST";
    const prevFollowing = following;
    const prevIsFriend = isFriend;

    if (following) {
      setFollowing(false);
      setIsFriend(false);
    } else {
      setFollowing(true);
    }

    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method });
      const data = await res.json();
      if (!res.ok) {
        setFollowing(prevFollowing);
        setIsFriend(prevIsFriend);
        return;
      }
      setFollowing(data.following);
      setIsFriend(data.isFriend);
      onFollowChange?.(data.following, data.isFriend);
    } catch {
      setFollowing(prevFollowing);
      setIsFriend(prevIsFriend);
    } finally {
      setLoading(false);
    }
  };

  // Matches the /clubs "Follow Club" button style
  const label = isFriend ? "Friends" : following ? "Following" : "Follow";
  const Icon = isFriend ? Users : following ? UserCheck : UserPlus;

  if (!following && !isFriend) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 hover:border-primary transition-colors py-2 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full border border-border hover:bg-secondary transition-colors py-2 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}

function ReasonBadge({
  reason,
  reason_type,
}: {
  reason: string;
  reason_type: "club" | "event" | "tags" | "faculty";
}) {
  const iconMap = {
    club: Building2,
    event: Calendar,
    tags: Sparkles,
    faculty: Users,
  };
  const Icon = iconMap[reason_type];
  const isPrimary = reason_type === "club" || reason_type === "event";

  return (
    <div
      className={cn(
        "rounded-lg py-2 px-3 w-full flex items-start gap-2 text-left border",
        isPrimary
          ? "bg-primary/10 border-primary/20"
          : "bg-secondary border-border"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 mt-0.5 shrink-0",
          isPrimary ? "text-primary" : "text-muted-foreground"
        )}
      />
      <p
        className={cn(
          "text-xs font-medium leading-tight",
          isPrimary ? "text-primary" : "text-muted-foreground"
        )}
      >
        {reason}
      </p>
    </div>
  );
}

/* ─── Card Components ───────────────────────────────────────────────── */
/* Card structure mirrors /clubs cards:
   - bg-card rounded-2xl border border-border shadow-sm hover:shadow-md
   - p-6 pb-4 centered layout with avatar, name, description, button
   - border-t footer section at the bottom
*/

function SuggestionCard({ person }: { person: Suggestion }) {
  return (
    <Link href={`/users/${person.id}`}>
      <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full group">
        {/* Card Body */}
        <div className="p-6 pb-4 flex flex-col items-center text-center flex-1">
          <UserAvatar src={person.avatar_url} name={person.name} />

          <h3 className="text-lg font-bold leading-tight mt-4 mb-1 group-hover:text-primary transition-colors">
            {person.name ?? "User"}
          </h3>

          <p className="text-muted-foreground text-sm mb-4">
            {[person.faculty, person.year].filter(Boolean).join(" · ") ||
              "McGill University"}
          </p>

          {/* Follow Button */}
          <div className="w-full mt-auto" onClick={(e) => e.preventDefault()}>
            <FollowButton
              userId={person.id}
              initialFollowing={person.isFollowing}
              initialIsFriend={person.isFriend}
            />
          </div>
        </div>

        {/* Reason Footer (matches clubs "Upcoming Event" footer) */}
        <div className="border-t border-border bg-secondary/30 p-4 mt-auto">
          <ReasonBadge
            reason={person.reason}
            reason_type={person.reason_type}
          />
        </div>
      </div>
    </Link>
  );
}

function PersonCard({ person }: { person: UserResult }) {
  return (
    <Link href={`/users/${person.id}`}>
      <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full group">
        {/* Card Body */}
        <div className="p-6 pb-4 flex flex-col items-center text-center flex-1">
          <UserAvatar src={person.avatar_url} name={person.name} />

          <h3 className="text-lg font-bold leading-tight mt-4 mb-1 group-hover:text-primary transition-colors">
            {person.name ?? "User"}
          </h3>

          <p className="text-muted-foreground text-sm mb-4">
            {[person.faculty, person.year].filter(Boolean).join(" · ") ||
              "McGill University"}
          </p>

          {/* Follow Button */}
          <div className="w-full mt-auto" onClick={(e) => e.preventDefault()}>
            <FollowButton
              userId={person.id}
              initialFollowing={person.isFollowing}
              initialIsFriend={person.isFriend}
            />
          </div>
        </div>

        {/* Footer — status line */}
        <div className="border-t border-border bg-secondary/30 p-4 mt-auto">
          <div className="flex items-center gap-2 text-muted-foreground/50">
            {person.isFriend ? (
              <>
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Friends</span>
              </>
            ) : person.isFollowing ? (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                <span className="text-xs">Following</span>
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">McGill Student</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function RequestCard({
  person,
  onFollowBack,
  onDismiss,
}: {
  person: UserResult;
  onFollowBack: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleFollowBack = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${person.id}/follow`, {
        method: "POST",
      });
      if (res.ok) {
        onFollowBack(person.id);
      }
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full group">
      {/* Card Body */}
      <div className="p-6 pb-4 flex flex-col items-center text-center flex-1">
        <Link href={`/users/${person.id}`}>
          <UserAvatar src={person.avatar_url} name={person.name} />
        </Link>

        <Link href={`/users/${person.id}`}>
          <h3 className="text-lg font-bold leading-tight mt-4 mb-1 group-hover:text-primary transition-colors">
            {person.name ?? "User"}
          </h3>
        </Link>

        <p className="text-muted-foreground text-sm mb-4">
          {[person.faculty, person.year].filter(Boolean).join(" · ") ||
            "McGill University"}
        </p>

        {/* Action Buttons */}
        <div className="w-full mt-auto space-y-2">
          <button
            onClick={handleFollowBack}
            disabled={loading}
            className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 hover:border-primary transition-colors py-2 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Follow Back
          </button>
          <button
            onClick={() => onDismiss(person.id)}
            className="w-full border border-border hover:bg-secondary transition-colors py-2 rounded-lg font-semibold text-sm text-center flex items-center justify-center gap-2 cursor-pointer text-muted-foreground"
          >
            <UserX className="h-4 w-4" />
            Dismiss
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-secondary/30 p-4 mt-auto">
        <div className="flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-primary font-medium">Started following you</span>
        </div>
      </div>
    </div>
  );
}
