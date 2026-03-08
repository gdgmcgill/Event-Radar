"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  BellRing,
  Users,
  Ticket,
  CheckCircle,
  Check,
  AtSign,
  Share2,
  Youtube,
  Search,
  Flame,
  Gamepad2,
} from "lucide-react";
import { useEffect, useRef } from "react";

const CLUBS = [
  "MCGILL DEBATING UNION",
  "MCGILL OUTDOORS CLUB",
  "SSMU",
  "ENGINEERING SOCIETY",
  "ARTS UNDERGRADUATE",
  "MANAGEMENT SOCIETY",
];

const AVATARS = [
  "/landing/avatar-1.jpg",
  "/landing/avatar-2.jpg",
  "/landing/avatar-3.jpg",
  "/landing/avatar-4.jpg",
];

const EVENT_CARDS = [
  {
    image: "/landing/event-concert.jpg",
    label: "HOT",
    labelColor: "bg-[#ED1B2F]",
    title: "Gerts Karaoke Night",
    alt: "Crowded concert event",
  },
  {
    image: "/landing/hero-laptop.jpg",
    label: "SOCIAL",
    labelColor: "bg-purple-500",
    title: "Milton Jazz Night",
    alt: "Live music performance",
  },
  {
    image: "/landing/event-lecture.jpg",
    label: "ACADEMIC",
    labelColor: "bg-blue-500",
    title: "Tech Talk: AI at McGill",
    alt: "University lecture hall event",
  },
  {
    image: "/landing/event-party.jpg",
    label: "FREE",
    labelColor: "bg-green-500",
    title: "New Rez Mixer",
    alt: "Student party",
  },
];

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <HeroSection />
      <ClubMarquee />
      <ValueProposition />
      <FeatureGrid />
      <OrganizerSection />
      <FinalCTA />
      <LandingFooter />
    </>
  );
}

/* ─── Header ─── */
function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#ED1B2F]/10 bg-[#f8f6f6]/80 backdrop-blur-md dark:bg-[#221012]/80">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#ED1B2F] p-2 rounded-lg text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
            Uni-Verse
          </h2>
        </div>
        <nav className="hidden md:flex items-center gap-10">
          <Link
            href="/"
            className="text-sm font-semibold hover:text-[#ED1B2F] transition-colors cursor-pointer"
          >
            Events
          </Link>
          <Link
            href="#clubs"
            className="text-sm font-semibold hover:text-[#ED1B2F] transition-colors cursor-pointer"
          >
            Clubs
          </Link>
          <Link
            href="#features"
            className="text-sm font-semibold hover:text-[#ED1B2F] transition-colors cursor-pointer"
          >
            Features
          </Link>
          <Link
            href="#organizers"
            className="text-sm font-semibold hover:text-[#ED1B2F] transition-colors cursor-pointer"
          >
            Analytics
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="hidden sm:block text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#ED1B2F]/5 transition-all border border-transparent hover:border-[#ED1B2F]/20 cursor-pointer"
          >
            Login
          </Link>
          <Link
            href="/"
            className="bg-[#ED1B2F] text-white text-sm font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-[#ED1B2F]/25 hover:scale-[1.02] transition-transform cursor-pointer"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative pt-20 pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ED1B2F]/10 border border-[#ED1B2F]/20 text-[#ED1B2F] text-xs font-bold mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ED1B2F] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ED1B2F]" />
            </span>
            NOW LIVE AT MCGILL UNIVERSITY
          </div>
          <h1 className="text-6xl md:text-7xl font-black leading-[1.05] tracking-tight mb-8">
            The Pulse of{" "}
            <span className="text-[#ED1B2F] italic">McGill</span> in Your
            Pocket
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-10 max-w-xl">
            Experience the ultimate campus hub. Join 40,000+ students
            discovering exclusive events, secret societies, and epic socials in
            one premium interface.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link
              href="/"
              className="h-14 px-8 bg-[#ED1B2F] text-white text-lg font-bold rounded-xl shadow-xl shadow-[#ED1B2F]/30 flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer"
            >
              Join 40k Students <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/"
              className="h-14 px-8 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-lg font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
            >
              Browse Events
            </Link>
          </div>
          {/* Social proof avatars */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {AVATARS.map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt="Student profile photo"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full border-2 border-[#f8f6f6] ring-1 ring-[#ED1B2F]/20 object-cover"
                />
              ))}
            </div>
            <p className="text-sm font-medium text-slate-500">
              Trusted by 40,000+ McGill students
            </p>
          </div>
        </div>

        {/* Right mockups */}
        <div className="relative lg:h-[700px] flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#ED1B2F]/20 via-transparent to-[#ED1B2F]/10 rounded-full blur-3xl opacity-50" />
          <div className="relative w-full max-w-2xl h-full flex items-center justify-center">
            {/* Laptop mockup */}
            <div className="absolute -right-4 lg:-right-12 top-1/2 -translate-y-1/2 w-[450px] md:w-[600px] lg:w-[750px] transition-all duration-700 hover:scale-[1.02] z-0">
              <div className="relative">
                <div className="relative rounded-t-2xl border-[10px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden aspect-[16/10]">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-10" />
                  <div className="relative w-full h-full">
                    <Image
                      src="/landing/hero-laptop.jpg"
                      alt="Uni-Verse web interface showing event details"
                      fill
                      className="object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm p-6 flex flex-col justify-end">
                      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 max-w-md">
                        <span className="text-[#ED1B2F] text-[10px] font-black uppercase tracking-widest mb-2 block">
                          Featured Event
                        </span>
                        <h4 className="text-white text-2xl font-black mb-2">
                          Milton Jazz Night
                        </h4>
                        <p className="text-white/70 text-sm line-clamp-2 mb-4">
                          Join the McGill Jazz Orchestra for an intimate evening
                          of classic standards and modern fusion in the heart of
                          Milton-Parc.
                        </p>
                        <div className="flex gap-3">
                          <span className="h-8 px-4 bg-[#ED1B2F] text-white text-xs font-bold rounded-lg flex items-center">
                            RSVP Now
                          </span>
                          <span className="h-8 px-4 bg-white/10 text-white text-xs font-bold rounded-lg flex items-center border border-white/20">
                            Details
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Laptop base */}
                <div className="relative h-4 w-[104%] -left-[2%] bg-slate-700 rounded-b-xl shadow-xl border-t border-white/10">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-black/30 rounded-full" />
                </div>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="relative w-[280px] md:w-[320px] h-[560px] md:h-[640px] bg-slate-900 rounded-[3rem] p-3 border-8 border-slate-800 shadow-2xl overflow-hidden z-10 lg:-ml-64">
              <div className="bg-[#f8f6f6] h-full w-full rounded-[2.25rem] overflow-hidden flex flex-col">
                <div className="pt-10 px-6 pb-4">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl">Discover</h3>
                    <Search className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="w-full h-48 bg-[#ED1B2F] rounded-2xl p-5 text-white flex flex-col justify-end relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                    <div className="relative z-10">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80">
                        Happening Tonight
                      </p>
                      <h4 className="text-lg font-black">SSMU Winter Gala</h4>
                    </div>
                  </div>
                </div>
                <div className="px-6 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                    <div className="w-10 h-10 bg-[#ED1B2F]/10 text-[#ED1B2F] rounded-lg flex items-center justify-center">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400">
                        TRENDING
                      </p>
                      <p className="text-sm font-bold">Milton House Show</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                    <div className="w-10 h-10 bg-[#ED1B2F]/10 text-[#ED1B2F] rounded-lg flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400">
                        GAMING
                      </p>
                      <p className="text-sm font-bold">Esports Tournament</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Club Marquee ─── */
function ClubMarquee() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let animationId: number;
    let pos = 0;
    const speed = 0.5;

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
    <div
      id="clubs"
      className="py-12 border-y border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      <div ref={scrollRef} className="flex whitespace-nowrap gap-12 items-center">
        {[...CLUBS, ...CLUBS].map((club, i) => (
          <span
            key={i}
            className="text-2xl font-black text-slate-300 dark:text-slate-700 select-none"
          >
            {club}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Value Proposition ─── */
function ValueProposition() {
  const features = [
    {
      icon: <BellRing className="w-7 h-7" />,
      title: "FOMO-Free Living",
      desc: "Never miss a high-profile speaker or a Milton basement show again. Custom alerts tailored to your interests.",
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: "Social Discovery",
      desc: "Find your tribe with AI-powered club recommendations based on your major, hobbies, and social vibe.",
    },
    {
      icon: <Ticket className="w-7 h-7" />,
      title: "Seamless RSVP",
      desc: "One-tap registration for any campus event. Tickets sync instantly to your Apple Wallet or Google Pay.",
    },
  ];

  return (
    <section id="features" className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
          Your Campus, Connected
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Eliminate the friction of finding things to do. Stop scrolling through
          endless group chats and start experiencing the best of Montreal.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {features.map((f) => (
          <div
            key={f.title}
            className="p-8 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-[#ED1B2F]/30 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 bg-[#ED1B2F]/10 text-[#ED1B2F] rounded-xl flex items-center justify-center mb-6">
              {f.icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{f.title}</h3>
            <p className="text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature Grid (Netflix-style) ─── */
function FeatureGrid() {
  return (
    <section className="py-24 bg-slate-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight mb-8">
              Netflix-style Discovery for Campus Events
            </h2>
            <p className="text-slate-400 text-lg mb-10">
              We&apos;ve reimagined the campus bulletin board. Swipe through
              high-quality event cards, watch video teasers, and see which of
              your friends are attending in real-time.
            </p>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <CheckCircle className="w-6 h-6 text-[#ED1B2F] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Real-time Heatmaps</p>
                  <p className="text-sm text-slate-400">
                    See where the action is happening across the Ghetto and
                    campus right now.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <CheckCircle className="w-6 h-6 text-[#ED1B2F] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Verified Club Dashboards</p>
                  <p className="text-sm text-slate-400">
                    Directly connect with executive members and get the inside
                    scoop.
                  </p>
                </div>
              </li>
            </ul>
          </div>
          {/* Event cards grid */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 pt-12">
                {EVENT_CARDS.filter((_, i) => i % 2 === 0).map((card) => (
                  <EventCard key={card.title} {...card} />
                ))}
              </div>
              <div className="space-y-4">
                {EVENT_CARDS.filter((_, i) => i % 2 === 1).map((card) => (
                  <EventCard key={card.title} {...card} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventCard({
  image,
  label,
  labelColor,
  title,
  alt,
}: {
  image: string;
  label: string;
  labelColor: string;
  title: string;
  alt: string;
}) {
  return (
    <div className="aspect-[3/4] rounded-2xl bg-slate-800 p-1">
      <div className="w-full h-full rounded-xl overflow-hidden flex flex-col justify-end p-4 relative group cursor-pointer">
        <Image
          src={image}
          alt={alt}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <p
          className={`relative text-xs font-bold ${labelColor} w-fit px-2 py-1 rounded mb-2`}
        >
          {label}
        </p>
        <h4 className="relative font-bold text-sm">{title}</h4>
      </div>
    </div>
  );
}

/* ─── Organizer / Analytics ─── */
function OrganizerSection() {
  const perks = [
    "Advanced QR code check-in system",
    "Automated email & push marketing",
    "Budget & treasury tracking",
  ];

  return (
    <section id="organizers" className="py-24 max-w-7xl mx-auto px-6">
      <div className="bg-[#f8f6f6] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-16 overflow-hidden relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Analytics mockup */}
          <div className="relative">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs font-bold text-slate-400">
                    EVENT ANALYTICS
                  </p>
                  <h4 className="text-lg font-black">Ticket Sales: OAP Fall</h4>
                </div>
                <span className="text-[#ED1B2F] font-bold text-sm">+124%</span>
              </div>
              <div className="flex items-end gap-2 h-32 mb-6">
                {[30, 45, 35, 60, 100, 85].map((h, i) => (
                  <div
                    key={i}
                    className={`w-full rounded-t-lg ${i >= 4 ? "bg-[#ED1B2F]" : "bg-[#ED1B2F]/20"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-sm font-medium">Total Revenue</span>
                  <span className="text-sm font-black">$4,250.00</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-sm font-medium">Unique RSVPs</span>
                  <span className="text-sm font-black">1,842</span>
                </div>
              </div>
            </div>
          </div>
          {/* Copy */}
          <div>
            <h2 className="text-4xl font-black mb-6">Built for Organizers</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              Running a club of 20 or 2,000? Uni-Verse provides pro-level tools
              to manage ticketing, membership, and engagement with data-driven
              insights.
            </p>
            <div className="space-y-4">
              {perks.map((perk) => (
                <div key={perk} className="flex items-start gap-4">
                  <div className="mt-1 bg-[#ED1B2F] p-1 rounded-full text-white flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <p className="font-semibold">{perk}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto text-center bg-[#ED1B2F] rounded-[3rem] p-12 md:p-24 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full -ml-48 -mb-48 blur-3xl" />
        <h2 className="text-5xl md:text-7xl font-black mb-8 relative z-10 tracking-tight">
          Ready to own your campus life?
        </h2>
        <p className="text-xl opacity-90 mb-12 max-w-2xl mx-auto relative z-10 font-medium">
          Join 40,000+ McGill students and start discovering what&apos;s next.
          No more missed nights, just better stories.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center relative z-10">
          <Link
            href="/"
            className="bg-white text-[#ED1B2F] text-xl font-black px-12 py-5 rounded-2xl shadow-2xl hover:scale-105 transition-transform cursor-pointer"
          >
            Get Started Free
          </Link>
          <Link
            href="/"
            className="bg-black/20 border border-white/20 text-white text-xl font-black px-12 py-5 rounded-2xl hover:bg-black/30 transition-all cursor-pointer"
          >
            Request Club Demo
          </Link>
        </div>
        <p className="mt-12 text-sm opacity-70 relative z-10 uppercase font-black tracking-widest">
          Available for iOS, Android, and Web
        </p>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function LandingFooter() {
  return (
    <footer className="py-16 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
        <div className="col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#ED1B2F] p-2 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black tracking-tight uppercase">
              Uni-Verse
            </h2>
          </div>
          <p className="text-slate-500 max-w-sm mb-8">
            The central operating system for student life at McGill University.
            Making campus connections more meaningful since 2024.
          </p>
          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-[#ED1B2F] hover:text-white transition-all cursor-pointer"
              aria-label="Email"
            >
              <AtSign className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-[#ED1B2F] hover:text-white transition-all cursor-pointer"
              aria-label="Share"
            >
              <Share2 className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-[#ED1B2F] hover:text-white transition-all cursor-pointer"
              aria-label="YouTube"
            >
              <Youtube className="w-5 h-5" />
            </a>
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-6">Platform</h4>
          <ul className="space-y-4 text-slate-500 text-sm">
            <li>
              <Link
                href="/"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Event Search
              </Link>
            </li>
            <li>
              <a
                href="#clubs"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Club Directory
              </a>
            </li>
            <li>
              <a
                href="#organizers"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Pricing for Clubs
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Security &amp; Safety
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-6">Support</h4>
          <ul className="space-y-4 text-slate-500 text-sm">
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Help Center
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                API Docs
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Community Guidelines
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors cursor-pointer"
              >
                Privacy Policy
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-slate-400 text-xs">
          &copy; 2024 Uni-Verse Technologies. Not affiliated with McGill
          University officially.
        </p>
        <div className="flex gap-6 text-xs text-slate-400">
          <a href="#" className="hover:text-[#ED1B2F] cursor-pointer">
            Terms
          </a>
          <a href="#" className="hover:text-[#ED1B2F] cursor-pointer">
            Privacy
          </a>
          <a href="#" className="hover:text-[#ED1B2F] cursor-pointer">
            Cookies
          </a>
        </div>
      </div>
    </footer>
  );
}
