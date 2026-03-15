"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import {
  Building2,
  Upload,
  X,
  Loader2,
  Check,
  Instagram,
  Twitter,
  Globe,
  MessageCircle,
  Linkedin,
  ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Club, ClubMember } from "@/types";

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
  members?: ClubMember[];
}

export function ClubSettingsTab({ club, onUpdate, members = [] }: ClubSettingsTabProps) {
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

  // New state fields
  const [bannerUrl, setBannerUrl] = useState(club.banner_url || "");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [contactEmail, setContactEmail] = useState(club.contact_email || "");
  const [websiteUrl, setWebsiteUrl] = useState(club.website_url || "");
  const [discordUrl, setDiscordUrl] = useState(club.discord_url || "");
  const [twitterUrl, setTwitterUrl] = useState(club.twitter_url || "");
  const [linkedinUrl, setLinkedinUrl] = useState(club.linkedin_url || "");

  // Danger zone state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);

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

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Banner must be under 2 MB"); return; }
    setBannerFile(file);
    setBannerUrl(URL.createObjectURL(file));
  }

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

    if (contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail.trim())) {
        setError("Invalid contact email format");
        return;
      }
    }

    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadLogo();
      }

      const cleanHandle = instagramHandle.trim().replace(/^@/, "") || null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateBody: Record<string, any> = {
        name: trimmedName,
        description: description.trim() || null,
        category: category.trim() || null,
        instagram_handle: cleanHandle,
        logo_url: finalLogoUrl,
        contact_email: contactEmail.trim() || null,
        website_url: websiteUrl.trim() || null,
        discord_url: discordUrl.trim() || null,
        twitter_url: twitterUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
      };

      if (bannerFile) {
        setUploadingBanner(true);
        const formData = new FormData();
        formData.append("file", bannerFile);
        formData.append("clubId", club.id);
        const uploadRes = await fetch("/api/clubs/banner", { method: "POST", body: formData });
        setUploadingBanner(false);
        if (!uploadRes.ok) { setError("Failed to upload banner"); return; }
        const { url } = await uploadRes.json();
        updateBody.banner_url = url;
      }

      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update club");
      }

      const data = await res.json();
      onUpdate(data.club);
      setLogoFile(null);
      setBannerFile(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
      setUploadingBanner(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTargetId) return;
    setDangerLoading(true);
    try {
      const res = await fetch(`/api/clubs/${club.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: transferTargetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to transfer ownership");
      }
      setShowTransferDialog(false);
      window.location.href = "/my-clubs";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
      setShowTransferDialog(false);
    } finally {
      setDangerLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmName !== club.name) return;
    setDangerLoading(true);
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirmName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete club");
      }
      setShowDeleteDialog(false);
      window.location.href = "/my-clubs";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setShowDeleteDialog(false);
    } finally {
      setDangerLoading(false);
    }
  };

  const isDisabled = saving || uploadingLogo || uploadingBanner;

  // Members eligible for transfer (everyone except current owner)
  const transferCandidates = members.filter(
    (m) => m.role !== "owner" && m.user
  );

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

          {/* ── Banner Image ── */}
          <fieldset disabled={isDisabled} className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Banner Image
            </legend>
            <p className="text-xs text-muted-foreground">
              Recommended: 1200&times;400px, max 2 MB
            </p>

            {bannerUrl ? (
              <div className="relative mt-1 overflow-hidden rounded-xl border border-border">
                <Image
                  src={bannerUrl}
                  alt="Club banner"
                  width={1200}
                  height={400}
                  className="h-32 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => { setBannerFile(null); setBannerUrl(""); }}
                  className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2 py-1.5 text-xs font-medium text-destructive backdrop-blur-sm hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 text-center transition-colors hover:bg-muted/50">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Click to upload banner
                </span>
                <span className="text-xs text-muted-foreground">JPEG, PNG, or WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerChange}
                />
              </label>
            )}
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

          {/* ── Contact Email ── */}
          <div className="space-y-2">
            <label
              htmlFor="club-contact-email"
              className="text-sm font-medium text-foreground"
            >
              Contact Email
            </label>
            <p className="text-xs text-muted-foreground">
              For moderation, partnerships, and student outreach
            </p>
            <Input
              id="club-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="club@mail.mcgill.ca"
              disabled={isDisabled}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            />
          </div>

          {/* ── Social Links ── */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Social Links</p>

            {/* Instagram */}
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

            {/* Twitter/X */}
            <div className="space-y-2">
              <label
                htmlFor="club-twitter"
                className="text-sm font-medium text-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Twitter className="h-3.5 w-3.5" />
                  Twitter / X URL
                </span>
              </label>
              <Input
                id="club-twitter"
                type="url"
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="https://twitter.com/yourclub"
                disabled={isDisabled}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>

            {/* Discord */}
            <div className="space-y-2">
              <label
                htmlFor="club-discord"
                className="text-sm font-medium text-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Discord URL
                </span>
              </label>
              <Input
                id="club-discord"
                type="url"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.gg/yourserver"
                disabled={isDisabled}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>

            {/* LinkedIn */}
            <div className="space-y-2">
              <label
                htmlFor="club-linkedin"
                className="text-sm font-medium text-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn URL
                </span>
              </label>
              <Input
                id="club-linkedin"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/company/yourclub"
                disabled={isDisabled}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <label
                htmlFor="club-website"
                className="text-sm font-medium text-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Website URL
                </span>
              </label>
              <Input
                id="club-website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourclub.mcgill.ca"
                disabled={isDisabled}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>
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

      {/* ── Danger Zone ── */}
      <div className="rounded-xl border border-destructive/30 bg-card p-8 shadow-sm">
        <h4 className="text-lg font-bold text-destructive">Danger Zone</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          These actions are irreversible. Please proceed with caution.
        </p>

        <div className="mt-6 space-y-6">
          {/* Transfer Ownership */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Transfer Ownership</p>
              <p className="text-sm text-muted-foreground">
                Assign a new owner. You will be demoted to organizer.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setError(null); setShowTransferDialog(true); }}
              className="shrink-0"
            >
              Transfer
            </Button>
          </div>

          <hr className="border-border" />

          {/* Delete Club */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Club</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this club and all its data. This cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { setError(null); setDeleteConfirmName(""); setShowDeleteDialog(true); }}
              className="shrink-0"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* ── Transfer Ownership Dialog ── */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>
              This will make the selected member the new owner. You will be demoted to organizer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {transferCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible members to transfer to. Invite organizers first.
              </p>
            ) : (
              <div className="space-y-2">
                <label htmlFor="transfer-target" className="text-sm font-medium text-foreground">
                  Select new owner
                </label>
                <select
                  id="transfer-target"
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a member...</option>
                  {transferCandidates.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.name || m.user?.email || m.user_id} — {m.role}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferDialog(false)}
              disabled={dangerLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!transferTargetId || dangerLoading || transferCandidates.length === 0}
            >
              {dangerLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Transferring...</>
              ) : (
                "Confirm Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Club Dialog ── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Club</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type the club name to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{club.name}</span> to confirm deletion.
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={club.name}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={dangerLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmName !== club.name || dangerLoading}
            >
              {dangerLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</>
              ) : (
                "Delete Club"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
