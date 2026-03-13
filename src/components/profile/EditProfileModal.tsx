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
import { PRONOUNS, YEARS, FACULTIES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

type EditProfileModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    initialName: string;
    initialAvatarUrl: string;
    initialTags: string[];
    initialPronouns?: string;
    initialYear?: string;
    initialFaculty?: string;
    initialVisibility?: string;
};

export default function EditProfileModal({
    open,
    onOpenChange,
    userId,
    initialName,
    initialAvatarUrl,
    initialTags,
    initialPronouns = "",
    initialYear = "",
    initialFaculty = "",
    initialVisibility = "public",
}: EditProfileModalProps) {
    const router = useRouter();
    const [name, setName] = useState(initialName);
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
    const [tags, setTags] = useState<string[]>(
        Array.isArray(initialTags) ? initialTags.filter(Boolean) : []
    );
    const [pronouns, setPronouns] = useState(initialPronouns);
    const [year, setYear] = useState(initialYear);
    const [faculty, setFaculty] = useState(initialFaculty);
    const [visibility, setVisibility] = useState(initialVisibility);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const isValid = name.trim().length >= 2 && tags.length >= 3;

    const selectClass =
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
                    pronouns: pronouns || null,
                    year: year || null,
                    faculty: faculty || null,
                    visibility,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to update profile");
            }

            setSuccess("Profile updated successfully!");
            router.refresh();

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
                            <label htmlFor="name" className="text-sm font-medium leading-none">
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
                            <label htmlFor="avatarUrl" className="text-sm font-medium leading-none">
                                Avatar URL (Optional)
                            </label>
                            <Input
                                id="avatarUrl"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://example.com/avatar.jpg"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="edit-pronouns" className="text-sm font-medium leading-none">
                                Pronouns
                            </label>
                            <select
                                id="edit-pronouns"
                                value={pronouns}
                                onChange={(e) => setPronouns(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Select pronouns...</option>
                                {PRONOUNS.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="edit-year" className="text-sm font-medium leading-none">
                                Year
                            </label>
                            <select
                                id="edit-year"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Select year...</option>
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="edit-faculty" className="text-sm font-medium leading-none">
                                Faculty
                            </label>
                            <select
                                id="edit-faculty"
                                value={faculty}
                                onChange={(e) => setFaculty(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Select faculty...</option>
                                {FACULTIES.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">
                                Profile Visibility
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setVisibility("public")}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                        visibility === "public"
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:bg-accent"
                                    }`}
                                >
                                    Public
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVisibility("private")}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                        visibility === "private"
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:bg-accent"
                                    }`}
                                >
                                    Private
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {visibility === "private"
                                    ? "Only friends can see your interests, clubs, and events."
                                    : "Anyone can view your full profile."}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium leading-none">
                                Interests
                            </label>
                            <p className="text-sm text-muted-foreground">Select 3-5 interests.</p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl border border-border">
                            <InterestTagSelector
                                selected={tags}
                                onChange={setTags}
                                min={3}
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
