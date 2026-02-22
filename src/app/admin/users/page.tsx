"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ShieldOff, Search } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  interest_tags: string[] | null;
  is_admin: boolean;
  created_at: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const toggleAdmin = async (userId: string, currentValue: boolean) => {
    setToggling(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: !currentValue }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_admin: !currentValue } : u
        )
      );
    }
    setToggling(null);
  };

  const filtered = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">
          {users.length} registered users
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
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
          No users found.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {user.name || "No name"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                    {user.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Joined{" "}
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {user.is_admin && (
                      <Badge className="bg-primary/10 text-primary border-0">
                        Admin
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant={user.is_admin ? "destructive" : "outline"}
                      onClick={() => toggleAdmin(user.id, user.is_admin)}
                      disabled={toggling === user.id}
                    >
                      {user.is_admin ? (
                        <>
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                          Remove Admin
                        </>
                      ) : (
                        <>
                          <Shield className="mr-1.5 h-3.5 w-3.5" />
                          Make Admin
                        </>
                      )}
                    </Button>
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
