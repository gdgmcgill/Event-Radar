"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  User,
  Tag,
} from "lucide-react";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { EventTag } from "@/types";

interface ClubWithCreator {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
  creator: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export default function ClubModerationPage() {
  const [clubs, setClubs] = useState<ClubWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    const res = await fetch(`/api/admin/clubs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setClubs(data.clubs ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const handleAction = async (clubId: string, status: "approved" | "rejected") => {
    setActionLoading(clubId);
    try {
      const res = await fetch(`/api/admin/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setClubs((prev) => prev.filter((c) => c.id !== clubId));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Club Management</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve new club registrations
          </p>
        </div>
        <Badge variant="secondary">{clubs.length} {statusFilter}</Badge>
      </div>

      <div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : clubs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No {statusFilter === "all" ? "" : statusFilter} clubs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clubs.map((club) => (
            <Card key={club.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {club.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      {club.creator && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {club.creator.name || club.creator.email}
                        </span>
                      )}
                      {club.category && EVENT_CATEGORIES[club.category as EventTag] && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5" />
                          {EVENT_CATEGORIES[club.category as EventTag].label}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(club.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor(club.status)}`}>
                    {club.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {club.description && (
                  <div className="bg-muted/50 rounded-md p-3 mb-4">
                    <p className="text-sm">{club.description}</p>
                  </div>
                )}
                {club.instagram_handle && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Instagram: @{club.instagram_handle.replace("@", "")}
                  </p>
                )}
                {club.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(club.id, "approved")}
                      disabled={actionLoading === club.id}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction(club.id, "rejected")}
                      disabled={actionLoading === club.id}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
