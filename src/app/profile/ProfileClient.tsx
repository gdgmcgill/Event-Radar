"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import { PRONOUNS, YEARS, FACULTIES, EVENT_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  interest_tags: EventTag[];
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
  const [tags, setTags] = useState<EventTag[]>(profile.interest_tags);
  const [visibility, setVisibility] = useState(profile.visibility);

  // Avatar upload (shared hook)
  const avatar = useAvatarUpload(profile.avatar_url);

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
      {/* ── Tab Switcher ── */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 pt-4">
          <button
            onClick={switchToView}
            className={cn(
              "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "view"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Profile
          </button>
          <button
            onClick={switchToSettings}
            className={cn(
              "px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === "settings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      {/* ═══════════════ VIEW TAB ═══════════════ */}
      {activeTab === "view" && (
        <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Profile Card */}
            <div className="bg-card rounded-xl p-6 shadow-sm border border-primary/5 flex flex-col items-center text-center">
              {/* Avatar */}
              <div
                onClick={avatar.openFilePicker}
                className="relative h-36 w-36 rounded-full border-4 border-primary p-1 bg-card cursor-pointer group"
              >
                <div className={cn(
                  "w-full h-full rounded-full overflow-hidden flex items-center justify-center",
                  !avatar.avatarUrl && "bg-gradient-to-br from-primary/20 to-primary/5"
                )}>
                  {avatar.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl font-semibold text-primary">
                      {(profile.name || profile.email || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  )}
                  {!avatar.uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                  {avatar.uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); avatar.openFilePicker(); }}
                  className="absolute bottom-1 right-1 bg-primary text-white p-1.5 rounded-full border-2 border-card shadow-md hover:brightness-110 transition"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <input ref={avatar.fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={avatar.handleFileChange} className="hidden" />
              {avatar.error && <p className="text-sm text-destructive mt-2">{avatar.error}</p>}

              <h1 className="text-2xl font-bold mt-4 text-foreground">{profile.name ?? profile.email ?? "User"}</h1>
              {data.subtitle && <p className="text-primary font-medium">{data.subtitle}</p>}
              {profile.pronouns && <p className="text-sm text-muted-foreground mt-0.5">{profile.pronouns}</p>}
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="text-sm">Montreal, QC</span>
              </div>

              {/* Edit Profile → go to settings tab */}
              <div className="flex w-full gap-3 mt-6">
                <button
                  onClick={switchToSettings}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <Pencil className="h-4 w-4" /> Edit Profile
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Events", value: data.eventCount },
                { label: "Clubs", value: data.clubCount },
                { label: "Friends", value: data.friendCount },
              ].map((stat) => (
                <div key={stat.label} className="bg-card p-4 rounded-xl border border-primary/5 text-center">
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Interests */}
            {profile.interest_tags.length > 0 && (
              <div className="bg-card rounded-xl p-6 shadow-sm border border-primary/5">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <Heart className="h-5 w-5 text-primary" /> My Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interest_tags.map((tag) => {
                    const cat = EVENT_CATEGORIES[tag];
                    return (
                      <span key={tag} className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                        {cat?.label ?? tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Friends Preview */}
            {data.friends.length > 0 && (
              <div className="bg-card rounded-xl p-6 shadow-sm border border-primary/5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" /> Friends
                  </h3>
                  <Link href="/friends" className="text-xs text-primary font-bold">View All</Link>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {data.friends.slice(0, 3).map((friend: any) => (
                    <Link key={friend.id} href={`/users/${friend.id}`}>
                      {friend.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={friend.avatar_url} alt={friend.name ?? "Friend"} className="aspect-square rounded-lg object-cover w-full" />
                      ) : (
                        <div className="aspect-square rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {(friend.name ?? "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                  ))}
                  {data.friendCount > 3 && (
                    <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      +{data.friendCount - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Content */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            {/* Upcoming Events */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <Calendar className="h-5 w-5 text-primary" /> Upcoming Events
                </h3>
                <Link href="/my-events" className="text-sm text-primary font-bold flex items-center gap-1">
                  Full Schedule <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {data.upcomingEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.upcomingEvents.map((se: any) => {
                    const event = se.events;
                    const dateLabel = new Date(event.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const timeLabel = event.event_time ? (() => { const [h, m] = event.event_time.split(":"); const hr = parseInt(h, 10); return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; })() : "";
                    return (
                      <Link key={se.id} href={`/events/${event.id}`} className="bg-card rounded-xl overflow-hidden border border-primary/5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="h-32 bg-muted bg-cover bg-center" style={event.image_url ? { backgroundImage: `url('${event.image_url}')` } : undefined} />
                        <div className="p-4">
                          <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1 uppercase tracking-wider">
                            <Calendar className="h-3 w-3" />
                            {dateLabel} {timeLabel && `\u2022 ${timeLabel}`}
                          </div>
                          <h4 className="font-bold text-lg mb-1 text-foreground">{event.title}</h4>
                          {event.location && <p className="text-muted-foreground text-sm">{event.location}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-card rounded-xl p-8 border border-primary/5 text-center">
                  <Calendar className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No upcoming events. Browse events to find something interesting!</p>
                </div>
              )}
            </section>

            {/* Clubs */}
            {data.memberships.length > 0 && (
              <section>
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                  <Building2 className="h-5 w-5 text-primary" /> Member of
                </h3>
                <div className="flex flex-col gap-3">
                  {data.memberships.map((m: any) => {
                    const club = m.clubs as any;
                    return (
                      <Link key={m.id} href={`/my-clubs/${club.id}`} className="bg-card p-4 rounded-xl flex items-center justify-between border border-primary/5 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {club.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={club.logo_url} alt={club.name} className="h-12 w-12 rounded-lg object-cover" />
                            ) : (<Code className="h-7 w-7" />)}
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground">{club.name}</h4>
                            <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Following */}
            {data.following.length > 0 && !data.memberships.length && (
              <section>
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                  <Heart className="h-5 w-5 text-primary" /> Following
                </h3>
                <div className="flex flex-col gap-3">
                  {data.following.map((f: any) => {
                    const club = f.clubs as any;
                    return (
                      <Link key={f.id} href={`/clubs/${club.id}`} className="bg-card p-4 rounded-xl flex items-center justify-between border border-primary/5 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {club.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={club.logo_url} alt={club.name} className="h-12 w-12 rounded-lg object-cover" />
                            ) : (<Camera className="h-7 w-7" />)}
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground">{club.name}</h4>
                            {club.category && <p className="text-xs text-muted-foreground">{club.category}</p>}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Event History */}
            {data.pastEvents.length > 0 && (
              <section>
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground">
                  <Clock className="h-5 w-5 text-primary" /> Event History
                </h3>
                <div className="overflow-x-auto rounded-xl border border-primary/5">
                  <table className="w-full text-left">
                    <thead className="bg-primary/5 text-primary text-xs uppercase font-bold tracking-wider">
                      <tr><th className="p-4">Event</th><th className="p-4">Date</th><th className="p-4">Status</th><th className="p-4">Location</th></tr>
                    </thead>
                    <tbody className="text-sm bg-card">
                      {data.pastEvents.map((se: any) => {
                        const event = se.events;
                        return (
                          <tr key={se.id} className="border-b border-primary/5 last:border-0">
                            <td className="p-4 font-semibold text-foreground"><Link href={`/events/${event.id}`} className="hover:text-primary transition-colors">{event.title}</Link></td>
                            <td className="p-4 text-muted-foreground">{new Date(event.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                            <td className="p-4"><span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs">Attended</span></td>
                            <td className="p-4 text-muted-foreground">{event.location || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      {/* ═══════════════ SETTINGS TAB ═══════════════ */}
      {activeTab === "settings" && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
                    <InterestTagSelector selected={tags} onChange={setTags} min={3} max={6} />
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
                      onClick={() => window.open("mailto:universe.mcgill@gmail.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20UNI-VERSE%20account.%20My%20email%20is%20" + encodeURIComponent(profile.email))}>
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
