"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Users, Trash2, Copy, Check, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useClubMembers } from "@/hooks/useClubs";
import { isMcGillEmail } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

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

interface ClubMembersTabProps {
  clubId: string;
  clubName: string;
  isOwner: boolean;
}

export function ClubMembersTab({ clubId, clubName, isOwner }: ClubMembersTabProps) {
  const { data, mutate, isLoading } = useClubMembers(clubId);
  const members: MemberEntry[] = data?.members ?? [];

  const [removingMember, setRemovingMember] = useState<MemberEntry | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Invite state
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
      // Error is handled by keeping the dialog open
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleInvite = async () => {
    setInviteError(null);
    setInviteLink(null);

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError("Please enter an email address.");
      return;
    }
    if (!isMcGillEmail(email)) {
      setInviteError("Only McGill email addresses (@mcgill.ca or @mail.mcgill.ca) are accepted.");
      return;
    }

    setInviteLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || "Failed to send invite");
      }

      const link = `${window.location.origin}/invites/${d.invite.token}`;
      setInviteLink(link);
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
    } catch {
      // Fallback: select and copy
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Member List */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members"
              description="This club doesn't have any members yet."
            />
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar / initials */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {member.users.name
                        ? member.users.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : member.users.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.users.name || member.users.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.users.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        member.role === "owner"
                          ? "bg-[#561c24] text-white hover:bg-[#561c24]/90"
                          : "bg-[#c7c7a3] text-foreground hover:bg-[#c7c7a3]/90"
                      }
                    >
                      {member.role === "owner" ? "Owner" : "Organizer"}
                    </Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      Joined{" "}
                      {format(parseISO(member.created_at), "MMM d, yyyy")}
                    </span>
                    {isOwner && member.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setRemovingMember(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Section (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Organizer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="organizer@mcgill.ca"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                disabled={inviteLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInvite();
                  }
                }}
              />
              <Button onClick={handleInvite} disabled={inviteLoading}>
                {inviteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>

            {inviteError && (
              <p className="mt-2 text-sm text-destructive">{inviteError}</p>
            )}

            {inviteLink && (
              <div className="mt-3 rounded-lg border bg-muted/50 p-3">
                <p className="mb-2 text-sm font-medium">
                  Invite link generated:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                    {inviteLink}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <strong>
                {removingMember?.users.name || removingMember?.users.email}
              </strong>{" "}
              from <strong>{clubName}</strong>? They will lose organizer access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemovingMember(null)}
              disabled={removeLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeLoading}
            >
              {removeLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
