import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/ui/spotlight";
import {
  Search,
  Bookmark,
  Sparkles,
  CalendarCheck,
  Bell,
  Users,
  ArrowRight,
  Zap,
  Globe,
  Shield,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Smart Discovery",
    description:
      "Filter by category, date, or keyword. Academic talks, socials, sports — find exactly what fits your schedule.",
  },
  {
    icon: Bookmark,
    title: "Save & Track",
    description:
      "Bookmark events to your personal list. Never lose track of what caught your eye.",
  },
  {
    icon: Sparkles,
    title: "Personalized Feed",
    description:
      "The more you engage, the smarter your feed gets. Recommendations tuned to your interests.",
  },
  {
    icon: CalendarCheck,
    title: "One-Tap RSVP",
    description:
      "Let organizers know you're coming. RSVP directly and keep your plans organized.",
  },
  {
    icon: Bell,
    title: "Stay in the Loop",
    description:
      "Get notified about events from clubs you follow and friends you're connected with.",
  },
  {
    icon: Users,
    title: "Follow Clubs & Friends",
    description:
      "Build your campus network. Follow clubs for updates and see what events your friends are attending.",
  },
] as const;

const STEPS = [
  {
    number: "01",
    title: "Sign in with McGill",
    description: "Use your @mcgill.ca or @mail.mcgill.ca email. That's it — no extra accounts.",
  },
  {
    number: "02",
    title: "Pick your interests",
    description: "Select the categories you care about. Your feed adapts instantly.",
  },
  {
    number: "03",
    title: "Start exploring",
    description: "Browse what's happening now, this week, or filter by exactly what you want.",
  },
] as const;

const STATS = [
  { value: "6", label: "Event categories" },
  { value: "100+", label: "Campus clubs" },
  { value: "24/7", label: "Real-time updates" },
  { value: "Free", label: "Always" },
] as const;

/*
 * Glass utility classes:
 *   Light mode → dark glass (black tints on white background)
 *   Dark mode  → light glass (white tints on dark background)
 */
const glass = {
  card: "border-black/[0.08] bg-black/[0.03] dark:border-white/[0.08] dark:bg-white/[0.03] backdrop-blur-xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.05]",
  cardHover: "hover:bg-black/[0.06] dark:hover:bg-white/[0.06] hover:border-primary/20",
  icon: "bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] backdrop-blur-sm",
  iconHover: "group-hover:bg-primary/15 group-hover:border-primary/20",
  divider: "divide-black/[0.06] dark:divide-white/[0.06]",
  panel: "border-black/[0.08] bg-black/[0.03] dark:border-white/[0.12] dark:bg-white/[0.06] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.08]",
} as const;

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ─── Hero with Spotlight ─── */}
      <section
        className="relative w-full min-h-[80vh] flex items-end overflow-hidden bg-white bg-grid-black/[0.04] dark:bg-black/[0.96] dark:bg-grid-white/[0.02] antialiased"
      >
        <Spotlight
          className="-top-40 left-0 md:left-60 md:-top-20"
          fill="hsl(354 85% 52%)"
        />
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(237,27,47,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(237,27,47,0.12),transparent)]" />

        <div className="relative z-10 w-full px-6 md:px-10 lg:px-12 pb-28 md:pb-36 pt-32">
          <span className="inline-block px-5 py-2 bg-black/[0.06] dark:bg-white/10 backdrop-blur-xl text-foreground dark:text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-8 border border-black/[0.08] dark:border-white/20 shadow-xl">
            About UNI-VERSE
          </span>

          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8 max-w-4xl bg-clip-text text-transparent bg-gradient-to-b from-neutral-900 to-neutral-500 dark:from-neutral-50 dark:to-neutral-400">
            Your campus.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-red-400">
              One feed.
            </span>
          </h1>

          <p className="text-neutral-500 dark:text-neutral-300 text-lg lg:text-2xl font-medium max-w-2xl leading-relaxed">
            UNI-VERSE pulls every McGill event — clubs, workshops, parties, career fairs — into a
            single, personalized feed. Stop scrolling five Instagram pages. Start here.
          </p>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="relative z-20 -mt-6">
        <div className={`mx-6 md:mx-10 lg:mx-12 rounded-2xl ${glass.panel} shadow-2xl shadow-black/10`}>
          <div className={`grid grid-cols-2 md:grid-cols-4 ${glass.divider}`}>
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-6 md:py-8 text-center">
                <div className="text-3xl md:text-4xl font-black text-primary tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Mission ─── */}
      <section className="px-6 md:px-10 lg:px-12 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-12 bg-primary" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              Why we built this
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1] mb-8">
            McGill has 250+ clubs.
            <br />
            <span className="text-muted-foreground">Finding their events shouldn&apos;t be a scavenger hunt.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Events are scattered across Instagram stories, Facebook groups, mailing lists, and
            word of mouth. UNI-VERSE is a single source of truth — every approved event, searchable
            and filterable, with smart recommendations that learn what you actually care about.
          </p>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="px-6 md:px-10 lg:px-12 py-16 md:py-24 relative overflow-hidden">
        {/* Decorative blurs — warm red glows */}
        <div className="absolute -top-[15%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/8 blur-[150px]" />
        <div className="absolute -bottom-[15%] -left-[5%] w-[35%] h-[35%] rounded-full bg-primary/6 blur-[120px]" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-12 bg-primary" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              Get started in 60 seconds
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1] mb-14">
            Three steps. Zero friction.
          </h2>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {STEPS.map((step, i) => (
              <div key={step.number} className="group relative rounded-2xl border border-primary/10 bg-primary/[0.03] backdrop-blur-xl p-6 md:p-8 transition-all duration-300 hover:border-primary/25 hover:bg-primary/[0.06] hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
                {/* Step number with primary gradient */}
                <div className="text-7xl md:text-8xl font-black bg-gradient-to-br from-primary/20 to-primary/5 bg-clip-text text-transparent group-hover:from-primary/35 group-hover:to-primary/10 transition-all duration-300 leading-none mb-4">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 -mt-4">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="px-6 md:px-10 lg:px-12 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-12 bg-primary" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              What you get
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1] mb-14">
            Everything you need.
            <br />
            <span className="text-muted-foreground">Nothing you don&apos;t.</span>
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`group relative rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 ${glass.card} ${glass.cardHover}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 ${glass.icon} ${glass.iconHover}`}>
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Built Different ─── */}
      <section className="px-6 md:px-10 lg:px-12 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute top-[10%] -left-[5%] w-[25%] h-[25%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[5%] w-[30%] h-[30%] rounded-full bg-primary/4 blur-[120px]" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-12 bg-primary" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              How it&apos;s different
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1] mb-14">
            Not another events page.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Recommendations that learn", desc: "Our engine tracks what you save and engage with, then surfaces events you\u2019d actually attend \u2014 not just what\u2019s popular." },
              { icon: Globe, title: "Every club, one place", desc: "No more checking ten different platforms. If a McGill club is hosting it, it\u2019s here \u2014 searchable, categorized, and ready." },
              { icon: Shield, title: "McGill-verified only", desc: "Every event goes through a moderation pipeline. McGill email required to post or interact. No spam, no noise." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`group rounded-2xl p-6 md:p-8 transition-all duration-300 space-y-4 ${glass.card} ${glass.cardHover}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${glass.icon} ${glass.iconHover}`}>
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 md:px-10 lg:px-12 py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(237,27,47,0.06),transparent)]" />
        <div className={`max-w-3xl mx-auto text-center relative z-10 rounded-3xl p-10 md:p-14 shadow-2xl shadow-black/5 ${glass.panel}`}>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1] mb-6">
            Ready to see what&apos;s happening?
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl mx-auto">
            Sign in with your McGill email and start exploring. Your personalized campus feed is
            one click away.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="gap-2 px-8 py-6 text-lg font-bold rounded-2xl shadow-xl shadow-primary/25">
              <Link href="/">
                Explore Events
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 px-8 py-6 text-lg font-bold rounded-2xl">
              <Link href="/clubs">
                Browse Clubs
                <ChevronRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Have questions?{" "}
            <Link href="/help" className="text-primary hover:underline font-medium">
              Check our FAQ
            </Link>
          </p>
        </div>
      </section>

      {/* ─── Attribution ─── */}
      <section className="px-6 md:px-10 lg:px-12 pb-16 pt-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Built by{" "}
            <span className="font-bold text-foreground">GDG McGill</span>
            {" "}& powered by{" "}
            <span className="font-bold text-foreground">Apollo Labs</span>
          </p>
          <p className="text-xs text-muted-foreground/70">
            Made for students, by students at McGill University.
          </p>
        </div>
      </section>
    </div>
  );
}
