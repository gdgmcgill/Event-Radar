"use client";

/**
 * Help / FAQ page — Issue #176
 * Accessible at /help. Covers all required topics with a searchable,
 * accordion-style layout. No extra dependencies — built with Tailwind + React state.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Search,
  LogIn,
  Bookmark,
  Bell,
  CalendarCheck,
  Building2,
  Plus,
  Sparkles,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "universe.mcgill@gmail.com";

// ─── Data ────────────────────────────────────────────────────────────────────

interface FAQ {
  question: string;
  answer: React.ReactNode;
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  faqs: FAQ[];
}

const SECTIONS: Section[] = [
  {
    id: "signup",
    title: "Signing Up",
    icon: LogIn,
    faqs: [
      {
        question: "Who can sign up for UNI-VERSE?",
        answer: (
          <p>
            UNI-VERSE is open to all McGill University community members. You
            must have a valid McGill email address ending in{" "}
            <code className="bg-muted px-1 rounded text-sm">@mcgill.ca</code>{" "}
            or{" "}
            <code className="bg-muted px-1 rounded text-sm">
              @mail.mcgill.ca
            </code>{" "}
            to create an account.
          </p>
        ),
      },
      {
        question: "How do I sign in?",
        answer: (
          <p>
            Click the <strong>Sign In</strong> button in the top-right corner
            (or in the sidebar on desktop). You&apos;ll be redirected to
            McGill&apos;s Microsoft login page. Enter your McGill credentials
            and you&apos;ll be signed in automatically — no separate password
            needed for UNI-VERSE.
          </p>
        ),
      },
      {
        question: "Why do I need a McGill email?",
        answer: (
          <p>
            The McGill email requirement ensures that only current McGill
            students, staff, and faculty can access features like saving events,
            RSVPs, and personalised recommendations. It also keeps the community
            relevant and safe for everyone on campus.
          </p>
        ),
      },
    ],
  },
  {
    id: "saved-events",
    title: "Saving & Managing Events",
    icon: Bookmark,
    faqs: [
      {
        question: "How do I save an event?",
        answer: (
          <p>
            On any event card, tap or click the{" "}
            <strong>heart (♡) icon</strong>. The icon will fill in to confirm
            the event is saved. You must be signed in to save events.
          </p>
        ),
      },
      {
        question: "Where can I see my saved events?",
        answer: (
          <p>
            Go to{" "}
            <Link href="/my-events" className="text-primary hover:underline">
              My Events
            </Link>{" "}
            from the sidebar or the mobile menu. All the events you&apos;ve
            bookmarked will appear there, and you can sort them by recently
            saved, event date, or title.
          </p>
        ),
      },
      {
        question: "How do I unsave an event?",
        answer: (
          <p>
            Click the filled <strong>heart icon</strong> on any saved event
            card (on the main feed or in My Events) to remove it from your
            saved list.
          </p>
        ),
      },
    ],
  },
  {
    id: "reminders",
    title: "Reminders & Notifications",
    icon: Bell,
    faqs: [
      {
        question: "How do email reminders work?",
        answer: (
          <p>
            When you save or RSVP to an event, UNI-VERSE can send you an email
            reminder before the event starts. You can control whether you
            receive reminders from your{" "}
            <Link href="/profile" className="text-primary hover:underline">
              profile settings
            </Link>{" "}
            at any time.
          </p>
        ),
      },
      {
        question: "How do I turn off notifications?",
        answer: (
          <p>
            Open your{" "}
            <Link href="/profile" className="text-primary hover:underline">
              profile page
            </Link>{" "}
            and toggle off <strong>Email Notifications</strong>. You can also
            click the <strong>Unsubscribe</strong> link at the bottom of any
            reminder email we send you.
          </p>
        ),
      },
      {
        question: "What kinds of notifications will I receive?",
        answer: (
          <ul className="list-disc list-inside space-y-1">
            <li>Event reminders for saved or RSVP&apos;d events</li>
            <li>Updates if an event you saved is cancelled or rescheduled</li>
            <li>
              New event alerts matching your interest tags (if enabled in
              settings)
            </li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "rsvp",
    title: "RSVPs",
    icon: CalendarCheck,
    faqs: [
      {
        question: "How do I RSVP to an event?",
        answer: (
          <p>
            Open an event detail page and click <strong>RSVP</strong>. You must
            be signed in. After RSVP&apos;ing, the event will appear in your My
            Events list and you&apos;ll receive a reminder if notifications are
            on.
          </p>
        ),
      },
      {
        question: "Can I cancel my RSVP?",
        answer: (
          <p>
            Yes — go to{" "}
            <Link href="/my-events" className="text-primary hover:underline">
              My Events
            </Link>{" "}
            or re-open the event detail page and click{" "}
            <strong>Cancel RSVP</strong>.
          </p>
        ),
      },
      {
        question: "Do organisers see who has RSVP'd?",
        answer: (
          <p>
            Club organisers can see aggregate RSVP counts for their events.
            Individual RSVP lists are only visible to the organiser of that
            specific event and platform admins.
          </p>
        ),
      },
    ],
  },
  {
    id: "organizer",
    title: "Club Organizer Access",
    icon: Building2,
    faqs: [
      {
        question: "How do I request organizer access?",
        answer: (
          <p>
            Email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            with your McGill club name, your role in the club, and a brief
            description. We&apos;ll review the request and grant organizer
            access within 3–5 business days.
          </p>
        ),
      },
      {
        question: "What can organizers do that regular users can't?",
        answer: (
          <ul className="list-disc list-inside space-y-1">
            <li>Submit new events for admin review</li>
            <li>Manage their club&apos;s profile and upcoming events</li>
            <li>View RSVP counts and engagement stats for their events</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "create-event",
    title: "Creating Events",
    icon: Plus,
    faqs: [
      {
        question: "How do I create an event?",
        answer: (
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Make sure you have{" "}
              <strong>organizer access</strong> (see above).
            </li>
            <li>
              Click{" "}
              <Link
                href="/create-event"
                className="text-primary hover:underline"
              >
                Create Event
              </Link>{" "}
              in the sidebar.
            </li>
            <li>
              Fill in the event title, description, date, time, location,
              tags, and an optional banner image.
            </li>
            <li>
              Submit for review — an admin will approve or reject the event,
              typically within 24 hours.
            </li>
          </ol>
        ),
      },
      {
        question: "Why is my event not showing up yet?",
        answer: (
          <p>
            All submitted events go through an approval process to keep
            the feed high-quality. Your event will appear publicly once an
            admin approves it. You&apos;ll receive an email notification when
            the status changes.
          </p>
        ),
      },
      {
        question: "What image sizes work best?",
        answer: (
          <p>
            We recommend a banner image with a{" "}
            <strong>16:9 aspect ratio</strong> (e.g. 1280×720 px) in JPG or
            PNG format, under 5 MB. Images are automatically resized for
            display.
          </p>
        ),
      },
    ],
  },
  {
    id: "recommendations",
    title: "Recommendations & Interest Tags",
    icon: Sparkles,
    faqs: [
      {
        question: "How does the recommendation feed work?",
        answer: (
          <p>
            UNI-VERSE surfaces events based on the interest tags you selected
            during onboarding (Academic, Social, Sports, Career, Cultural,
            Wellness). Events matching your tags are ranked higher in your
            feed. As you save and interact with events, the recommendations
            improve over time.
          </p>
        ),
      },
      {
        question: "How do I change my interest tags?",
        answer: (
          <p>
            Go to your{" "}
            <Link href="/profile" className="text-primary hover:underline">
              profile page
            </Link>{" "}
            and update your interest tags at any time. Changes take effect
            immediately.
          </p>
        ),
      },
      {
        question: "Can I browse all events regardless of my tags?",
        answer: (
          <p>
            Yes! Use the category filters and search bar on the{" "}
            <Link href="/" className="text-primary hover:underline">
              home page
            </Link>{" "}
            to browse or search all upcoming events. Your interest tags only
            affect the default sort order of your feed.
          </p>
        ),
      },
    ],
  },
  {
    id: "contact",
    title: "Contact & Support",
    icon: Mail,
    faqs: [
      {
        question: "How do I contact support?",
        answer: (
          <p>
            Email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We aim to respond within 5 business days.
          </p>
        ),
      },
      {
        question: "I found a bug — how do I report it?",
        answer: (
          <p>
            Please use the{" "}
            <Link href="/feedback" className="text-primary hover:underline">
              Send Feedback
            </Link>{" "}
            page to describe the bug (what you did, what you expected, and
            what happened instead). Screenshots are always helpful!
          </p>
        ),
      },
      {
        question: "Where can I read the Privacy Policy?",
        answer: (
          <p>
            Our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            explains what data we collect and how we use it.
          </p>
        ),
      },
    ],
  },
  {
    id: "feedback",
    title: "Submitting Feedback",
    icon: MessageSquare,
    faqs: [
      {
        question: "How do I submit feedback or a feature request?",
        answer: (
          <p>
            Head to the{" "}
            <Link href="/feedback" className="text-primary hover:underline">
              Send Feedback
            </Link>{" "}
            page from the footer or support menu. We read every submission and
            use your input to prioritise upcoming features.
          </p>
        ),
      },
      {
        question: "Will I hear back about my feedback?",
        answer: (
          <p>
            We may follow up by email if we need more details or want to let
            you know your suggestion has been implemented. We can&apos;t
            guarantee a reply to every message, but we do read them all.
          </p>
        ),
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccordionItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
        aria-expanded={isOpen}
      >
        <span>{faq.question}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="pb-4 text-sm text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          {faq.answer}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  section,
  openKeys,
  onToggle,
}: {
  section: Section;
  openKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const Icon = section.icon;
  return (
    <div
      id={section.id}
      className="rounded-xl border bg-card p-6 scroll-mt-24"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {section.title}
        </h2>
      </div>
      <div className="divide-y">
        {section.faqs.map((faq, i) => {
          const key = `${section.id}-${i}`;
          return (
            <AccordionItem
              key={key}
              faq={faq}
              isOpen={openKeys.has(key)}
              onToggle={() => onToggle(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Filter sections/FAQs by search query
  const filteredSections = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.flatMap((section) => {
      const matchedFaqs = section.faqs.filter((faq) =>
        faq.question.toLowerCase().includes(q)
      );
      if (matchedFaqs.length === 0) return [];
      return [{ ...section, faqs: matchedFaqs }];
    });
  }, [query]);

  // Auto-expand all items when searching
  const displayOpenKeys = useMemo(() => {
    if (!query.trim()) return openKeys;
    const allKeys = new Set<string>();
    filteredSections.forEach((section) => {
      section.faqs.forEach((_, i) => allKeys.add(`${section.id}-${i}`));
    });
    return allKeys;
  }, [query, filteredSections, openKeys]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero */}
      <section className="relative w-full pt-20 pb-16 md:pt-28 md:pb-20 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-[1.1]">
            Help & FAQ
          </h1>
          <p className="text-muted-foreground mb-8">
            Everything you need to know about UNI-VERSE. Can&apos;t find your
            answer?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              Email us
            </a>
            .
          </p>

          {/* Search */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search questions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Background blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-12 max-w-3xl">
        {filteredSections.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-2">No results found</p>
            <p className="text-sm">
              Try a different keyword or{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary hover:underline"
              >
                contact us
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                openKeys={displayOpenKeys}
                onToggle={toggleKey}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 rounded-xl border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            Still need help?
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Our team is happy to help with anything not covered above.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Email Support
            </a>
            <Link
              href="/feedback"
              className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Send Feedback
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
