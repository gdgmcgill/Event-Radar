"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BanUserModal } from "@/components/moderation/BanUserModal";
import {
  Search,
  Contact2,
  ShieldBan,
  ShieldCheck,
  Calendar,
  Mail,
} from "lucide-react";

interface OrganizerClub {
  id: string;
  name: string;
}

interface Organizer {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  roles: string[];
  created_at: string | null;
  banned_at: string | null;
  ban_expires_at: string | null;
  ban_reason: string | null;
  clubs: OrganizerClub[];
  event_count: number;
}

type StatusFilter = "all" | "active" | "banned";

export default function ModerationOrganizersPage() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Organizer | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrganizers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/admin/organizers?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setOrganizers(data.organizers ?? []);
    }
    setLoading(false);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchOrganizers(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on mount/filter change
  }, [fetchOrganizers]);

  function getInitial(name: string | null): string {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getBanStatus(org: Organizer): {
    isBanned: boolean;
    label: string;
  } {
    if (!org.banned_at) return { isBanned: false, label: "" };

    if (!org.ban_expires_at) {
      return { isBanned: true, label: "Permanent" };
    }

    const expiresAt = new Date(org.ban_expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      return { isBanned: false, label: "" };
    }

    const daysLeft = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      isBanned: true,
      label: `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`,
    };
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All Organizers" },
    { key: "active", label: "Active" },
    { key: "banned", label: "Banned" },
  ];

  async function handleBanSubmit(data: {
    reason: string;
    duration_days?: number;
    suspend_content: boolean;
  }) {
    if (!selectedUser) return;
    const res = await fetch(`/api/admin/users/${selectedUser.id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to ban user");
    }
    await fetchOrganizers();
  }

  async function handleUnban(org: Organizer) {
    const confirmed = window.confirm(
      `Are you sure you want to unban ${org.name || org.email}?`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/admin/users/${org.id}/ban`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to unban user");
      return;
    }
    await fetchOrganizers();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100">
          <Contact2 className="h-5 w-5 text-white dark:text-zinc-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Organizers
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage club organizers and their permissions
          </p>
        </div>
        {!loading && (
          <Badge className="ml-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-0 text-sm font-medium">
            {organizers.length} organizer{organizers.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-shadow"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Organizer Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div className="h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      ) : organizers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-16 text-center">
          <Contact2 className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {debouncedSearch
              ? "No organizers match your search"
              : "No organizers found"}
          </p>
          {debouncedSearch && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Try a different search term
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {organizers.map((org) => {
            const banStatus = getBanStatus(org);

            return (
              <div
                key={org.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {/* User info */}
                <div className="flex items-start gap-3">
                  {org.avatar_url ? (
                    <img
                      src={org.avatar_url}
                      alt={org.name ?? "Organizer"}
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      {getInitial(org.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {org.name || "No name"}
                      </span>
                      {banStatus.isBanned && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-[10px] font-medium shrink-0">
                          {banStatus.label}
                        </Badge>
                      )}
                    </div>
                    <a
                      href={`mailto:${org.email}`}
                      className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Mail className="h-3 w-3" />
                      {org.email}
                    </a>
                  </div>
                </div>

                {/* Clubs */}
                {org.clubs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {org.clubs.map((club) => (
                      <Badge
                        key={club.id}
                        className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 text-xs font-medium"
                      >
                        {club.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {formatDate(org.created_at)}
                  </span>
                  <span>
                    {org.event_count} event{org.event_count !== 1 ? "s" : ""}{" "}
                    created
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {banStatus.isBanned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleUnban(org)}
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Unban
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs"
                      onClick={() => {
                        setSelectedUser(org);
                        setBanModalOpen(true);
                      }}
                    >
                      <ShieldBan className="mr-1.5 h-3.5 w-3.5" />
                      Ban
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ban Modal */}
      <BanUserModal
        open={banModalOpen}
        onOpenChange={setBanModalOpen}
        userName={selectedUser?.name || selectedUser?.email || "Unknown"}
        onSubmit={handleBanSubmit}
      />
    </div>
  );
}
