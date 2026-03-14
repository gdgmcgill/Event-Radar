"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Users,
  Trash2,
  Copy,
  Check,
  Loader2,
  Send,
  Mail,
  Clock,
  AlertCircle,
  Crown,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClubMembers, useClubInvites } from "@/hooks/useClubs";
import { isMcGillEmail } from "@/lib/utils";

interface MemberEntry {
  id: string;
  user_id: string;
  role: "owner" | "organizer";
  created_at: string;
  users: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

interface InviteEntry {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at?: string;
}

interface ClubMembersTabProps {
  clubId: string;
  clubName: string;
  isOwner: boolean;
}

const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function ClubMembersTab({ clubId, clubName, isOwner }: ClubMembersTabProps) {
  const { data, mutate, isLoading } = useClubMembers(clubId);
  const { data: invitesData, isLoading: invitesLoading } = useClubInvites(isOwner ? clubId : undefined);
  const members: MemberEntry[] = data?.members ?? [];
  const pendingInvites: InviteEntry[] = Array.isArray(invitesData)
    ? invitesData.filter((inv: InviteEntry) => inv.status === "pending")
    : [];

  const [removingMember, setRemovingMember] = useState<MemberEntry | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRemove = async () => {
    if (!removingMember) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: removingMember.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to remove member");
      }
      await mutate();
      setRemovingMember(null);
    } catch {
      // keep dialog open
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleInvite = async () => {
    setInviteError(null);
    setInviteLink(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { setInviteError("Please enter an email address."); return; }
    if (!isMcGillEmail(email)) { setInviteError("Only McGill email addresses are accepted."); return; }
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to send invite");
      setInviteLink(`${window.location.origin}/invites/${d.invite.token}`);
      setInviteEmail("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Member List */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/50">
          <h4 className="font-bold text-muted-foreground uppercase tracking-wider text-xs flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Members ({members.length})
          </h4>
        </div>
        {members.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No members yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => {
              const displayName = member.users.name || member.users.email;
              const colorClass = getAvatarColor(displayName);
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shrink-0 ${colorClass}`}
                    >
                      {getInitials(member.users.name, member.users.email)}
                    </div>
                    {/* Name & Email */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {member.users.name || member.users.email}
                      </p>
                      {member.users.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.users.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Role Badge */}
                    {member.role === "owner" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <Crown className="h-3 w-3" />
                        President
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <Shield className="h-3 w-3" />
                        Organizer
                      </span>
                    )}
                    {/* Join Date */}
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      Joined {format(parseISO(member.created_at), "MMM d, yyyy")}
                    </span>
                    {/* Remove Button (owner-only, not for self) */}
                    {isOwner && member.role !== "owner" && (
                      <button
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/10"
                        onClick={() => setRemovingMember(member)}
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations (owner-only) */}
      {isOwner && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/50">
            <h4 className="font-bold text-muted-foreground uppercase tracking-wider text-xs flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              Pending Invitations ({pendingInvites.length})
            </h4>
          </div>
          {invitesLoading ? (
            <div className="p-6">
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No pending invitations</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingInvites.map((invite) => {
                const isExpired =
                  invite.expires_at && new Date(invite.expires_at) < new Date();
                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {invite.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sent {format(parseISO(invite.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invite Section (owner-only) */}
      {isOwner && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-4">
          <h4 className="text-lg font-bold text-foreground">Invite Organizer</h4>
          <div className="flex gap-2">
            <Input
              placeholder="organizer@mcgill.ca"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
              disabled={inviteLoading}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInvite(); } }}
              className="border-border focus:ring-primary focus:border-primary"
            />
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 shrink-0"
            >
              {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send</>}
            </button>
          </div>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          {inviteLink && (
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Invite link generated:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-card px-2 py-1 text-xs border border-border text-foreground">
                  {inviteLink}
                </code>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  {copied ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove <strong>{removingMember?.users.name || removingMember?.users.email}</strong> from <strong>{clubName}</strong>? They will lose organizer access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingMember(null)} disabled={removeLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeLoading}>
              {removeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
