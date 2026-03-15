"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Upload, Loader2, CheckCircle2, Instagram, AlertCircle, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/useAuthStore";

const CLUB_CATEGORIES = [
  "Academic",
  "Arts & Culture",
  "Business & Entrepreneurship",
  "Community Service",
  "Cultural & Identity",
  "Engineering & Technology",
  "Environment & Sustainability",
  "Health & Wellness",
  "Media & Publications",
  "Music & Performance",
  "Political & Advocacy",
  "Religious & Spiritual",
  "Science & Research",
  "Social",
  "Sports & Recreation",
] as const;

const MAX_NAME = 100;
const MAX_DESC = 500;

export function CreateClubForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, logo: "Please select an image file." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, logo: "Image must be smaller than 2 MB." }));
      return;
    }
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.logo;
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) errs.name = "Club name is required.";
    else if (trimmedName.length < 3) errs.name = "Name must be at least 3 characters.";
    else if (trimmedName.length > MAX_NAME) errs.name = `Name must be under ${MAX_NAME} characters.`;

    if (!description.trim()) errs.description = "Description is required.";
    else if (description.trim().length > MAX_DESC) errs.description = `Description must be under ${MAX_DESC} characters.`;

    if (!category) errs.category = "Please select a category.";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Step 1: Create club first (without logo)
      const cleanHandle = instagramHandle.trim().replace(/^@/, "") || null;
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          logo_url: null,
          instagram_handle: cleanHandle,
          website_url: websiteUrl.trim() || null,
          discord_url: discordUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create club");
      }

      const club = await res.json();

      // Step 2: Upload logo now that club exists and user is owner
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        formData.append("clubId", club.id);
        const logoRes = await fetch("/api/clubs/logo", { method: "POST", body: formData });
        if (logoRes.ok) {
          const logoData = await logoRes.json();
          // Update club with logo URL
          await fetch(`/api/clubs/${club.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logo_url: logoData.url }),
          });
        }
      }

      // Step 3: Update auth store
      const store = useAuthStore.getState();
      const currentRoles = store.user?.roles ?? ["user"];
      if (!currentRoles.includes("club_organizer")) {
        store.updateUser({ roles: [...currentRoles, "club_organizer"] as ("user" | "admin" | "club_organizer")[] });
      }
      // Update hasClubs directly — Zustand set merges at the top level
      useAuthStore.setState({ hasClubs: true });

      setSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-10 md:p-14 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight mb-2">Your club is under review!</h3>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          Our team will review your submission and approve it shortly. You&apos;ll be notified once your club is live.
        </p>
        <Link
          href="/clubs"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          Back to Clubs
        </Link>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-8 md:p-10 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Club Logo <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-secondary flex items-center justify-center border border-border">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo preview" width={80} height={80} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <Building2 className="h-9 w-9 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/20 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors">
                  <Upload className="h-4 w-4" />
                  {logoFile ? "Change" : "Upload"}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
              <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG up to 2 MB</p>
            </div>
          </div>
          {errors.logo && <p className="mt-1.5 text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.logo}</p>}
        </div>

        {/* Club Name */}
        <div>
          <label htmlFor="club-name" className="mb-2 block text-sm font-medium text-foreground">
            Club Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="club-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder="e.g. McGill Robotics"
            disabled={submitting}
            className="border-border focus:ring-primary focus:border-primary"
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.name ? (
              <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.name}</p>
            ) : (
              <span />
            )}
            <p className="text-xs text-muted-foreground">{name.trim().length}/{MAX_NAME}</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="club-description" className="mb-2 block text-sm font-medium text-foreground">
            Description <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="club-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_DESC}
            rows={4}
            placeholder="Tell students what your club is about, what you do, and why they should join..."
            disabled={submitting}
            className="border-border focus:ring-primary focus:border-primary resize-none"
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.description}</p>
            ) : (
              <span />
            )}
            <p className={`text-xs ${description.trim().length > MAX_DESC * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
              {description.trim().length}/{MAX_DESC}
            </p>
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="club-category" className="mb-2 block text-sm font-medium text-foreground">
            Category <span className="text-destructive">*</span>
          </label>
          <select
            id="club-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={submitting}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select a category...</option>
            {CLUB_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1.5 text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{errors.category}</p>}
        </div>

        {/* Instagram Handle */}
        <div>
          <label htmlFor="club-instagram" className="mb-2 block text-sm font-medium text-foreground">
            Instagram Handle <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Instagram className="h-4 w-4" />
            </div>
            <Input
              id="club-instagram"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              placeholder="yourclub"
              disabled={submitting}
              className="pl-9 border-border focus:ring-primary focus:border-primary"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Students can find your club on Instagram</p>
        </div>

        {/* Social Links Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Social Links</h3>
            <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="club-website" className="mb-1.5 block text-sm text-muted-foreground">
              Website
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
              <Input
                id="club-website"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourclub.com"
                disabled={submitting}
                className="pl-9 border-border focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Discord */}
          <div>
            <label htmlFor="club-discord" className="mb-1.5 block text-sm text-muted-foreground">
              Discord
            </label>
            <Input
              id="club-discord"
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.gg/yourserver"
              disabled={submitting}
              className="border-border focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Twitter / X */}
          <div>
            <label htmlFor="club-twitter" className="mb-1.5 block text-sm text-muted-foreground">
              X / Twitter
            </label>
            <Input
              id="club-twitter"
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              placeholder="https://x.com/yourclub"
              disabled={submitting}
              className="border-border focus:ring-primary focus:border-primary"
            />
          </div>

          {/* LinkedIn */}
          <div>
            <label htmlFor="club-linkedin" className="mb-1.5 block text-sm text-muted-foreground">
              LinkedIn
            </label>
            <Input
              id="club-linkedin"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/company/yourclub"
              disabled={submitting}
              className="border-border focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Form Error */}
        {formError && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{formError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Club...
            </>
          ) : (
            "Submit for Review"
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          All clubs are reviewed before going live. This usually takes 1-2 business days.
        </p>
      </form>
    </div>
  );
}
