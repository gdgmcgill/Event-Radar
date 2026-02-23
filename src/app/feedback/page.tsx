"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Bug, Lightbulb, CheckCircle } from "lucide-react";

type FeedbackType = "bug" | "feature" | "general";

const FEEDBACK_TYPES: {
  value: FeedbackType;
  label: string;
  icon: typeof Bug;
  description: string;
}[] = [
  {
    value: "bug",
    label: "Bug Report",
    icon: Bug,
    description: "Something isn't working correctly",
  },
  {
    value: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Suggest an improvement or new feature",
  },
  {
    value: "general",
    label: "General Feedback",
    icon: MessageSquare,
    description: "Share your thoughts about Uni-Verse",
  },
];

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, message }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        // Fallback to mailto if API fails
        openMailto();
      }
    } catch {
      // Fallback to mailto if API fails
      openMailto();
    } finally {
      setSubmitting(false);
    }
  }

  function openMailto() {
    const subjectLine = subject
      ? `[${type}] ${subject}`
      : `[${type}] Beta Feedback`;
    const body = message;
    window.open(
      `mailto:support@uni-verse.app?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    );
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Thanks for your feedback!
              </h2>
              <p className="text-muted-foreground">
                Your feedback helps us improve Uni-Verse for the McGill
                community. We&apos;ll review it and follow up if needed.
              </p>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setSubject("");
                  setMessage("");
                }}
                variant="outline"
              >
                Submit More Feedback
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <section className="relative w-full pt-20 pb-16 md:pt-28 md:pb-20 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-[1.1]">
            Send Feedback
          </h1>
          <p className="text-lg text-muted-foreground">
            Help us improve Uni-Verse during our beta. Report bugs, suggest
            features, or share your thoughts.
          </p>
        </div>
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 max-w-2xl -mt-8 relative z-20">
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Feedback Type Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Feedback Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FEEDBACK_TYPES.map((ft) => {
                    const Icon = ft.icon;
                    const isSelected = type === ft.value;
                    return (
                      <button
                        key={ft.value}
                        type="button"
                        onClick={() => setType(ft.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border text-center transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-border/80 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${isSelected ? "text-primary" : ""}`}
                        />
                        <span className="text-sm font-medium">{ft.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {ft.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label
                  htmlFor="subject"
                  className="text-sm font-medium text-foreground"
                >
                  Subject{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label
                  htmlFor="message"
                  className="text-sm font-medium text-foreground"
                >
                  Message <span className="text-primary">*</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder={
                    type === "bug"
                      ? "What happened? What did you expect? Steps to reproduce..."
                      : type === "feature"
                        ? "Describe the feature you'd like to see..."
                        : "Share your thoughts about Uni-Verse..."
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Or email us directly at{" "}
                  <a
                    href="mailto:support@uni-verse.app"
                    className="text-primary hover:underline"
                  >
                    support@uni-verse.app
                  </a>
                </p>
                <Button type="submit" disabled={!message.trim() || submitting}>
                  {submitting ? "Sending..." : "Submit Feedback"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
