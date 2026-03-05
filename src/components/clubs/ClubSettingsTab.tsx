"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Building2, Upload, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Club } from "@/types";

interface ClubSettingsTabProps {
  club: Club;
  onUpdate: (club: Club) => void;
}

export function ClubSettingsTab({ club, onUpdate }: ClubSettingsTabProps) {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [category, setCategory] = useState(club.category ?? "");
  const [instagramHandle, setInstagramHandle] = useState(
    club.instagram_handle ?? ""
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

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    // Validate size (< 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2MB.");
      return;
    }

    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
    setError(null);
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

    // Client-side validation
    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 50) {
      setError("Club name must be between 3 and 50 characters.");
      return;
    }

    setSaving(true);
    try {
      // Upload logo first if changed
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadLogo();
      }

      // Strip @ from instagram handle
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
    <Card>
      <CardHeader>
        <CardTitle>Club Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo */}
          <div>
            <label className="mb-2 block text-sm font-medium">Logo</label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Club logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="pointer-events-none"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Change
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="club-name" className="mb-2 block text-sm font-medium">
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
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {name.trim().length}/50 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="club-description" className="mb-2 block text-sm font-medium">
              Description
            </label>
            <Textarea
              id="club-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Tell people about your club..."
              disabled={isDisabled}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="club-category" className="mb-2 block text-sm font-medium">
              Category
            </label>
            <Input
              id="club-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Academic, Sports, Cultural"
              disabled={isDisabled}
            />
          </div>

          {/* Instagram */}
          <div>
            <label htmlFor="club-instagram" className="mb-2 block text-sm font-medium">
              Instagram Handle
            </label>
            <Input
              id="club-instagram"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              placeholder="@yourclub"
              disabled={isDisabled}
            />
          </div>

          {/* Error / Success */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Settings saved successfully.
            </p>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isDisabled}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
