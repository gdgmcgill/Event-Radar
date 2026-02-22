"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import { useAuthStore } from "@/store/useAuthStore";
import type { EventTag } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedTags, setSelectedTags] = useState<EventTag[]>([]);
  const [saving, setSaving] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const isValid = selectedTags.length >= 3 && selectedTags.length <= 5;

  async function handleContinue() {
    if (!isValid) return;
    setSaving(true);

    try {
      // Save interest tags
      const res = await fetch("/api/profile/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest_tags: selectedTags }),
      });

      if (!res.ok) {
        console.error("[Onboarding] Failed to save interests:", await res.text());
      }

      // Update auth store with new tags
      useAuthStore.setState((state) => ({
        user: state.user
          ? { ...state.user, interest_tags: selectedTags as string[] }
          : state.user,
      }));

      // Clear onboarding cookie
      await fetch("/api/onboarding/complete", { method: "POST" });

      router.push("/");
    } catch (err) {
      console.error("[Onboarding] Error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("[Onboarding] Skip error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {firstName}!
          </h1>
          <p className="text-muted-foreground">
            Pick 3–5 interests so we can show you the most relevant events on campus.
          </p>
        </div>

        <InterestTagSelector
          selected={selectedTags}
          onChange={setSelectedTags}
          min={3}
          max={5}
        />

        <div className="flex flex-col gap-3">
          <button
            onClick={handleContinue}
            disabled={!isValid || saving}
            className="w-full rounded-lg bg-[#ED1B2F] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
