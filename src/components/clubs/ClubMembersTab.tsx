"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, Loader2, Trash2, Mail, Copy, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MemberWithUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  users: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

interface PendingInvite {
  id: string;
  invitee_email: string;
  created_at: string;
  token: string;
}

interface ClubMembersTabProps {
  clubId: string;
  role: "owner" | "organizer";
  userId: string;
}

export function ClubMembersTab({ clubId, role, userId }: ClubMembersTabProps) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Remove dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithUser | null>(
    null
  );
  const [removing, setRemoving] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members ?? []);
      setPendingInvites(data.pendingInvites ?? []);
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openRemoveDialog(member: MemberWithUser) {
    setSelectedMember(member);
    setRemoveDialogOpen(true);
  }

  async function handleRemove() {
    if (!selectedMember) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedMember.user_id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      setRemoveDialogOpen(false);
      setSelectedMember(null);
      fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    setInviteLink(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invitation");
      const link = `${window.location.origin}/invites/${data.token}`;
      setInviteLink(link);
      setInviteEmail("");
      fetchData();
    } catch (e) {
      setInviteError(
        e instanceof Error ? e.message : "Failed to create invitation"
      );
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(inviteId: string) {
    try {
      const res = await fetch(`/api/clubs/${clubId}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (!res.ok) throw new Error("Failed to revoke invitation");
      fetchData();
    } catch {
      setError("Failed to revoke invitation");
    }
  }

  const displayName = (member: MemberWithUser) =>
    member.users.name ?? member.users.email;

  const avatarLetter = (member: MemberWithUser) =>
    (member.users.name ?? member.users.email).charAt(0).toUpperCase();

  return (
    <div>
      {/* Header row */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">Members</h2>
          {!loading && !error && (
            <Badge variant="secondary">{members.length}</Badge>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading members...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={fetchData}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No members found
            </h3>
            <p className="text-muted-foreground text-sm">
              Invite organizers to help manage your club.
            </p>
          </div>
        </div>
      )}

      {/* Member list */}
      {!loading && !error && members.length > 0 && (
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar placeholder */}
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {avatarLetter(member)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium text-foreground truncate">
                    {displayName(member)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Joined {formatDate(member.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                {member.role === "owner" ? (
                  <Badge
                    variant="secondary"
                    className="bg-red-100 text-red-800"
                  >
                    Owner
                  </Badge>
                ) : (
                  <Badge variant="secondary">Organizer</Badge>
                )}

                {role === "owner" &&
                  member.role !== "owner" &&
                  member.user_id !== userId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRemoveDialog(member)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite by Email section — owner only */}
      {role === "owner" && (
        <>
          <div className="my-8 border-t" />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">
                Invite an Organizer
              </h3>
            </div>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="organizer@mcgill.ca"
                className="flex-1"
                required
              />
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Invite"
                )}
              </Button>
            </form>

            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}

            {inviteLink && (
              <div className="flex gap-2 items-center">
                <Input
                  value={inviteLink}
                  readOnly
                  className="flex-1 text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Pending Invitations section — owner only, shown when invites exist */}
      {role === "owner" && pendingInvites.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              Pending Invitations
            </h3>
            <Badge variant="secondary">{pendingInvites.length}</Badge>
          </div>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium text-foreground truncate">
                    {invite.invitee_email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Invited {formatDate(invite.created_at)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(invite.id)}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member Removal Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              This will remove{" "}
              <strong>
                {selectedMember ? displayName(selectedMember) : "this member"}
              </strong>{" "}
              from your club. They will lose organizer access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
