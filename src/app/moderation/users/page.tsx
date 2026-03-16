"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BanUserModal } from "@/components/moderation/BanUserModal";
import { Search, UserPlus, UserMinus, Shield, Users, Ban, ShieldCheck } from "lucide-react";
import type { UserRole } from "@/types";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  interest_tags: string[] | null;
  roles: UserRole[];
  created_at: string | null;
  banned_at: string | null;
  ban_expires_at: string | null;
  ban_reason: string | null;
}

export default function ModerationUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [banningUser, setBanningUser] = useState<AdminUser | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on mount
  }, []);

  const toggleOrganizer = async (userId: string, currentlyOrganizer: boolean) => {
    setToggling(userId);
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) { setToggling(null); return; }

    const newRoles: UserRole[] = currentlyOrganizer
      ? targetUser.roles.filter((r) => r !== "club_organizer")
      : [...targetUser.roles.filter((r) => r !== "club_organizer"), "club_organizer"];

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles: newRoles }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, roles: newRoles } : u
        )
      );
    }
    setToggling(null);
  };

  const handleBan = async (data: { reason: string; duration_days?: number; suspend_content: boolean }) => {
    if (!banningUser) return;
    const res = await fetch(`/api/admin/users/${banningUser.id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await fetchUsers();
    }
  };

  const handleUnban = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to unban ${userName || "this user"}?`)) return;
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchUsers();
    }
  };

  const filtered = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name?.toLowerCase().includes(q) ?? false)
    );
  });

  function getInitial(name: string | null): string {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  }

  function formatJoinDate(dateStr: string | null): string {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function isBanned(user: AdminUser): boolean {
    if (!user.banned_at) return false;
    if (!user.ban_expires_at) return true; // permanent
    return new Date(user.ban_expires_at) > new Date();
  }

  function banStatusBadge(user: AdminUser) {
    if (!isBanned(user)) return null;

    if (!user.ban_expires_at) {
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs font-medium">
          <Ban className="mr-1 h-3 w-3" />
          Banned (Permanent)
        </Badge>
      );
    }

    const expiresAt = new Date(user.ban_expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs font-medium">
        <Ban className="mr-1 h-3 w-3" />
        Banned ({daysLeft}d left)
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100">
          <Users className="h-5 w-5 text-white dark:text-zinc-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            User Management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage roles and permissions
          </p>
        </div>
        {!loading && (
          <Badge className="ml-auto bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-0 text-sm font-medium">
            {users.length} users
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

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_180px_100px_200px] gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">User</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Email</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Roles / Status</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Joined</span>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium text-right">Actions</span>
        </div>

        {loading ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_180px_100px_200px] gap-4 px-6 py-4 items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                </div>
                <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <div className="h-8 w-32 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {searchQuery ? "No users match your search" : "No users found"}
            </p>
            {searchQuery && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Try a different search term
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filtered.map((user) => {
              const isOrganizer = user.roles.includes("club_organizer");
              const isAdmin = user.roles.includes("admin");
              const banned = isBanned(user);

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px_100px_200px] gap-2 sm:gap-4 px-6 py-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      {getInitial(user.name)}
                    </div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {user.name || "No name"}
                    </span>
                  </div>

                  {/* Email */}
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    {user.email}
                  </span>

                  {/* Roles / Ban Status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isAdmin && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs font-medium">
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                    {isOrganizer && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 text-xs font-medium">
                        Organizer
                      </Badge>
                    )}
                    {!isAdmin && !isOrganizer && !banned && (
                      <Badge className="bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-0 text-xs font-medium">
                        User
                      </Badge>
                    )}
                    {banStatusBadge(user)}
                  </div>

                  {/* Joined */}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatJoinDate(user.created_at)}
                  </span>

                  {/* Actions */}
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant={isOrganizer ? "destructive" : "outline"}
                      onClick={() => toggleOrganizer(user.id, isOrganizer)}
                      disabled={toggling === user.id}
                      className="text-xs"
                    >
                      {isOrganizer ? (
                        <>
                          <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                          Remove Organizer
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                          Make Organizer
                        </>
                      )}
                    </Button>
                    {banned ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnban(user.id, user.name || user.email)}
                        className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                      >
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Unban
                      </Button>
                    ) : (
                      !isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBanningUser(user)}
                          className="text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" />
                          Ban
                        </Button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {banningUser && (
        <BanUserModal
          open={!!banningUser}
          onOpenChange={(open) => !open && setBanningUser(null)}
          userName={banningUser.name || banningUser.email}
          onSubmit={handleBan}
        />
      )}
    </div>
  );
}
