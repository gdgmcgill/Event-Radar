"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import { PRONOUNS, YEARS, FACULTIES } from "@/lib/constants";
import type { EventTag } from "@/types";
import { ChevronRight, ChevronLeft, Sparkles, Check } from "lucide-react";

type OnboardingWizardProps = {
  userId: string;
  initialName: string;
  avatarUrl: string | null;
};

export function OnboardingWizard({
  userId,
  initialName,
  avatarUrl,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [pronouns, setPronouns] = useState("");
  const [year, setYear] = useState("");
  const [faculty, setFaculty] = useState("");
  const [tags, setTags] = useState<EventTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;
  const firstName = name.split(" ")[0] || "there";

  const canProceed = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return name.trim().length >= 2;
      case 2:
        return tags.length >= 3 && tags.length <= 5;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Final step — save everything
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pronouns: pronouns || null,
          year: year || null,
          faculty: faculty || null,
          interest_tags: tags,
          onboarding_completed: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= step
                  ? "w-8 bg-[#ED1B2F]"
                  : "w-2 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Step {step + 1} of {totalSteps}
        </p>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="Your avatar"
                className="mx-auto h-24 w-24 rounded-full border-4 border-[#ED1B2F]/20"
              />
            )}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome to Uni-Verse{firstName !== "there" ? `, ${firstName}` : ""}!
              </h1>
              <p className="text-muted-foreground">
                Let&apos;s set up your profile so you can discover the best events on campus.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                The basics
              </h2>
              <p className="text-muted-foreground">
                Tell us a bit about yourself.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="ob-name" className="text-sm font-medium">
                  Display Name
                </label>
                <Input
                  id="ob-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
                {name.trim().length > 0 && name.trim().length < 2 && (
                  <p className="text-sm text-red-500">Name must be at least 2 characters.</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="ob-pronouns" className="text-sm font-medium">
                  Pronouns
                </label>
                <select
                  id="ob-pronouns"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select pronouns...</option>
                  {PRONOUNS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="ob-year" className="text-sm font-medium">
                  Year
                </label>
                <select
                  id="ob-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select year...</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="ob-faculty" className="text-sm font-medium">
                  Faculty <span className="text-muted-foreground">(optional)</span>
                </label>
                <select
                  id="ob-faculty"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select faculty...</option>
                  {FACULTIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-[#ED1B2F]" />
                Your interests
              </h2>
              <p className="text-muted-foreground">
                Pick 3-5 interests so we can show you the most relevant events.
              </p>
            </div>

            <InterestTagSelector
              selected={tags}
              onChange={setTags}
              min={3}
              max={5}
            />
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                You&apos;re all set!
              </h2>
              <p className="text-muted-foreground">
                Your profile is ready. Start discovering events on campus.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={saving}
              className="flex-1"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className={`flex-1 bg-[#ED1B2F] hover:bg-[#ED1B2F]/90 text-white ${step === 0 ? "w-full" : ""}`}
          >
            {saving
              ? "Saving..."
              : step === 3
                ? "Browse Events"
                : "Continue"}
            {!saving && step < 3 && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
