"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import type { EventTag } from "@/types";
import { Loader2 } from "lucide-react";

type EditProfileModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    initialName: string;
    initialAvatarUrl: string;
    initialTags: EventTag[];
};

export default function EditProfileModal({
    open,
    onOpenChange,
    userId,
    initialName,
    initialAvatarUrl,
    initialTags,
}: EditProfileModalProps) {
    const router = useRouter();
    const [name, setName] = useState(initialName);
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
    // Ensure we filter valid tags initially
    const [tags, setTags] = useState<EventTag[]>(
        Array.isArray(initialTags) ? initialTags.filter(Boolean) : []
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const isValid = name.trim().length >= 2 && tags.length >= 3;

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    avatar_url: avatarUrl.trim() || null,
                    interest_tags: tags,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to update profile");
            }

            setSuccess("Profile updated successfully!");
            router.refresh(); // Refresh page data

            // Close after a brief delay to show success
            setTimeout(() => {
                onOpenChange(false);
                setSuccess(null);
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Display Name
                            </label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className={name.trim().length < 2 ? "border-red-500" : ""}
                            />
                            {name.trim().length < 2 && (
                                <p className="text-sm text-red-500">Name must be at least 2 characters.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="avatarUrl" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Avatar URL (Optional)
                            </label>
                            <Input
                                id="avatarUrl"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://example.com/avatar.jpg"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Interests
                            </label>
                            <p className="text-sm text-muted-foreground">Select 3-5 interests.</p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl border border-border">
                            <InterestTagSelector
                                selected={tags}
                                onChange={setTags}
                                min={3}
                                max={5}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="text-sm text-green-600 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">
                            {success}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!isValid || saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
