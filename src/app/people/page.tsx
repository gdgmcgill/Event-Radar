"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  Loader2,
  MessageSquare,
  Compass,
  UserPlus,
  Mail,
  UsersRound,
} from "lucide-react";
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

type Tab = "suggestions" | "friends" | "requests";

export default function PeoplePage() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [friends, setFriends] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("suggestions");

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
        <p className="text-muted-foreground">
          Sign in to search for people and add friends.
        </p>
      </div>
    );
  }

  const displayUsers =
    query.trim().length >= 2
      ? results
      : activeTab === "friends"
        ? friends
        : results;

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] flex-col">
      <main className="mx-auto w-full max-w-7xl px-4 md:px-10 py-8 flex-1">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0 space-y-2">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Community
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Grow your network
              </p>
            </div>
            <SidebarLink
              icon={<Users className="h-5 w-5" />}
              label="People"
              active
            />
            <SidebarLink
              icon={<UsersRound className="h-5 w-5" />}
              label="Groups"
            />
            <SidebarLink
              icon={<MessageSquare className="h-5 w-5" />}
              label="Messages"
            />
            <SidebarLink
              icon={<Compass className="h-5 w-5" />}
              label="Discover"
            />
          </aside>

          {/* Content Area */}
          <div className="flex-1">
            {/* Search and Tabs */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 shadow-sm border border-red-600/5 mb-8">
              <div className="flex flex-col gap-6">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#ED1B2F]" />
                  <Input
                    placeholder="Search students by name, major, or interests"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-red-600/20 text-lg"
                  />
                </div>
                <div className="flex border-b border-red-600/10">
                  <TabButton
                    label="Suggestions"
                    active={activeTab === "suggestions"}
                    onClick={() => setActiveTab("suggestions")}
                  />
                  <TabButton
                    label={`Friends (${friends.length})`}
                    active={activeTab === "friends"}
                    onClick={() => setActiveTab("friends")}
                  />
                  <TabButton
                    label="Requests"
                    active={activeTab === "requests"}
                    onClick={() => setActiveTab("requests")}
                  />
                </div>
              </div>
            </div>

            {/* Content based on active tab */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {activeTab === "suggestions" && "Suggested for you"}
                  {activeTab === "friends" && "Your Friends"}
                  {activeTab === "requests" && "Friend Requests"}
                </h2>
                <button className="text-[#ED1B2F] text-sm font-semibold hover:underline">
                  View All
                </button>
              </div>

              {/* Loading state */}
              {((activeTab === "friends" && loadingFriends) ||
                (query.trim().length >= 2 && loading)) && (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Search results as cards */}
              {query.trim().length >= 2 && !loading && results.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No users found for &quot;{query}&quot;
                </div>
              )}

              {/* User cards grid */}
              {!(
                (activeTab === "friends" && loadingFriends) ||
                (query.trim().length >= 2 && loading)
              ) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayUsers.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))}
                </div>
              )}

              {/* Empty friends state */}
              {activeTab === "friends" &&
                !loadingFriends &&
                friends.length === 0 &&
                query.trim().length < 2 && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No friends yet. Search for people above to follow them — when
                    they follow you back, you become friends.
                  </div>
                )}

              {/* Empty requests state */}
              {activeTab === "requests" && query.trim().length < 2 && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No pending friend requests.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-red-600/5 bg-white dark:bg-slate-900 py-6 px-4 md:px-10">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-6">
            <span>&copy; 2024 Uni-Verse Campus Network</span>
            <a className="hover:text-[#ED1B2F]" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-[#ED1B2F]" href="#">
              Community Guidelines
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>2,401 students online now</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ──────────── Sub-components ──────────── */

function SidebarLink({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${
        active
          ? "bg-red-600/10 text-[#ED1B2F] font-semibold"
          : "text-slate-600 dark:text-slate-400 hover:bg-red-600/5"
      }`}
      href="#"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-sm font-bold transition-colors ${
        active
          ? "border-b-[3px] border-[#ED1B2F] text-[#ED1B2F]"
          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function PersonCard({ person }: { person: UserResult }) {
  const initials = (person.name ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isOnline = Math.random() > 0.4; // Placeholder for real online status

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-red-600/5 rounded-2xl p-5 flex flex-col items-center text-center group hover:shadow-lg transition-all">
      {/* Avatar */}
      <Link href={`/users/${person.id}`} className="relative mb-4">
        <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-red-600/10">
          {person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.avatar_url}
              alt={person.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-red-600/10 flex items-center justify-center text-xl font-semibold text-[#ED1B2F]">
              {initials}
            </div>
          )}
        </div>
        <span
          className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-white dark:border-slate-900 ${
            isOnline ? "bg-green-500" : "bg-slate-300"
          }`}
        />
      </Link>

      {/* Name & Info */}
      <Link href={`/users/${person.id}`}>
        <h3 className="text-lg font-bold group-hover:text-[#ED1B2F] transition-colors">
          {person.name ?? "User"}
        </h3>
      </Link>
      <p className="text-[#ED1B2F] text-sm font-medium mb-1">
        {person.faculty ?? "McGill University"}
      </p>
      {person.year && (
        <p className="text-slate-500 text-xs mb-1">{person.year}</p>
      )}
      <p className="text-slate-500 text-xs mb-4 flex items-center justify-center gap-1">
        <Users className="h-4 w-4" />
        {person.isFriend ? "Friends" : "Mutual connections"}
      </p>

      {/* Actions */}
      <div className="flex gap-2 w-full">
        <div className="flex-1">
          <FollowUserButton
            userId={person.id}
            initialFollowing={person.isFollowing}
            initialIsFriend={person.isFriend}
          />
        </div>
        <Link
          href={`/users/${person.id}`}
          className="p-2 bg-red-600/5 text-[#ED1B2F] rounded-lg hover:bg-red-600/10 transition-colors inline-flex items-center justify-center"
        >
          <Mail className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
