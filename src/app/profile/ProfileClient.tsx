"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import { PRONOUNS, YEARS, FACULTIES, EVENT_CATEGORIES, QUICK_FILTER_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CONTACT_EMAILS } from "@/lib/contact";
import type { EventTag } from "@/types";
import {
  User,
  Settings,
  Eye,
  EyeOff,
  Bell,
  Shield,
  LogOut,
  Loader2,
  Check,
  Camera,
  Sparkles,
  Mail,
  GraduationCap,
  Calendar,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Palette,
  Upload,
  ImagePlus,
  X,
  MapPin,
  Building2,
  Heart,
  Users,
  Clock,
  ChevronRight,
  ArrowRight,
  Code,
  Pencil,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  interest_tags: string[];
  inferred_tags: string[];
  pronouns: string | null;
  year: string | null;
  faculty: string | null;
  visibility: string;
  created_at: string;
}

interface ProfileViewData {
  profile: ProfileData;
  subtitle: string | null;
  friendCount: number;
  clubCount: number;
  eventCount: number;
  friends: any[];
  memberships: any[];
  following: any[];
  upcomingEvents: any[];
  pastEvents: any[];
}

type SettingsSection = "profile" | "interests" | "appearance" | "privacy" | "notifications" | "account";

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "interests", label: "Interests", icon: Sparkles },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: Settings },
];

/* ─── Main Component ──────────────────────────────────────────────────────── */

export default function ProfileClient({ data }: { data: ProfileViewData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, updateUser } = useAuthStore();
  const { profile } = data;

  // Tab: "view" or "settings"
  const initialTab = searchParams.get("tab") === "settings" ? "settings" : "view";
  const [activeTab, setActiveTab] = useState<"view" | "settings">(initialTab);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("profile");

  // Profile edit fields
  const [name, setName] = useState(profile.name ?? "");
  const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
  const [year, setYear] = useState(profile.year ?? "");
  const [faculty, setFaculty] = useState(profile.faculty ?? "");
  const [tags, setTags] = useState<string[]>(profile.interest_tags);
  const [visibility, setVisibility] = useState(profile.visibility);

  // Avatar upload (shared hook)
  const avatar = useAvatarUpload(profile.avatar_url);

  // Banner upload
  const [bannerUrl, setBannerUrl] = useState<string | null>(profile.banner_url);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { setBannerError("Only JPEG, PNG, or WebP."); return; }
    if (file.size > 8 * 1024 * 1024) { setBannerError("Max 8MB."); return; }
    setBannerUploading(true);
    setBannerError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/banner", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setBannerUrl(data.banner_url);
      router.refresh();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleRemoveBanner = async () => {
    setBannerUploading(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner_url: null }),
      });
      if (!res.ok) throw new Error("Failed to remove banner");
      setBannerUrl(null);
      router.refresh();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBannerUploading(false);
    }
  };

  // Theme
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") setThemeState(saved);
      else setThemeState("system");
    } catch { /* noop */ }
  }, []);
  const applyTheme = (t: "light" | "dark" | "system") => {
    setThemeState(t);
    try {
      if (t === "system") {
        localStorage.removeItem("theme");
        document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
      } else {
        localStorage.setItem("theme", t);
        document.documentElement.classList.toggle("dark", t === "dark");
      }
    } catch { /* noop */ }
  };

  // Notification prefs (local)
  const [emailReminders, setEmailReminders] = useState(true);
  const [newEventAlerts, setNewEventAlerts] = useState(true);
  const [clubUpdates, setClubUpdates] = useState(true);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const accountDeletionEmail = CONTACT_EMAILS.support;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          interest_tags: tags,
          pronouns: pronouns || null,
          year: year || null,
          faculty: faculty || null,
          visibility,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSaved(true);
      updateUser({
        name: name.trim(),
        interest_tags: tags,
        pronouns: pronouns || null,
        year: year || null,
        faculty: faculty || null,
        visibility: (visibility as "public" | "private") || "public",
      });
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push("/");
  };

  const selectClass =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground";
  const isProfileValid = name.trim().length >= 2;
  const isInterestsValid = tags.length >= 3;

  const switchToSettings = () => {
    setActiveTab("settings");
    window.history.replaceState(null, "", "/profile?tab=settings");
  };
  const switchToView = () => {
    setActiveTab("view");
    window.history.replaceState(null, "", "/profile");
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Tab switcher is rendered inside the hero for view tab, or standalone for settings */}

      {/* ═══════════════ VIEW TAB ═══════════════ */}
      {activeTab === "view" && (
        <div className="w-full min-h-screen relative overflow-hidden">
          {/* Ambient color bleed — extends behind the entire page, no hard cutoff */}
          <div className="absolute inset-0 -z-10">
            {(bannerUrl || avatar.avatarUrl) ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(bannerUrl || avatar.avatarUrl)!} alt="" className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30 dark:opacity-15 saturate-150" />
                <div className="absolute inset-0 bg-background/80 dark:bg-background/90" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
            )}
          </div>

          {/* Hero Banner — crisp foreground image */}
          <div className="relative w-full h-[38vh] min-h-[300px]">
            <div className="absolute inset-0 overflow-hidden">
              {bannerUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background" />
                </>
              ) : avatar.avatarUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatar.avatarUrl} alt="" className="w-full h-full object-cover scale-150 blur-2xl saturate-150" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-primary/5 to-background" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/40 to-primary/60 dark:from-primary/15 dark:via-primary/20 dark:to-primary/10" />
              )}
            </div>
            {/* Smooth fade into page */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-60% to-background" />

            {/* Top bar — tabs + edit banner */}
            <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Glass tab pills */}
                <div className="flex items-center gap-1 bg-black/30 dark:bg-black/40 backdrop-blur-2xl rounded-full p-1 border border-white/15">
                  <button
                    onClick={switchToView}
                    className="px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer bg-white/20 text-white shadow-sm"
                  >
                    Profile
                  </button>
                  <button
                    onClick={switchToSettings}
                    className="px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-1.5 cursor-pointer text-white/60 hover:text-white/90"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </button>
                </div>

                {/* Edit Banner pill */}
                <button
                  onClick={() => { switchToSettings(); setTimeout(() => setSettingsSection("profile"), 100); }}
                  aria-label="Edit profile banner"
                  className="flex items-center gap-2 bg-black/30 dark:bg-black/40 hover:bg-black/50 backdrop-blur-2xl border border-white/15 text-white px-4 py-2 rounded-full transition-all duration-200 ease-out cursor-pointer text-sm font-medium"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit Banner</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main content — overlaps hero */}
          <main className="w-full px-4 sm:px-8 lg:px-12 pb-24 -mt-28 relative z-10">
            {/* Profile Info Card — frosted glass */}
            <div className="bg-white/70 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 sm:p-8 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-20 sm:-mt-24 mb-6">
                {/* Avatar */}
                <div
                  onClick={avatar.openFilePicker}
                  className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full shrink-0 cursor-pointer group"
                >
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/60 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 blur-sm" />
                  <div className="relative w-full h-full rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-xl border-[4px] border-white/80 dark:border-white/[0.04] shadow-xl overflow-hidden">
                    {avatar.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar.avatarUrl} alt="Your avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold text-primary">
                          {(profile.name || profile.email || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      </div>
                    )}
                    {!avatar.uploading && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Camera className="w-5 h-5 text-white" />
                        <span className="text-[10px] font-medium text-white/80">Change</span>
                      </div>
                    )}
                    {avatar.uploading && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-8 h-8 rounded-full bg-primary/90 backdrop-blur-sm text-white flex items-center justify-center shadow-lg border-2 border-white/50 dark:border-white/20 group-hover:scale-110 transition-transform duration-200">
                    <Pencil className="h-3.5 w-3.5" />
                  </div>
                </div>
                <input ref={avatar.fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={avatar.handleFileChange} className="hidden" />

                {/* Identity block */}
                <div className="flex-1 min-w-0 pb-1 sm:pb-2">
                  {profile.visibility === "private" && (
                    <div className="mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/30 dark:border-white/[0.04] text-foreground/70">
                        <EyeOff className="h-3 w-3" /> Private
                      </span>
                    </div>
                  )}
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground leading-tight tracking-tight flex items-baseline gap-2 flex-wrap">
                    {profile.name ?? profile.email ?? "User"}
                    {profile.pronouns && (
                      <span className="text-xs font-medium text-muted-foreground/60">{profile.pronouns}</span>
                    )}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {data.subtitle && (
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4 shrink-0" />
                        {data.subtitle}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      Montreal, QC
                    </span>
                    {profile.created_at && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        Joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  {avatar.error && <p className="text-xs text-destructive mt-1.5">{avatar.error}</p>}
                </div>

                {/* Edit Profile — glass button */}
                <div className="shrink-0 self-start sm:self-end">
                  <Button onClick={switchToSettings} variant="outline" className="gap-2 rounded-full px-6 bg-white/40 dark:bg-white/10 backdrop-blur-md border-white/50 dark:border-white/[0.06] hover:bg-primary hover:text-white hover:border-primary transition-all duration-200">
                    <Pencil className="h-3.5 w-3.5" /> Edit Profile
                  </Button>
                </div>
              </div>

              {/* Bento-style Stats — glass cells */}
              <div className="grid grid-cols-3 gap-3 pt-5 border-t border-white/20 dark:border-white/[0.04]">
                {[
                  { value: data.eventCount, label: "Events", icon: Calendar },
                  { value: data.clubCount, label: "Clubs", icon: Building2 },
                  { value: data.friendCount, label: "Friends", icon: Users },
                ].map((stat) => (
                  <div key={stat.label} className="group relative flex flex-col items-center justify-center py-4 rounded-xl bg-white/40 dark:bg-white/[0.05] backdrop-blur-lg border border-white/30 dark:border-white/[0.03] hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200 cursor-default">
                    <stat.icon className="h-4 w-4 text-muted-foreground/50 mb-1.5 group-hover:text-primary/60 transition-colors duration-200" />
                    <div className="text-2xl sm:text-3xl font-black text-foreground leading-none">{stat.value}</div>
                    <div className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Left Column — Sidebar */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                {/* Interests — glass card */}
                {(profile.interest_tags.length > 0 || profile.inferred_tags.length > 0) && (
                  <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                    <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      Interests
                    </h3>
                    {profile.interest_tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {profile.interest_tags.map((tag) => {
                          const meta = EVENT_CATEGORIES[tag as EventTag] ?? QUICK_FILTER_CATEGORIES[tag];
                          const label = meta?.label ?? tag;
                          return (
                            <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 dark:bg-primary/15 backdrop-blur-sm text-primary border border-primary/15 dark:border-primary/20 hover:bg-primary/20 transition-colors duration-200 cursor-default">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {profile.inferred_tags.length > 0 && (
                      <div className={profile.interest_tags.length > 0 ? "mt-4 pt-4 border-t border-white/20 dark:border-white/[0.04]" : ""}>
                        <p className="text-[11px] text-muted-foreground font-medium mb-2.5 uppercase tracking-wider">Learned from activity</p>
                        <div className="flex flex-wrap gap-2">
                          {profile.inferred_tags.map((tag) => {
                            const label = EVENT_CATEGORIES[tag as EventTag]?.label ?? QUICK_FILTER_CATEGORIES[tag]?.label ?? tag;
                            return (
                              <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-primary/25 text-primary/70 cursor-default">
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Friends Preview — glass card */}
                {data.friends.length > 0 && (
                  <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        Friends
                      </h3>
                      <span className="text-xs font-medium text-muted-foreground bg-white/50 dark:bg-white/10 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/30 dark:border-white/[0.04]">{data.friendCount}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2.5">
                      {data.friends.slice(0, 7).map((friend: any) => (
                        <Link key={friend.id} href={`/users/${friend.id}`} className="group cursor-pointer">
                          {friend.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={friend.avatar_url} alt={friend.name ?? "Friend"} className="aspect-square rounded-xl object-cover w-full ring-2 ring-white/40 dark:ring-white/10 group-hover:ring-primary/40 transition-all duration-200 group-hover:scale-[1.03]" />
                          ) : (
                            <div className="aspect-square rounded-xl bg-white/40 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all duration-200 ring-2 ring-white/30 dark:ring-white/10">
                              {(friend.name ?? "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground text-center mt-1 truncate group-hover:text-foreground transition-colors duration-200">
                            {(friend.name ?? "User").split(" ")[0]}
                          </p>
                        </Link>
                      ))}
                      {data.friendCount > 7 && (
                        <div className="aspect-square rounded-xl bg-white/30 dark:bg-white/[0.05] backdrop-blur-sm flex items-center justify-center text-xs font-bold text-muted-foreground ring-2 ring-white/20 dark:ring-white/10">
                          +{data.friendCount - 7}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Club Memberships — glass card */}
                {data.memberships.length > 0 && (
                  <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                    <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      Clubs
                    </h3>
                    <div className="flex flex-col gap-1">
                      {data.memberships.map((m: any) => {
                        const club = m.clubs as any;
                        const isOrgRole = m.role === "organizer" || m.role === "admin" || m.role === "president";
                        return (
                          <Link
                            key={m.id}
                            href={`/my-clubs/${club.id}`}
                            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
                          >
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/30 dark:ring-white/10 group-hover:ring-primary/30 transition-all duration-200">
                              {club.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={club.logo_url} alt={club.name} className="h-10 w-10 rounded-lg object-cover" />
                              ) : (
                                <Building2 className="h-5 w-5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-200 truncate">
                                {club.name}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                                {isOrgRole && <Shield className="h-3 w-3 text-primary" />}
                                {m.role}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Following — glass card */}
                {data.following.length > 0 && !data.memberships.length && (
                  <div className="bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/[0.04] shadow-sm p-6 hover:bg-white/70 dark:hover:bg-white/[0.12] transition-all duration-200">
                    <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Heart className="h-4 w-4 text-primary" />
                      </div>
                      Following
                    </h3>
                    <div className="flex flex-col gap-1">
                      {data.following.map((f: any) => {
                        const club = f.clubs as any;
                        return (
                          <Link
                            key={f.id}
                            href={`/clubs/${club.id}`}
                            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 dark:hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
                          >
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/30 dark:ring-white/10 group-hover:ring-primary/30 transition-all duration-200">
                              {club.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={club.logo_url} alt={club.name} className="h-10 w-10 rounded-lg object-cover" />
                              ) : (
                                <Building2 className="h-5 w-5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-200 truncate">{club.name}</p>
                              {club.category && <p className="text-xs text-muted-foreground">{club.category}</p>}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column — Events */}
              <div className="lg:col-span-2 flex flex-col gap-8">
                {/* Upcoming Events */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Calendar className="h-4.5 w-4.5 text-primary" />
                      </div>
                      Upcoming Events
                    </h2>
                    <Link href="/my-events" className="group text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all duration-200">
                      Full Schedule <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                    </Link>
                  </div>
                  {data.upcomingEvents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {data.upcomingEvents.map((se: any) => {
                        const event = se.events;
                        const sd = new Date(event.start_date);
                        const timeLabel = sd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                        return (
                          <Link key={se.id} href={`/events/${event.id}`} className="group bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/40 dark:border-white/[0.04] shadow-sm hover:shadow-[0_8px_30px_rgba(237,27,47,0.12)] hover:bg-white/75 dark:hover:bg-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
                            <div className="h-36 bg-muted bg-cover bg-center relative overflow-hidden" style={event.image_url ? { backgroundImage: `url('${event.image_url}')` } : undefined}>
                              <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-black/60 via-transparent to-transparent" />
                              {/* Glass date badge */}
                              <div className="absolute bottom-3 left-3 flex flex-col bg-white/70 dark:bg-black/40 backdrop-blur-2xl border border-white/40 dark:border-white/[0.06] rounded-xl px-3.5 py-2 shadow-lg">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{sd.toLocaleDateString("en-US", { month: "short" })}</span>
                                <span className="text-2xl font-black leading-none text-foreground -mt-0.5">{sd.getDate()}</span>
                              </div>
                            </div>
                            <div className="p-4 relative">
                              <h4 className="font-bold text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-1">{event.title}</h4>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{timeLabel}</span>
                                {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span className="truncate max-w-[120px]">{event.location}</span></span>}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white/50 dark:bg-white/[0.04] backdrop-blur-2xl rounded-2xl border border-dashed border-white/40 dark:border-white/[0.04] p-10 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/50 dark:bg-white/[0.08] backdrop-blur-sm flex items-center justify-center mx-auto mb-4 border border-white/30 dark:border-white/[0.04]">
                        <Calendar className="h-7 w-7 text-muted-foreground/40" />
                      </div>
                      <p className="font-medium text-foreground mb-1">No upcoming events</p>
                      <p className="text-sm text-muted-foreground">Browse events to find something interesting!</p>
                    </div>
                  )}
                </section>

                {/* Past Events — glass table */}
                {data.pastEvents.length > 0 && (
                  <section className="space-y-4">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <Clock className="h-4.5 w-4.5 text-primary" />
                      </div>
                      Event History
                    </h2>
                    <div className="overflow-x-auto rounded-2xl border border-white/40 dark:border-white/[0.04] bg-white/60 dark:bg-white/[0.08] backdrop-blur-2xl shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-white/40 dark:bg-white/[0.04] text-[11px] uppercase font-semibold tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3.5">Event</th>
                            <th className="px-5 py-3.5">Date</th>
                            <th className="px-5 py-3.5">Status</th>
                            <th className="px-5 py-3.5 hidden sm:table-cell">Location</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {data.pastEvents.map((se: any) => {
                            const event = se.events;
                            return (
                              <tr key={se.id} className="border-t border-white/20 dark:border-white/[0.03] hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors duration-150">
                                <td className="px-5 py-4 font-semibold text-foreground">
                                  <Link href={`/events/${event.id}`} className="hover:text-primary transition-colors duration-200 cursor-pointer">{event.title}</Link>
                                </td>
                                <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                                  {new Date(event.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </td>
                                <td className="px-5 py-4">
                                  <span className="bg-green-500/15 dark:bg-green-400/15 backdrop-blur-sm text-green-700 dark:text-green-300 px-2.5 py-1 rounded-lg text-xs font-medium border border-green-500/20 dark:border-green-400/20">Attended</span>
                                </td>
                                <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{event.location || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ═══════════════ SETTINGS TAB ═══════════════ */}
      {activeTab === "settings" && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Tab bar for settings */}
          <div className="flex items-center gap-1 mb-6 bg-secondary/40 dark:bg-white/[0.05] backdrop-blur-sm rounded-full p-1 w-fit border border-border/50 dark:border-white/[0.04]">
            <button
              onClick={switchToView}
              className="px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              Profile
            </button>
            <button
              onClick={switchToSettings}
              className="px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-1.5 cursor-pointer bg-primary text-white shadow-sm"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Settings Sidebar */}
            <div className="lg:w-56 flex-shrink-0">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 lg:sticky lg:top-24">
                {SETTINGS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = settingsSection === section.id;
                  return (
                    <button key={section.id} onClick={() => setSettingsSection(section.id)} className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                      isActive ? "bg-primary text-white shadow-md shadow-primary/10" : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10"
                    )}>
                      <Icon className="h-4 w-4 flex-shrink-0" /> {section.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="flex-1 min-w-0">
              {settingsSection === "profile" && (
                <div className="space-y-6">
                  <SettingsCard icon={Camera} title="Profile Photo & Name" description="How others see you on UNI-VERSE">
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="flex flex-col items-center gap-3">
                        <div onClick={avatar.openFilePicker} className="relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group ring-2 ring-primary/10">
                          {avatar.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                              {(name || profile.email || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          {!avatar.uploading && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Upload className="w-5 h-5 text-white mb-1" /><span className="text-[10px] text-white font-medium">Upload</span>
                            </div>
                          )}
                          {avatar.uploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                          )}
                        </div>
                        <button onClick={avatar.openFilePicker} disabled={avatar.uploading} className="text-xs text-primary font-medium hover:underline disabled:opacity-50">
                          {avatar.uploading ? "Uploading..." : "Change photo"}
                        </button>
                        <input ref={avatar.fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={avatar.handleFileChange} className="hidden" />
                        {avatar.error && <p className="text-xs text-destructive text-center max-w-[160px]">{avatar.error}</p>}
                      </div>
                      <div className="flex-1 space-y-4 w-full">
                        <FieldGroup label="Display Name" required>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                            className={name.trim().length > 0 && name.trim().length < 2 ? "border-destructive focus-visible:ring-destructive" : ""} />
                          {name.trim().length > 0 && name.trim().length < 2 && <p className="text-xs text-destructive mt-1">At least 2 characters required.</p>}
                        </FieldGroup>
                      </div>
                    </div>
                  </SettingsCard>
                  <SettingsCard icon={ImagePlus} title="Profile Banner" description="Displayed at the top of your profile page">
                    <div className="space-y-3">
                      <div
                        onClick={() => !bannerUploading && bannerInputRef.current?.click()}
                        className="relative w-full h-36 rounded-xl overflow-hidden cursor-pointer group border border-dashed border-border hover:border-primary/50 transition-colors"
                      >
                        {bannerUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImagePlus className="h-6 w-6 text-white" />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveBanner(); }}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                              aria-label="Remove banner"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full bg-muted/50 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <ImagePlus className="h-8 w-8" />
                            <span className="text-xs font-medium">Click to upload a banner image</span>
                          </div>
                        )}
                        {bannerUploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerUpload} className="hidden" />
                      {bannerError && <p className="text-xs text-destructive">{bannerError}</p>}
                      <p className="text-xs text-muted-foreground">Recommended: 1500x500px. Max 8MB. JPEG, PNG, or WebP.</p>
                    </div>
                  </SettingsCard>
                  <SettingsCard icon={GraduationCap} title="McGill Details" description="Helps connect you with relevant events and people">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldGroup label="Email">
                        <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4 flex-shrink-0" /><span className="truncate">{profile.email}</span>
                        </div>
                      </FieldGroup>
                      <FieldGroup label="Pronouns">
                        <select value={pronouns} onChange={(e) => setPronouns(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          {PRONOUNS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup label="Year">
                        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup label="Faculty">
                        <select value={faculty} onChange={(e) => setFaculty(e.target.value)} className={selectClass}>
                          <option value="">Select...</option>
                          {FACULTIES.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </FieldGroup>
                    </div>
                  </SettingsCard>
                  <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} disabled={!isProfileValid} />
                </div>
              )}

              {settingsSection === "interests" && (
                <div className="space-y-6">
                  <SettingsCard icon={Sparkles} title="Interest Tags" description="Select 3–6 to personalise your event feed and recommendations">
                    <InterestTagSelector selected={tags} onChange={setTags} min={3} />
                    {tags.length > 0 && tags.length < 3 && <p className="text-xs text-destructive mt-4">Pick at least 3 interests.</p>}
                  </SettingsCard>
                  <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} disabled={!isInterestsValid} />
                </div>
              )}

              {settingsSection === "appearance" && (
                <SettingsCard icon={Palette} title="Theme" description="Choose how UNI-VERSE looks to you">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <CardOption icon={Sun} title="Light" desc="Clean and bright" selected={theme === "light"} onClick={() => applyTheme("light")} />
                    <CardOption icon={Moon} title="Dark" desc="Easy on the eyes" selected={theme === "dark"} onClick={() => applyTheme("dark")} />
                    <CardOption icon={Monitor} title="System" desc="Match your device" selected={theme === "system"} onClick={() => applyTheme("system")} />
                  </div>
                </SettingsCard>
              )}

              {settingsSection === "privacy" && (
                <div className="space-y-6">
                  <SettingsCard icon={Shield} title="Profile Visibility" description="Control who can see your profile information">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CardOption icon={Eye} title="Public" desc="Anyone on UNI-VERSE can view your full profile." selected={visibility === "public"} onClick={() => setVisibility("public")} />
                      <CardOption icon={EyeOff} title="Private" desc="Only friends can see your interests and clubs." selected={visibility === "private"} onClick={() => setVisibility("private")} />
                    </div>
                  </SettingsCard>
                  <SaveBar onSave={handleSave} saving={saving} saved={saved} error={error} disabled={false} />
                </div>
              )}

              {settingsSection === "notifications" && (
                <div className="space-y-6">
                  <SettingsCard icon={Bell} title="Notification Preferences" description="Choose what you'd like to be notified about">
                    <div className="divide-y divide-border">
                      <ToggleRow label="Event Reminders" description="Before events you've saved or RSVP'd to" checked={emailReminders} onChange={setEmailReminders} />
                      <ToggleRow label="New Event Alerts" description="Events matching your interests" checked={newEventAlerts} onChange={setNewEventAlerts} />
                      <ToggleRow label="Club Updates" description="News from clubs you follow" checked={clubUpdates} onChange={setClubUpdates} />
                    </div>
                  </SettingsCard>
                  <p className="text-xs text-muted-foreground text-center">Notification preferences are saved locally. Email controls coming soon.</p>
                </div>
              )}

              {settingsSection === "account" && (
                <div className="space-y-6">
                  <SettingsCard icon={User} title="Account" description="Your session and account info">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                        <div className="flex items-center gap-3 min-w-0">
                          {avatar.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/10 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                              {(name || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{name || "User"}</p>
                            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut} className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5 flex-shrink-0">
                          {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                          {signingOut ? "Signing out..." : "Sign Out"}
                        </Button>
                      </div>
                      {profile.created_at && (
                        <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  </SettingsCard>
                  <div className="rounded-xl border border-destructive/20 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-destructive/10"><Trash2 className="w-5 h-5 text-destructive" /></div>
                      <div><h3 className="text-sm font-semibold text-foreground">Danger Zone</h3><p className="text-xs text-muted-foreground">Permanent actions that cannot be undone</p></div>
                    </div>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/5"
                      onClick={() => window.open(`mailto:${accountDeletionEmail}?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20UNI-VERSE%20account.%20My%20email%20is%20` + encodeURIComponent(profile.email))}>
                      Request Account Deletion
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Avatar Crop Modal */}
      {avatar.cropImageSrc && (
        <AvatarCropModal open={avatar.cropModalOpen} onClose={avatar.handleCropModalClose} imageSrc={avatar.cropImageSrc} onCropComplete={avatar.handleCropComplete} />
      )}
    </div>
  );
}

/* ─── Shared Sub-components ───────────────────────────────────────────────── */

function SettingsCard({ icon: Icon, title, description, children }: { icon: typeof User; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10"><Icon className="w-5 h-5 text-primary" /></div>
        <div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}{required && <span className="text-primary ml-1">*</span>}</label>
      {children}
    </div>
  );
}

function SaveBar({ onSave, saving, saved, error, disabled }: { onSave: () => void; saving: boolean; saved: boolean; error: string | null; disabled: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="text-sm">
        {error && <span className="text-destructive">{error}</span>}
        {saved && <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5"><Check className="h-4 w-4" /> Saved successfully</span>}
        {!error && !saved && <span className="text-muted-foreground">Remember to save your changes</span>}
      </div>
      <Button onClick={onSave} disabled={disabled || saving} className="gap-2 min-w-[140px]">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

function CardOption({ icon: Icon, title, desc, selected, onClick }: { icon: typeof Eye; title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "flex flex-col items-center gap-3 p-5 rounded-xl border-2 text-center transition-all duration-200",
      selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-muted/30"
    )}>
      <div className={cn("flex items-center justify-center w-11 h-11 rounded-full transition-colors", selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        <Icon className="h-5 w-5" />
      </div>
      <div><p className="font-semibold text-foreground text-sm">{title}</p><p className="text-xs text-muted-foreground mt-0.5">{desc}</p></div>
      {selected && <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white"><Check className="h-3 w-3" /></div>}
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <div className="pr-4"><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground mt-0.5">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200", checked ? "bg-primary" : "bg-muted-foreground/25")}>
        <span className={cn("pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200", checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}
