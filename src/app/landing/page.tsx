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
  TrendingUp,
  Eye,
  UserPlus,
  Menu,
  X,
  Calendar,
  MapPin,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ─── Constants ─── */

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
    alt: "Crowded concert event at Gerts bar",
  },
  {
    image: "/landing/hero-laptop.jpg",
    label: "SOCIAL",
    labelColor: "bg-purple-500",
    title: "Milton Jazz Night",
    alt: "Live jazz performance in Milton-Parc",
  },
  {
    image: "/landing/event-lecture.jpg",
    label: "ACADEMIC",
    labelColor: "bg-blue-500",
    title: "Tech Talk: AI at McGill",
    alt: "University lecture hall for AI tech talk",
  },
  {
    image: "/landing/event-party.jpg",
    label: "FREE",
    labelColor: "bg-green-500",
    title: "New Rez Mixer",
    alt: "Student mixer party at New Residence",
  },
];

const ANALYTICS_DATA = [
  { label: "Mon", value: 30, rsvps: 48 },
  { label: "Tue", value: 45, rsvps: 72 },
  { label: "Wed", value: 35, rsvps: 56 },
  { label: "Thu", value: 60, rsvps: 96 },
  { label: "Fri", value: 100, rsvps: 160 },
  { label: "Sat", value: 85, rsvps: 136 },
];

const NAV_ITEMS = [
  { href: "/", label: "Events", isRoute: true },
  { href: "#clubs", label: "Clubs", isRoute: false },
  { href: "#features", label: "Features", isRoute: false },
  { href: "#organizers", label: "Analytics", isRoute: false },
];

/* ─── Scroll-reveal hook ─── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      setVisible(true);
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
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Nav link component — <a> for hash, <Link> for routes ─── */
function NavLink({
  item,
  className,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  className: string;
  onClick?: () => void;
}) {
  if (item.isRoute) {
    return (
      <Link href={item.href} className={className} onClick={onClick}>
        {item.label}
      </Link>
    );
  }
  return (
    <a href={item.href} className={className} onClick={onClick}>
      {item.label}
    </a>
  );
}

/* ─── Page ─── */

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass =
    "text-sm font-semibold hover:text-[#ED1B2F] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] focus-visible:ring-offset-2 rounded-sm cursor-pointer";
  const mobileLinkClass =
    "block text-sm font-semibold py-3 px-3 rounded-lg hover:bg-[#ED1B2F]/5 hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer";

  return (
    <header className="landing-header sticky top-0 z-50 w-full border-b border-[#ED1B2F]/10 bg-[#f8f6f6]/80 backdrop-blur-md dark:bg-[#221012]/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-[#ED1B2F] p-1.5 sm:p-2 rounded-lg text-white">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
            Uni-Verse
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-10">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} className={linkClass} />
          ))}
        </nav>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="hidden sm:block text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#ED1B2F]/5 transition-colors duration-200 border border-transparent hover:border-[#ED1B2F]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] focus-visible:ring-offset-2 cursor-pointer"
          >
            Login
          </Link>
          <Link
            href="/"
            className="bg-[#ED1B2F] text-white text-sm font-bold px-4 sm:px-6 py-2.5 rounded-lg shadow-lg shadow-[#ED1B2F]/25 hover:brightness-110 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] focus-visible:ring-offset-2 cursor-pointer"
          >
            Get Started
          </Link>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] cursor-pointer"
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
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-[#f8f6f6] dark:bg-[#221012] px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              className={mobileLinkClass}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      )}
    </header>
  );
}

/* ─── Hero ─── */
function HeroSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-32 overflow-hidden">
      <div
        ref={ref}
        className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center"
      >
        {/* Left copy */}
        <div
          className={`relative z-10 transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ED1B2F]/10 border border-[#ED1B2F]/20 text-[#ED1B2F] text-xs font-bold mb-6">
            <span className="relative flex h-2 w-2">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ED1B2F] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ED1B2F]" />
            </span>
            NOW LIVE AT MCGILL UNIVERSITY
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6 sm:mb-8">
            The Pulse of{" "}
            <span className="text-[#ED1B2F] italic">McGill</span> in Your
            Pocket
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-8 sm:mb-10 max-w-xl">
            Experience the ultimate campus hub. Join 40,000+ students
            discovering exclusive events, secret societies, and epic socials in
            one premium interface.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-10 sm:mb-12">
            <Link
              href="/"
              className="h-12 sm:h-14 px-6 sm:px-8 bg-[#ED1B2F] text-white text-base sm:text-lg font-bold rounded-xl shadow-xl shadow-[#ED1B2F]/30 flex items-center justify-center gap-2 hover:brightness-110 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] focus-visible:ring-offset-2 cursor-pointer"
            >
              Join 40k Students <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/"
              className="h-12 sm:h-14 px-6 sm:px-8 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-lg font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 hover:border-[#ED1B2F]/30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] focus-visible:ring-offset-2 cursor-pointer"
            >
              Browse Events
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {AVATARS.map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt={`Student ${i + 1} profile photo`}
                  width={40}
                  height={40}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-[#f8f6f6] ring-1 ring-[#ED1B2F]/20 object-cover"
                />
              ))}
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Trusted by 40,000+ McGill students
            </p>
          </div>
        </div>

        {/* Right — Premium device mockup with perspective & float */}
        <div
          className={`relative hidden md:block transition-all duration-1000 ease-out delay-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
          style={{ perspective: "1200px" }}
        >
          {/* Ambient glow */}
          <div className="absolute -inset-20 bg-gradient-to-tr from-[#ED1B2F]/30 via-transparent to-[#ED1B2F]/15 rounded-full blur-[100px] opacity-60" />

          <div className="relative w-full h-[520px] lg:h-[580px]">
            {/* Laptop — back layer, perspective tilt */}
            <div
              className="absolute right-0 top-0 w-[420px] lg:w-[520px] motion-safe:animate-[float-laptop_6s_ease-in-out_infinite]"
              style={{
                transformStyle: "preserve-3d",
                transform: "rotateY(-5deg) rotateX(2deg)",
              }}
            >
              <div className="relative rounded-t-xl border-[8px] border-[#1e293b] bg-[#0f172a] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden aspect-[16/10]">
                {/* Glass reflection */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none z-20" />
                <div className="relative w-full h-full">
                  <Image
                    src="/landing/hero-laptop.jpg"
                    alt="Uni-Verse web interface showing Milton Jazz Night event details"
                    fill
                    sizes="(max-width: 1024px) 480px, 640px"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-5 flex flex-col justify-end">
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20 max-w-[280px] shadow-2xl">
                      <span className="text-[#ED1B2F] text-[9px] font-black uppercase tracking-[0.2em] mb-1 block">
                        Featured Event
                      </span>
                      <h4 className="text-white text-base lg:text-lg font-black mb-1">
                        Milton Jazz Night
                      </h4>
                      <p className="text-white/60 text-[11px] line-clamp-2 mb-2.5">
                        Join the McGill Jazz Orchestra for an intimate evening
                        of classic standards and modern fusion.
                      </p>
                      <div className="flex gap-2">
                        <span className="h-7 px-3 bg-[#ED1B2F] text-white text-[10px] font-bold rounded-md flex items-center">
                          RSVP Now
                        </span>
                        <span className="h-7 px-3 bg-white/10 text-white text-[10px] font-bold rounded-md flex items-center border border-white/20">
                          Details
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Laptop base */}
              <div className="relative h-3 w-[102%] -left-[1%] bg-gradient-to-b from-[#334155] to-[#475569] rounded-b-lg shadow-xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-[#1e293b] rounded-full mt-0.5" />
              </div>
              {/* Desk shadow */}
              <div className="absolute -bottom-6 left-[10%] right-[10%] h-8 bg-black/20 rounded-full blur-2xl" />
            </div>

            {/* Phone — front layer, overlapping with opposite tilt */}
            <div
              className="absolute -left-4 lg:left-0 top-1/2 -translate-y-1/2 z-20 w-[220px] lg:w-[250px] motion-safe:animate-[float-phone_6s_ease-in-out_infinite]"
              style={{
                transformStyle: "preserve-3d",
                transform: "translateY(-50%) rotateY(6deg) rotateX(-1deg)",
              }}
            >
              {/* Outer phone frame with premium shadow */}
              <div className="relative bg-gradient-to-b from-[#1e293b] to-[#0f172a] rounded-[2.5rem] p-[10px] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)]">
                {/* Notch / dynamic island */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0f172a] rounded-full z-30" />
                {/* Screen */}
                <div className="bg-[#f8f6f6] w-full rounded-[2rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="h-12 flex items-end justify-between px-6 pb-1">
                    <span className="text-[10px] font-bold text-slate-500">
                      9:41
                    </span>
                    <div className="flex gap-1">
                      <div className="w-3.5 h-2 rounded-sm bg-slate-400" />
                      <div className="w-3.5 h-2 rounded-sm bg-slate-400" />
                      <div className="w-4 h-2 rounded-sm bg-slate-400" />
                    </div>
                  </div>
                  <div className="px-5 pb-3 pt-2">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="font-black text-lg text-slate-900">
                        Discover
                      </h3>
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <Search className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </div>
                    {/* Featured card */}
                    <div className="w-full aspect-[16/10] bg-[#ED1B2F] rounded-2xl p-4 text-white flex flex-col justify-end relative overflow-hidden shadow-lg shadow-[#ED1B2F]/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                      <div className="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-80 mb-0.5">
                          Happening Tonight
                        </p>
                        <h4 className="text-base font-black leading-tight">
                          SSMU Winter Gala
                        </h4>
                        <div className="flex items-center gap-1 mt-1 opacity-70">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-medium">
                            Thomson House
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Event list */}
                  <div className="px-5 pb-6 space-y-2.5">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-100">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#ED1B2F]/10 to-[#ED1B2F]/5 text-[#ED1B2F] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-[#ED1B2F]/60 uppercase tracking-wider">
                          Trending
                        </p>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          Milton House Show
                        </p>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">
                        8PM
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-100">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#ED1B2F]/10 to-[#ED1B2F]/5 text-[#ED1B2F] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-[#ED1B2F]/60 uppercase tracking-wider">
                          Gaming
                        </p>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          Esports Tournament
                        </p>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">
                        9PM
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Phone shadow */}
              <div className="absolute -bottom-5 left-[15%] right-[15%] h-6 bg-black/25 rounded-full blur-xl" />
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
      className="py-8 sm:py-12 border-y border-slate-200 dark:border-slate-800 overflow-hidden scroll-mt-24"
    >
      <div
        ref={scrollRef}
        className="flex whitespace-nowrap gap-8 sm:gap-12 items-center will-change-transform"
      >
        {[...CLUBS, ...CLUBS].map((club, i) => (
          <span
            key={i}
            className="text-lg sm:text-2xl font-black text-slate-300 dark:text-slate-700 select-none"
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
    <section
      id="features"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-24"
    >
      <Reveal>
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 sm:mb-6">
            Your Campus, Connected
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Eliminate the friction of finding things to do. Stop scrolling
            through endless group chats and start experiencing the best of
            Montreal.
          </p>
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 120}>
            <div className="p-6 sm:p-8 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-[#ED1B2F]/30 hover:shadow-lg hover:shadow-[#ED1B2F]/5 transition-all duration-300 cursor-pointer group">
              <div className="w-14 h-14 bg-[#ED1B2F]/10 text-[#ED1B2F] rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#ED1B2F] group-hover:text-white transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{f.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature Grid (Netflix-style) ─── */
function FeatureGrid() {
  return (
    <section className="py-16 sm:py-24 bg-slate-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <Reveal>
            <div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-6 sm:mb-8">
                Netflix-style Discovery for Campus Events
              </h2>
              <p className="text-slate-300 text-base sm:text-lg mb-8 sm:mb-10 max-w-lg">
                We&apos;ve reimagined the campus bulletin board. Swipe through
                high-quality event cards, watch video teasers, and see which of
                your friends are attending in real-time.
              </p>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <CheckCircle className="w-6 h-6 text-[#ED1B2F] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Real-time Heatmaps</p>
                    <p className="text-sm text-slate-300">
                      See where the action is happening across the Ghetto and
                      campus right now.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <CheckCircle className="w-6 h-6 text-[#ED1B2F] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Verified Club Dashboards</p>
                    <p className="text-sm text-slate-300">
                      Directly connect with executive members and get the inside
                      scoop.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="relative">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-3 sm:space-y-4 pt-12">
                  {EVENT_CARDS.filter((_, i) => i % 2 === 0).map((card) => (
                    <EventCard key={card.title} {...card} />
                  ))}
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {EVENT_CARDS.filter((_, i) => i % 2 === 1).map((card) => (
                    <EventCard key={card.title} {...card} />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
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
    <div className="aspect-[3/4] rounded-2xl bg-slate-800 p-1 group">
      <div className="w-full h-full rounded-xl overflow-hidden flex flex-col justify-end p-3 sm:p-4 relative cursor-pointer">
        <Image
          src={image}
          alt={alt}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <p
          className={`relative text-xs font-bold ${labelColor} w-fit px-2 py-1 rounded mb-1.5 sm:mb-2`}
        >
          {label}
        </p>
        <h4 className="relative font-bold text-sm truncate">{title}</h4>
      </div>
    </div>
  );
}

/* ─── Interactive Analytics Chart ─── */
function AnalyticsChart() {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (prefersReducedMotion) {
            setAnimated(true);
          } else {
            // Small delay so the reveal animation starts first
            setTimeout(() => setAnimated(true), 300);
          }
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxValue = Math.max(...ANALYTICS_DATA.map((d) => d.value));

  return (
    <div ref={chartRef} className="mb-5">
      {/* Y-axis labels + chart area */}
      <div className="flex gap-3">
        {/* Y-axis */}
        <div className="flex flex-col justify-between h-40 sm:h-48 text-[9px] sm:text-[10px] text-slate-400 font-medium py-1 w-6 text-right">
          <span>160</span>
          <span>120</span>
          <span>80</span>
          <span>40</span>
          <span>0</span>
        </div>
        {/* Bars area with grid lines */}
        <div className="flex-1 relative">
          {/* Horizontal grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="border-b border-dashed border-slate-100 dark:border-slate-700/50"
              />
            ))}
          </div>
          {/* Bars */}
          <div
            className="relative flex items-end gap-2 sm:gap-3 h-40 sm:h-48"
            role="img"
            aria-label="Weekly RSVP chart showing Monday through Saturday attendance data"
          >
            {ANALYTICS_DATA.map((d, i) => {
              const isActive = i >= 4;
              const isHovered = hoveredBar === i;
              return (
                <div
                  key={d.label}
                  className="flex-1 h-full flex items-end cursor-pointer"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onFocus={() => setHoveredBar(i)}
                  onBlur={() => setHoveredBar(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label}: ${d.rsvps} RSVPs`}
                >
                  <div className="relative w-full">
                    {/* Tooltip */}
                    <div
                      className={`absolute -top-9 left-1/2 -translate-x-1/2 z-10 transition-all duration-200 pointer-events-none ${isHovered ? "opacity-100 -translate-y-1" : "opacity-0 translate-y-0"}`}
                    >
                      <div className="bg-[#0f172a] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                        {d.rsvps} RSVPs
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0f172a]" />
                      </div>
                    </div>
                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-md transition-all ease-out ${animated ? "duration-1000" : "duration-0"} ${isActive ? "bg-gradient-to-t from-[#ED1B2F] to-[#f87171]" : "bg-gradient-to-t from-[#ED1B2F]/25 to-[#ED1B2F]/10"} ${isHovered ? "!from-[#ED1B2F] !to-[#f87171] shadow-lg shadow-[#ED1B2F]/20" : ""}`}
                      style={{
                        height: "0",
                        paddingBottom: animated
                          ? `${(d.value / maxValue) * 100}%`
                          : "0%",
                        transitionDelay: animated ? `${i * 80}ms` : "0ms",
                        boxSizing: "content-box",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Day labels */}
          <div className="flex gap-2 sm:gap-3 mt-2">
            {ANALYTICS_DATA.map((d, i) => (
              <div
                key={d.label}
                className={`flex-1 text-center text-[10px] sm:text-xs font-medium transition-colors duration-200 ${hoveredBar === i ? "text-[#ED1B2F] font-bold" : "text-slate-400"}`}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Organizer / Analytics ─── */
function OrganizerSection() {
  const perks = [
    "Advanced QR code check-in system",
    "Automated email & push marketing",
    "Real-time attendance analytics",
  ];

  return (
    <section
      id="organizers"
      className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-24"
    >
      <Reveal>
        <div className="bg-[#f8f6f6] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 md:p-16 overflow-hidden relative">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal delay={100}>
              <div className="relative">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] p-5 sm:p-6 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-5 sm:mb-6">
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Event Analytics
                      </p>
                      <h4 className="text-base sm:text-lg font-black mt-0.5">
                        Weekly RSVPs: OAP Fall
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#ED1B2F]/10 text-[#ED1B2F] font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +124%
                    </div>
                  </div>
                  <AnalyticsChart />
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      {
                        icon: <Eye className="w-4 h-4" />,
                        value: "3,241",
                        label: "Interested",
                        color: "text-blue-500",
                      },
                      {
                        icon: <Ticket className="w-4 h-4" />,
                        value: "1,842",
                        label: "RSVPs",
                        color: "text-[#ED1B2F]",
                      },
                      {
                        icon: <UserPlus className="w-4 h-4" />,
                        value: "568",
                        label: "New Audience",
                        color: "text-emerald-500",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex flex-col items-center p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600/30"
                      >
                        <div className={`${stat.color} mb-1`}>{stat.icon}</div>
                        <span className="text-sm sm:text-base font-black">
                          {stat.value}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={250}>
              <div>
                <h2 className="text-3xl sm:text-4xl font-black mb-4 sm:mb-6">
                  Built for Organizers
                </h2>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 leading-relaxed">
                  Running a club of 20 or 2,000? Uni-Verse provides pro-level
                  tools to manage attendance, membership, and engagement with
                  data-driven insights.
                </p>
                <div className="space-y-4">
                  {perks.map((perk) => (
                    <div
                      key={perk}
                      className="flex items-start gap-3 sm:gap-4"
                    >
                      <div className="mt-1 bg-[#ED1B2F] p-1 rounded-full text-white flex-shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <p className="font-semibold text-sm sm:text-base">
                        {perk}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Final CTA ─── */
function FinalCTA() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <Reveal>
        <div className="max-w-5xl mx-auto text-center bg-[#ED1B2F] rounded-2xl sm:rounded-[3rem] p-8 sm:p-12 md:p-24 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-white/10 rounded-full -mr-32 sm:-mr-48 -mt-32 sm:-mt-48 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-black/10 rounded-full -ml-32 sm:-ml-48 -mb-32 sm:-mb-48 blur-3xl" />
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-black mb-4 sm:mb-8 relative z-10 tracking-tight leading-tight">
            Ready to own your campus life?
          </h2>
          <p className="text-base sm:text-xl opacity-90 mb-8 sm:mb-12 max-w-2xl mx-auto relative z-10 font-medium">
            Join 40,000+ McGill students and start discovering what&apos;s next.
            No more missed nights, just better stories.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center relative z-10">
            <Link
              href="/"
              className="bg-white text-[#ED1B2F] text-lg sm:text-xl font-black px-8 sm:px-12 py-4 sm:py-5 rounded-2xl shadow-2xl hover:shadow-white/25 hover:scale-[1.03] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ED1B2F] cursor-pointer"
            >
              Get Started Free
            </Link>
            <Link
              href="/"
              className="bg-black/20 border border-white/20 text-white text-lg sm:text-xl font-black px-8 sm:px-12 py-4 sm:py-5 rounded-2xl hover:bg-black/30 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#ED1B2F] cursor-pointer"
            >
              Request Club Demo
            </Link>
          </div>
          <p className="mt-8 sm:mt-12 text-xs sm:text-sm opacity-70 relative z-10 uppercase font-black tracking-widest">
            Available for iOS, Android, and Web
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Footer ─── */
function LandingFooter() {
  return (
    <footer className="py-12 sm:py-16 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid sm:grid-cols-2 md:grid-cols-4 gap-10 sm:gap-12">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#ED1B2F] p-2 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight uppercase">
              Uni-Verse
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-8">
            The central operating system for student life at McGill University.
            Making campus connections more meaningful since 2024.
          </p>
          <div className="flex gap-3">
            {[
              { icon: <AtSign className="w-5 h-5" />, label: "Email" },
              { icon: <Share2 className="w-5 h-5" />, label: "Share" },
              { icon: <Youtube className="w-5 h-5" />, label: "YouTube" },
            ].map((social) => (
              <a
                key={social.label}
                href="#"
                className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-[#ED1B2F] hover:text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED1B2F] focus-visible:ring-offset-2 cursor-pointer"
                aria-label={social.label}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-4 sm:mb-6">Platform</h4>
          <ul className="space-y-3 sm:space-y-4 text-slate-600 dark:text-slate-400 text-sm">
            <li>
              <Link
                href="/"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Event Search
              </Link>
            </li>
            <li>
              <a
                href="#clubs"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Club Directory
              </a>
            </li>
            <li>
              <a
                href="#organizers"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Pricing for Clubs
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Security &amp; Safety
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-4 sm:mb-6">Support</h4>
          <ul className="space-y-3 sm:space-y-4 text-slate-600 dark:text-slate-400 text-sm">
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Help Center
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                API Docs
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Community Guidelines
              </a>
            </li>
            <li>
              <a
                href="#"
                className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
              >
                Privacy Policy
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-slate-400 text-xs">
          &copy; 2024 Uni-Verse Technologies. Not affiliated with McGill
          University officially.
        </p>
        <div className="flex gap-6 text-xs text-slate-500 dark:text-slate-400">
          <a
            href="#"
            className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
          >
            Terms
          </a>
          <a
            href="#"
            className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
          >
            Privacy
          </a>
          <a
            href="#"
            className="hover:text-[#ED1B2F] transition-colors duration-200 cursor-pointer"
          >
            Cookies
          </a>
        </div>
      </div>
    </footer>
  );
}
