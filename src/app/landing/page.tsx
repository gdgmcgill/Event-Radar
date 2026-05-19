"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookmarkCheck,
  Calendar,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Menu,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CONTACT_EMAILS } from "@/lib/contact";
import { Iphone16Pro } from "@/components/ui/iphone-16-pro";

/* ─── Scroll-reveal hook ─── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- one-time init for reduced motion
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Constants ─── */

const NAV_ITEMS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#organizers", label: "For Organizers" },
];

const CLUBS_MARQUEE = [
  "GDG McGill",
  "SSMU",
  "McGill Outdoors Club",
  "Engineering Society",
  "Arts Undergraduate Society",
  "Management Undergraduate Society",
  "McGill Debating Union",
  "McGill AI Society",
  "McGill Robotics",
  "Music Undergraduate Society",
];

/* ─── Page ─── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <Hero />
      <TrustedByMarquee />
      <Features />
      <HowItWorks />
      <OrganizerSection />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}

/* ─── Header ─── */

function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between">
        {/* Logo */}
        <Link href="/landing" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo/uni-verse-logo-primary.png"
            alt="UNI-VERSE logo"
            width={36}
            height={36}
            className="h-8 w-8 sm:h-9 sm:w-9"
          />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-black tracking-widest text-foreground uppercase leading-none">
              UNI-VERSE
            </span>
            <span className="text-[9px] font-medium text-muted-foreground tracking-wide hidden sm:block">
              McGill University
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex text-sm font-bold text-foreground hover:text-primary transition-colors duration-200 cursor-pointer"
          >
            Sign In
          </Link>
          <Link
            href="/"
            className="bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all duration-200 cursor-pointer"
          >
            Get Started
          </Link>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors duration-200 cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-background px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="block text-sm font-semibold py-3 px-3 rounded-lg hover:bg-accent transition-colors duration-200 cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/"
            className="block text-sm font-semibold py-3 px-3 rounded-lg text-primary hover:bg-primary/5 transition-colors duration-200 cursor-pointer"
            onClick={() => setMobileOpen(false)}
          >
            Sign In
          </Link>
        </nav>
      )}
    </header>
  );
}

/* ─── Hero ─── */

function Hero() {
  const { ref, visible } = useReveal(0.1);

  return (
    <section className="relative pt-12 sm:pt-20 lg:pt-28 pb-16 sm:pb-24 overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px]" />
      </div>

      <div
        ref={ref}
        className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        {/* Left — copy */}
        <div
          className={`transition-all duration-1000 ease-out ${
            visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6 border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            NOW LIVE AT MCGILL
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            Discover What&apos;s{" "}
            <span className="text-primary">Happening</span> on Campus
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl">
            Your central hub for McGill events. Browse, RSVP, and never miss a
            campus moment, from club socials to guest lectures, all in one
            place.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link
              href="/"
              className="h-12 sm:h-14 px-6 sm:px-8 bg-primary text-primary-foreground text-base sm:text-lg font-bold rounded-2xl shadow-xl shadow-primary/25 flex items-center justify-center gap-2 hover:brightness-110 transition-all duration-200 cursor-pointer"
            >
              Explore Events <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/"
              className="h-12 sm:h-14 px-6 sm:px-8 bg-secondary text-secondary-foreground text-base sm:text-lg font-bold rounded-2xl border border-border flex items-center justify-center gap-2 hover:bg-accent transition-colors duration-200 cursor-pointer"
            >
              Browse Clubs
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <Zap className="w-4 h-4" />
              Free for all McGill students
            </div>
            <span className="text-border">·</span>
            <span>McGill email required</span>
          </div>
        </div>

        {/* Right — app preview */}
        <div
          className={`relative hidden lg:block transition-all duration-1000 ease-out delay-300 ${
            visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-16"
          }`}
        >
          {/* Glow */}
          <div className="absolute -inset-12 bg-gradient-to-tr from-primary/15 via-transparent to-primary/10 rounded-full blur-[80px]" />

          {/* iPhone 16 Pro with live app content */}
          <div className="relative mx-auto w-[300px] h-[600px]">
            {/* Live app content rendered behind the frame */}
            <div
              className="absolute bg-background overflow-hidden"
              style={{
                top: "3.2%",
                left: "7%",
                width: "86%",
                height: "93.6%",
                borderRadius: "24px",
              }}
            >
              <PhoneScreenContent />
            </div>

            {/* iPhone frame overlay */}
            <Iphone16Pro
              width={300}
              height={600}
              className="relative z-10 pointer-events-none text-transparent drop-shadow-2xl"
            />

            {/* Phone shadow */}
            <div className="absolute -bottom-4 left-[15%] right-[15%] h-6 bg-black/20 dark:bg-black/40 rounded-full blur-xl" />
          </div>

          {/* Floating notification card */}
          <div className="absolute z-20 top-16 -left-8 bg-card border border-border rounded-2xl p-3.5 shadow-xl shadow-black/5 dark:shadow-black/20 motion-safe:animate-float max-w-[200px]">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-foreground">
                  New event near you
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Open Mic Night at Gerts, tonight at 8 PM
                </p>
              </div>
            </div>
          </div>

          {/* Floating RSVP card */}
          <div className="absolute z-20 bottom-24 -right-4 bg-card border border-border rounded-2xl p-3.5 shadow-xl shadow-black/5 dark:shadow-black/20 motion-safe:animate-float [animation-delay:1.5s] max-w-[180px]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookmarkCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-foreground">
                  RSVP confirmed!
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  You&apos;re going to DevFest
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Phone Screen Content (rendered inside iPhone frame) ─── */

function PhoneScreenContent() {
  return (
    <div className="w-full h-full flex flex-col text-foreground">
      {/* Status bar */}
      <div className="h-12 flex items-end justify-between px-6 pb-1 flex-shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground">
          9:41
        </span>
        <div className="flex gap-1">
          <div className="w-3.5 h-2 rounded-sm bg-muted-foreground/40" />
          <div className="w-3.5 h-2 rounded-sm bg-muted-foreground/40" />
          <div className="w-4 h-2 rounded-sm bg-muted-foreground/40" />
        </div>
      </div>

      {/* App content */}
      <div className="flex-1 overflow-hidden">
        <div className="px-4 pb-3 pt-1">
          {/* Top bar */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5">
              <Image
                src="/brand/logo/uni-verse-logo-primary.png"
                alt=""
                width={18}
                height={18}
                className="w-[18px] h-[18px]"
              />
              <span className="font-black text-xs tracking-wider uppercase text-foreground">
                UNI-VERSE
              </span>
            </div>
            <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
              <Search className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>

          {/* Featured event card */}
          <div className="w-full aspect-[16/10] rounded-xl text-white flex flex-col justify-end relative overflow-hidden shadow-lg mb-2.5">
            <Image
              src="/club_hero.jpeg"
              alt="Featured campus event"
              fill
              sizes="260px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center z-10">
              <Calendar className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="relative z-10 p-3">
              <p className="text-[7px] font-bold uppercase tracking-[0.15em] opacity-80 mb-0.5">
                Featured Event
              </p>
              <h4 className="text-[11px] font-black leading-tight">
                GDG DevFest 2025
              </h4>
              <div className="flex items-center gap-1 mt-0.5 opacity-70">
                <MapPin className="w-2 h-2" />
                <span className="text-[7px] font-medium">
                  Trottier Building
                </span>
              </div>
            </div>
          </div>

          {/* Mini event list */}
          <div className="space-y-1.5">
            {[
              {
                title: "Jazz Night at Thomson",
                tag: "Music",
                time: "8 PM",
              },
              {
                title: "AI Research Talk",
                tag: "Academic",
                time: "3 PM",
              },
              {
                title: "Volleyball Intramurals",
                tag: "Sports",
                time: "5 PM",
              },
            ].map((evt) => (
              <div
                key={evt.title}
                className="flex items-center gap-2.5 p-2 bg-card rounded-lg border border-border"
              >
                <div className="w-7 h-7 bg-primary/10 text-primary rounded-md flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[7px] font-bold text-primary/60 uppercase tracking-wider">
                    {evt.tag}
                  </p>
                  <p className="text-[9px] font-bold text-foreground truncate">
                    {evt.title}
                  </p>
                </div>
                <span className="text-[7px] font-bold text-muted-foreground">
                  {evt.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <div className="flex items-center justify-around px-3 py-2.5 border-t border-border flex-shrink-0">
        {[
          { icon: Calendar, label: "Events", active: true },
          { icon: Search, label: "Search", active: false },
          { icon: Bell, label: "Alerts", active: false },
          { icon: Users, label: "Clubs", active: false },
        ].map((tab) => (
          <div
            key={tab.label}
            className={`flex flex-col items-center gap-0.5 ${
              tab.active ? "text-primary" : "text-muted-foreground/50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="text-[6px] font-bold">{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Trusted By Marquee ─── */

function TrustedByMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pos = 0;
    let animationId: number;
    const speed = 0.4;

    const animate = () => {
      pos -= speed;
      if (Math.abs(pos) >= el.scrollWidth / 2) pos = 0;
      el.style.transform = `translateX(${pos}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="py-8 sm:py-10 border-y border-border/50 overflow-hidden">
      <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest mb-5">
        Trusted by McGill&apos;s top clubs
      </p>
      <div
        ref={scrollRef}
        className="flex whitespace-nowrap gap-8 sm:gap-12 items-center will-change-transform"
      >
        {[...CLUBS_MARQUEE, ...CLUBS_MARQUEE].map((club, i) => (
          <span
            key={i}
            className="text-base sm:text-lg font-black text-muted-foreground/30 select-none uppercase tracking-wide"
          >
            {club}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Features ─── */

function Features() {
  const features = [
    {
      icon: <Search className="w-6 h-6" />,
      title: "Smart Discovery",
      description:
        "Personalized event recommendations based on your interests. Filter by category, date, or location to find exactly what you're looking for.",
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Never Miss Out",
      description:
        "Get notified about events from clubs you follow. RSVP with one tap and keep track of everything in your personal calendar.",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Club Community",
      description:
        "Follow your favorite clubs, see who's going, and discover new organizations. Connect with the McGill community like never before.",
    },
    {
      icon: <BookmarkCheck className="w-6 h-6" />,
      title: "Save & RSVP",
      description:
        "Bookmark events for later, RSVP to confirm attendance, and build your personal campus calendar with everything that matters to you.",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "AI-Powered Feed",
      description:
        "Our recommendation engine learns what you like. The more you explore, the better your feed gets, tailored to your unique campus life.",
    },
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Campus-Wide Coverage",
      description:
        "From Trottier to Thomson House, from academic lectures to late-night socials, every corner of McGill campus life, covered.",
    },
  ];

  return (
    <section
      id="features"
      className="py-20 sm:py-28 scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
            <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
              Everything You Need to Stay Connected
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Built by McGill students, for McGill students. One platform for
              all your campus event needs.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="group p-6 sm:p-8 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer h-full">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {f.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */

function HowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Sign up with your McGill email",
      description:
        "Create your account in seconds using your @mcgill.ca or @mail.mcgill.ca email. Pick your interests and you're in.",
    },
    {
      step: "02",
      title: "Discover events & follow clubs",
      description:
        "Browse the event feed, filter by category, save events you like, and follow clubs to stay in the loop.",
    },
    {
      step: "03",
      title: "RSVP & show up",
      description:
        "Mark yourself as going, get reminders, and show up. It's that simple, no more FOMO.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 bg-muted/50 scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
            <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
              Three Steps to Campus Life
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Getting started takes less than a minute.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8 sm:gap-10">
          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 120}>
              <div className="relative text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-black mb-6 shadow-lg shadow-primary/20">
                  {s.step}
                </div>
                {/* Connector line (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-border" />
                )}
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                  {s.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Organizer Section ─── */

function OrganizerSection() {
  const perks = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      title: "Club Dashboard",
      description: "Manage your club profile, events, and members from one central hub.",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Event Analytics",
      description: "Track RSVPs, views, and engagement to understand what resonates.",
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Membership Management",
      description: "Grow your community with follower insights and member tools.",
    },
  ];

  return (
    <section id="organizers" className="py-20 sm:py-28 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <Reveal>
            <div>
              <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
                For Organizers
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-6">
                Powerful Tools for Club Leaders
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg mb-10 max-w-lg leading-relaxed">
                Whether you&apos;re running a club of 20 or 2,000, UNI-VERSE
                gives you the tools to create, promote, and manage your events
                with ease.
              </p>

              <div className="space-y-6">
                {perks.map((perk) => (
                  <div key={perk.title} className="flex gap-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                      {perk.icon}
                    </div>
                    <div>
                      <h4 className="font-bold mb-1">{perk.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {perk.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/"
                className="inline-flex items-center gap-2 mt-10 text-primary font-bold hover:gap-3 transition-all duration-200 cursor-pointer"
              >
                Register your club <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="relative">
              <AnalyticsMockup />
              {/* Floating accent */}
              <div className="absolute -z-10 -inset-4 bg-primary/5 rounded-3xl" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Interactive Analytics Mockup ─── */

const CHART_DATA = [
  { day: "Mon", rsvps: 56, views: 312 },
  { day: "Tue", rsvps: 83, views: 467 },
  { day: "Wed", rsvps: 64, views: 389 },
  { day: "Thu", rsvps: 109, views: 621 },
  { day: "Fri", rsvps: 160, views: 894 },
  { day: "Sat", rsvps: 125, views: 701 },
  { day: "Sun", rsvps: 144, views: 812 },
];

function AnalyticsMockup() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const { ref: chartRef, visible: animated } = useReveal(0.1);

  const maxRsvps = Math.max(...CHART_DATA.map((d) => d.rsvps));

  return (
    <div
      ref={chartRef}
      className="bg-card border border-border rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Event Analytics
          </p>
          <h4 className="text-lg font-black mt-0.5">Fall Welcome Week</h4>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm px-3 py-1 rounded-lg">
          <TrendingUp className="w-3.5 h-3.5" />
          +84%
        </div>
      </div>

      {/* Interactive bar chart */}
      <div className="relative">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none h-40 sm:h-48">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-b border-dashed border-border/50"
            />
          ))}
        </div>

        {/* Bars */}
        <div
          className="relative flex items-end gap-2 sm:gap-3 h-40 sm:h-48"
          role="img"
          aria-label="Weekly RSVP chart showing Monday through Sunday attendance"
        >
          {CHART_DATA.map((d, i) => {
            const pct = (d.rsvps / maxRsvps) * 100;
            const isHovered = hoveredBar === i;
            const isHighlight = i >= 4;
            return (
              <div
                key={d.day}
                className="flex-1 relative cursor-pointer"
                style={{ height: `${pct}%` }}
                onMouseEnter={() => setHoveredBar(i)}
                onMouseLeave={() => setHoveredBar(null)}
                onFocus={() => setHoveredBar(i)}
                onBlur={() => setHoveredBar(null)}
                tabIndex={0}
                role="button"
                aria-label={`${d.day}: ${d.rsvps} RSVPs, ${d.views} views`}
              >
                {/* Tooltip */}
                <div
                  className={`absolute -top-14 left-1/2 -translate-x-1/2 z-10 transition-all duration-200 pointer-events-none ${
                    isHovered
                      ? "opacity-100 -translate-y-1"
                      : "opacity-0 translate-y-0"
                  }`}
                >
                  <div className="bg-foreground text-background text-[10px] font-bold px-3 py-2 rounded-lg whitespace-nowrap shadow-xl">
                    <div>{d.rsvps} RSVPs</div>
                    <div className="font-medium opacity-70">
                      {d.views} views
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                  </div>
                </div>

                {/* Bar */}
                <div
                  className={`w-full h-full rounded-t-md transition-all ease-out ${
                    animated ? "duration-1000" : "duration-0"
                  } ${
                    isHighlight || isHovered
                      ? "bg-gradient-to-t from-primary to-primary/70"
                      : "bg-primary/15 dark:bg-primary/20"
                  } ${isHovered ? "!from-primary !to-primary/60 shadow-lg shadow-primary/20" : ""}`}
                  style={{
                    transform: animated ? "scaleY(1)" : "scaleY(0)",
                    transformOrigin: "bottom",
                    transitionDelay: animated ? `${i * 80}ms` : "0ms",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Day labels */}
        <div className="flex gap-2 sm:gap-3 mt-2">
          {CHART_DATA.map((d, i) => (
            <div
              key={d.day}
              className={`flex-1 text-center text-[10px] sm:text-xs font-medium transition-colors duration-200 ${
                hoveredBar === i
                  ? "text-primary font-bold"
                  : "text-muted-foreground"
              }`}
            >
              {d.day.slice(0, 1)}
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { value: "2,847", label: "Views", color: "text-blue-500" },
          { value: "1,203", label: "RSVPs", color: "text-primary" },
          { value: "412", label: "Followers", color: "text-emerald-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center p-3 bg-muted/50 rounded-xl"
          >
            <span className={`text-base font-black ${stat.color}`}>
              {stat.value}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Final CTA ─── */

function FinalCTA() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <Reveal>
        <div className="max-w-5xl mx-auto text-center bg-primary rounded-3xl sm:rounded-[2.5rem] p-8 sm:p-12 md:p-20 text-primary-foreground relative overflow-hidden">
          {/* Background accents */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-36 -mt-36 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-black/10 rounded-full -ml-36 -mb-36 blur-3xl" />

          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black mb-4 sm:mb-6 relative z-10 tracking-tight leading-tight">
            Ready to discover your campus?
          </h2>
          <p className="text-base sm:text-lg opacity-90 mb-8 sm:mb-10 max-w-2xl mx-auto relative z-10">
            Join McGill students already using UNI-VERSE to find events, connect
            with clubs, and make the most of university life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Link
              href="/"
              className="bg-white text-primary text-lg font-black px-8 sm:px-10 py-4 rounded-2xl shadow-2xl hover:shadow-white/25 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            >
              Get Started Free
            </Link>
            <a
              href={`mailto:${CONTACT_EMAILS.inquiries}`}
              className="bg-white/15 border border-white/20 text-white text-lg font-bold px-8 sm:px-10 py-4 rounded-2xl hover:bg-white/25 transition-all duration-300 cursor-pointer"
            >
              Contact Us
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Footer ─── */

function LandingFooter() {
  const LINKS = [
    { label: "About", href: "/about" },
    { label: "Help & FAQ", href: "/help" },
    { label: "Feedback", href: "/feedback" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ];

  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col items-center text-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/logo/uni-verse-logo-primary.png"
              alt="UNI-VERSE logo"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-lg font-black tracking-widest text-foreground uppercase">
              UNI-VERSE
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Campus event discovery for McGill University.
          </p>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {LINKS.map((link, i) => (
              <span key={link.label} className="flex items-center gap-2">
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                >
                  {link.label}
                </Link>
                {i < LINKS.length - 1 && (
                  <span className="text-border select-none" aria-hidden>
                    ·
                  </span>
                )}
              </span>
            ))}
          </nav>

          {/* Contact */}
          <a
            href={`mailto:${CONTACT_EMAILS.hello}`}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 cursor-pointer"
          >
            {CONTACT_EMAILS.hello}
          </a>

          {/* Attribution */}
          <div className="pt-6 border-t border-border/40 w-full">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} UNI-VERSE · A{" "}
              <span className="font-semibold text-foreground">
                GDG McGill
              </span>{" "}
              project, powered by{" "}
              <span className="font-semibold text-foreground">
                Apollo Labs
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
