import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms and conditions for using the Uni-Verse campus event platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <section className="relative w-full pt-20 pb-16 md:pt-28 md:pb-20 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-[1.1]">
            Terms of Service
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
              1. Acceptance of Terms
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Uni-Verse (&quot;the Platform&quot;), you
              agree to be bound by these Terms of Service. If you do not agree to
              these terms, please do not use the Platform. Uni-Verse is operated
              by GDG McGill for the McGill University community.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              2. Eligibility
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Uni-Verse is available to members of the McGill University
              community. To access authenticated features (saving events, RSVPs,
              recommendations, event submission), you must sign in with a valid
              McGill email address (
              <span className="font-medium text-foreground">@mcgill.ca</span> or{" "}
              <span className="font-medium text-foreground">
                @mail.mcgill.ca
              </span>
              ). Browsing events is available to all visitors.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              3. User Accounts
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                You are responsible for maintaining the security of your account.
              </li>
              <li>
                You may not share your account credentials with others.
              </li>
              <li>
                You must provide accurate information when creating your account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that
                violate these terms.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              4. Event Submissions
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              If you are a club organizer submitting events to Uni-Verse:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                You must provide accurate event information including title,
                date, time, location, and description.
              </li>
              <li>
                Events must be relevant to the McGill University community.
              </li>
              <li>
                Events promoting illegal activities, discrimination, or
                harassment are strictly prohibited.
              </li>
              <li>
                Submitted events are subject to review and approval by platform
                administrators.
              </li>
              <li>
                We reserve the right to reject or remove any event at our
                discretion.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              5. Acceptable Use
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              When using Uni-Verse, you agree not to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Submit false, misleading, or spam event listings
              </li>
              <li>
                Attempt to access other users&apos; accounts or personal data
              </li>
              <li>
                Use automated tools to scrape data from the Platform without
                permission
              </li>
              <li>
                Interfere with the Platform&apos;s operation or infrastructure
              </li>
              <li>
                Use the Platform for commercial advertising unrelated to McGill
                campus life
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              6. Intellectual Property
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The Uni-Verse platform, including its design, code, and branding,
              is the property of GDG McGill. Event content submitted by
              organizers remains the property of the respective clubs and
              organizations. By submitting an event, you grant us a
              non-exclusive license to display it on the Platform.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              7. Disclaimers
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Uni-Verse is provided &quot;as is&quot; without warranties of any
                kind, express or implied.
              </li>
              <li>
                We do not guarantee the accuracy of event information submitted
                by third-party organizers.
              </li>
              <li>
                We are not responsible for the content, safety, or quality of
                events listed on the Platform.
              </li>
              <li>
                Event attendance is at your own risk. Uni-Verse is a discovery
                tool, not an event organizer.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              8. Limitation of Liability
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, GDG McGill and the
              Uni-Verse team shall not be liable for any indirect, incidental, or
              consequential damages arising from your use of the Platform. Our
              total liability shall not exceed the amount you have paid to use
              the Platform (which is $0, as Uni-Verse is free).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              9. Termination
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your access to Uni-Verse at any time
              for violation of these terms or for any other reason at our
              discretion. You may delete your account at any time by contacting
              us at{" "}
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
              10. Changes to These Terms
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms of Service at any time. We will notify
              users of material changes via email or in-app notification.
              Continued use of the Platform after changes constitutes acceptance
              of the revised terms.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-3">
              11. Contact
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, contact us at{" "}
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
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
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
