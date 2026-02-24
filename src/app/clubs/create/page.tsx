"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, ArrowLeft, CheckCircle, Upload, Link2, X } from "lucide-react";
import Link from "next/link";
import { EVENT_CATEGORIES } from "@/lib/constants";

const CATEGORY_OPTIONS = Object.entries(EVENT_CATEGORIES).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

export default function CreateClubPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoMode, setLogoMode] = useState<"upload" | "url">("upload");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          category,
          instagram_handle: instagramHandle || null,
          logo_url: logoUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create club");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto text-center py-20">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Club Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Your club has been submitted for admin review. You&apos;ll be notified
            once it&apos;s approved.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/clubs">
              <Button variant="outline">Browse Clubs</Button>
            </Link>
            <Button onClick={() => { setSuccess(false); setName(""); setDescription(""); setCategory(""); setInstagramHandle(""); setLogoUrl(""); setLogoPreview(null); }}>
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/clubs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clubs
      </Link>

      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Building2 className="h-7 w-7" />
          Create a Club
        </h1>
        <p className="text-muted-foreground mb-6">
          Register a new club or organization. An admin will review your
          submission before it goes live.
        </p>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="club-name" className="text-sm font-semibold text-foreground">
                Club Name <span className="text-destructive">*</span>
              </label>
              <input
                id="club-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. McGill Robotics"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="club-category" className="text-sm font-semibold text-foreground">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                id="club-category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a category</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="club-description" className="text-sm font-semibold text-foreground">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="club-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what your club does..."
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="club-instagram" className="text-sm font-semibold text-foreground">
                Instagram Handle{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="club-instagram"
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="e.g. mcgillrobotics"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Logo{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>

              {/* Logo preview */}
              {logoPreview && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-input bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded-full object-cover" />
                  <span className="text-sm text-muted-foreground flex-1 truncate">Logo uploaded</span>
                  <button type="button" onClick={() => { setLogoPreview(null); setLogoUrl(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!logoPreview && (
                <>
                  {/* Toggle between upload and URL */}
                  <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
                    <button type="button" onClick={() => setLogoMode("upload")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${logoMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                      <Upload className="h-3 w-3 inline mr-1" />Upload
                    </button>
                    <button type="button" onClick={() => setLogoMode("url")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${logoMode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                      <Link2 className="h-3 w-3 inline mr-1" />URL
                    </button>
                  </div>

                  {logoMode === "upload" ? (
                    <div className="relative">
                      <input
                        id="club-logo-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={logoUploading}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLogoUploading(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/clubs/logo", { method: "POST", body: fd });
                            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Upload failed"); }
                            const data = await res.json();
                            setLogoUrl(data.url);
                            setLogoPreview(data.url);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Logo upload failed");
                          } finally {
                            setLogoUploading(false);
                          }
                        }}
                      />
                      <label
                        htmlFor="club-logo-file"
                        className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-input bg-background px-3 py-4 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      >
                        {logoUploading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                        ) : (
                          <><Upload className="h-4 w-4" />Click to upload logo (max 5MB)</>
                        )}
                      </label>
                    </div>
                  ) : (
                    <input
                      id="club-logo-url"
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  )}
                </>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Club for Review"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
