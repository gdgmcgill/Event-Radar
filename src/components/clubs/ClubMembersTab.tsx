"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Users, Trash2, Copy, Check, Loader2, Send } from "lucide-react";
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
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Member List */}
      <div className="bg-white rounded-xl border border-red-600/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-600/5 bg-slate-50">
          <h4 className="font-bold text-slate-500 uppercase tracking-wider text-xs">Members ({members.length})</h4>
        </div>
        {members.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No members yet</p>
          </div>
        ) : (
          <div className="divide-y divide-red-600/5">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/10 text-sm font-medium text-red-600 shrink-0">
                    {member.users.name
                      ? member.users.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                      : member.users.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{member.users.name || member.users.email}</p>
                    <p className="text-xs text-slate-500">{member.users.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    member.role === "owner"
                      ? "bg-red-600/10 text-red-600 border border-red-600/20"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {member.role === "owner" ? "Owner" : "Organizer"}
                  </span>
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    Joined {format(parseISO(member.created_at), "MMM d, yyyy")}
                  </span>
                  {isOwner && member.role !== "owner" && (
                    <button
                      className="p-1.5 hover:text-red-600 transition-colors text-slate-400 rounded hover:bg-red-600/5"
                      onClick={() => setRemovingMember(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Section */}
      {isOwner && (
        <div className="bg-white rounded-xl border border-red-600/5 shadow-sm p-6 space-y-4">
          <h4 className="text-lg font-bold">Invite Organizer</h4>
          <div className="flex gap-2">
            <Input
              placeholder="organizer@mcgill.ca"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
              disabled={inviteLoading}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleInvite(); } }}
              className="border-red-600/10 focus:ring-red-600 focus:border-red-600"
            />
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              className="bg-red-600 hover:bg-red-600/90 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 shrink-0"
            >
              {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send</>}
            </button>
          </div>
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          {inviteLink && (
            <div className="rounded-lg border border-red-600/10 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium">Invite link generated:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs border border-red-600/5">{inviteLink}</code>
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
