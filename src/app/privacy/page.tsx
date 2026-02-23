import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Uni-Verse collects, uses, and protects your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <section className="relative w-full pt-20 pb-16 md:pt-28 md:pb-20 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-[1.1]">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: February 23, 2026
          </p>
        </div>
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              1. Introduction
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Uni-Verse (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a
              campus event discovery platform built by GDG McGill for students at
              McGill University. This Privacy Policy explains how we collect,
              use, and protect your personal information when you use our
              platform.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              2. Information We Collect
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We collect the following information when you use Uni-Verse:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Account information:</strong>{" "}
                Your McGill email address, name, and profile avatar when you sign
                in through our authentication system.
              </li>
              <li>
                <strong className="text-foreground">Interest tags:</strong> The
                event categories you select during onboarding (e.g., academic,
                social, sports, career, cultural, wellness).
              </li>
              <li>
                <strong className="text-foreground">Event interactions:</strong>{" "}
                Events you view, save, RSVP to, or share, used to provide
                personalized recommendations.
              </li>
              <li>
                <strong className="text-foreground">Event submissions:</strong>{" "}
                If you submit events as a club organizer, the event details you
                provide (title, description, date, location, images).
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>To authenticate your McGill student identity</li>
              <li>
                To provide personalized event recommendations based on your
                interests and saved events
              </li>
              <li>
                To send you event reminders and notifications you have opted into
              </li>
              <li>To display your saved events and RSVP history</li>
              <li>To improve the platform based on aggregated usage patterns</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              4. Data Storage & Security
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using{" "}
              <strong className="text-foreground">Supabase</strong>, a
              SOC2-compliant database platform with built-in Row Level Security
              (RLS) policies. Authentication is handled through Supabase Auth.
              All data is transmitted over HTTPS. We do not sell, rent, or share
              your personal data with third parties for marketing purposes.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              5. McGill Email Requirement
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Uni-Verse requires a valid McGill email address (
              <span className="font-medium text-foreground">@mcgill.ca</span> or{" "}
              <span className="font-medium text-foreground">
                @mail.mcgill.ca
              </span>
              ) to create an account. This ensures that only McGill community
              members can access authenticated features such as saving events,
              RSVPs, and personalized recommendations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              6. Cookies & Local Storage
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We use browser cookies and local storage for authentication
              sessions and theme preferences (light/dark mode). We do not use
              third-party tracking cookies or advertising pixels.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              7. Your Rights
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you</li>
              <li>
                Request correction of inaccurate data
              </li>
              <li>Request deletion of your account and associated data</li>
              <li>
                Opt out of event reminder notifications at any time
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:support@uni-verse.app"
                className="text-primary hover:underline"
              >
                support@uni-verse.app
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              8. Data Retention
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. If you
              request account deletion, we will remove your personal data within
              30 days. Anonymized, aggregated analytics data may be retained
              indefinitely.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              9. Changes to This Policy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify
              users of significant changes via email or an in-app notification.
              Continued use of Uni-Verse after changes constitutes acceptance of
              the updated policy.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              10. Contact Us
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us
              at{" "}
              <a
                href="mailto:support@uni-verse.app"
                className="text-primary hover:underline"
              >
                support@uni-verse.app
              </a>
              .
            </p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              &middot;{" "}
              <Link href="/feedback" className="text-primary hover:underline">
                Send Feedback
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
