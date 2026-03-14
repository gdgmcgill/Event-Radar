"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Building2, Upload, X, Loader2, Check, Instagram } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Club } from "@/types";

const CLUB_CATEGORIES = [
  "Academic",
  "Arts & Culture",
  "Sports & Recreation",
  "Technology",
  "Social",
  "Professional",
  "Community Service",
  "Cultural",
  "Health & Wellness",
  "Media",
  "Political",
  "Environmental",
  "Religious/Spiritual",
  "Gaming",
  "Other",
] as const;

const DESCRIPTION_MAX_LENGTH = 500;

interface ClubSettingsTabProps {
  club: Club;
  onUpdate: (club: Club) => void;
}

export function ClubSettingsTab({ club, onUpdate }: ClubSettingsTabProps) {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [category, setCategory] = useState(club.category ?? "");
  const [instagramHandle, setInstagramHandle] = useState(
    (club.instagram_handle ?? "").replace(/^@/, "")
  );
  const [logoUrl, setLogoUrl] = useState(club.logo_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2 MB.");
      return;
    }
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoUrl(null);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return logoUrl;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      formData.append("clubId", club.id);
      const res = await fetch("/api/clubs/logo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Logo upload failed");
      }
      const data = await res.json();
      return data.url as string;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 50) {
      setError("Club name must be between 3 and 50 characters.");
      return;
    }

    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadLogo();
      }

      const cleanHandle = instagramHandle.trim().replace(/^@/, "") || null;

      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          category: category.trim() || null,
          instagram_handle: cleanHandle,
          logo_url: finalLogoUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update club");
      }

      const data = await res.json();
      onUpdate(data.club);
      setLogoFile(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = saving || uploadingLogo;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h4 className="text-lg font-bold text-foreground">Club Settings</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your club&apos;s profile information visible to all members and
          visitors.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-6">
          {/* ── Logo ── */}
          <fieldset disabled={isDisabled} className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Logo
            </legend>
            <p className="text-xs text-muted-foreground">
              Recommended size: 256 &times; 256 px. Max 2 MB.
            </p>

            <div className="flex items-center gap-4 pt-1">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Club logo"
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>

              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
                    <Upload className="h-4 w-4" />
                    {logoUrl ? "Change" : "Upload"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>

                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </fieldset>

          {/* ── Club Name ── */}
          <div className="space-y-2">
            <label
              htmlFor="club-name"
              className="text-sm font-medium text-foreground"
            >
              Club Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              minLength={3}
              required
              disabled={isDisabled}
              placeholder="e.g. McGill Robotics"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {name.trim().length}/50 characters
            </p>
          </div>

          {/* ── Description ── */}
          <div className="space-y-2">
            <label
              htmlFor="club-description"
              className="text-sm font-medium text-foreground"
            >
              Description
            </label>
            <Textarea
              id="club-description"
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= DESCRIPTION_MAX_LENGTH) {
                  setDescription(e.target.value);
                }
              }}
              rows={4}
              placeholder="Tell people about your club..."
              disabled={isDisabled}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring resize-none"
            />
            <p
              className={`text-xs ${
                description.length >= DESCRIPTION_MAX_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {description.length}/{DESCRIPTION_MAX_LENGTH} characters
            </p>
          </div>

          {/* ── Category (dropdown) ── */}
          <div className="space-y-2">
            <label
              htmlFor="club-category"
              className="text-sm font-medium text-foreground"
            >
              Category
            </label>
            <select
              id="club-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isDisabled}
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a category...</option>
              {CLUB_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Choose the category that best describes your club.
            </p>
          </div>

          {/* ── Instagram Handle ── */}
          <div className="space-y-2">
            <label
              htmlFor="club-instagram"
              className="text-sm font-medium text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <Instagram className="h-3.5 w-3.5" />
                Instagram Handle
              </span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                @
              </span>
              <Input
                id="club-instagram"
                value={instagramHandle}
                onChange={(e) =>
                  setInstagramHandle(e.target.value.replace(/^@/, ""))
                }
                placeholder="yourclub"
                disabled={isDisabled}
                className="border-border bg-background pl-8 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your handle without the @ symbol.
            </p>
          </div>

          {/* ── Error / Success feedback ── */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4 flex-shrink-0" />
              Settings saved successfully.
            </div>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={isDisabled}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
