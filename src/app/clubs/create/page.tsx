"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
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
            <Button onClick={() => { setSuccess(false); setName(""); setDescription(""); setCategory(""); setInstagramHandle(""); setLogoUrl(""); }}>
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
              <label htmlFor="club-logo" className="text-sm font-semibold text-foreground">
                Logo URL{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="club-logo"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
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
