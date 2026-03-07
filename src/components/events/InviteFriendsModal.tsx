"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Check } from "lucide-react";

type FriendInfo = { id: string; name: string; avatar_url: string | null };

type InviteFriendsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
};

export function InviteFriendsModal({
  open,
  onOpenChange,
  eventId,
}: InviteFriendsModalProps) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSent(false);
      return;
    }

    const fetchFriends = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/users/me/friends");
        if (!res.ok) {
          // Fallback: use get_friends RPC via a different endpoint
          setFriends([]);
          return;
        }
        const data = await res.json();
        setFriends(data.friends ?? []);
      } catch {
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [open]);

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);

    try {
      const res = await fetch(`/api/events/${eventId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitee_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (res.ok) {
        setSentCount(data.sent);
        setSent(true);
        setTimeout(() => onOpenChange(false), 1500);
      }
    } catch {
      // Silently fail
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Invite Friends</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center space-y-2">
            <Check className="h-10 w-10 mx-auto text-green-500" />
            <p className="text-sm font-medium">
              {sentCount === 1 ? "1 invite sent!" : `${sentCount} invites sent!`}
            </p>
          </div>
        ) : loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : friends.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No friends to invite yet. Follow other users and have them follow you back to become friends.
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {friends.map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => toggleFriend(friend.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  selected.has(friend.id)
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-accent/50 border border-transparent"
                }`}
              >
                {friend.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={friend.avatar_url}
                    alt={friend.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {(friend.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium flex-1 text-left truncate">
                  {friend.name ?? "User"}
                </span>
                {selected.has(friend.id) && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {!sent && friends.length > 0 && (
          <DialogFooter>
            <Button
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
