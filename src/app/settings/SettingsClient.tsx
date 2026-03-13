"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import { PRONOUNS, YEARS, FACULTIES } from "@/lib/constants";
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
  ArrowLeft,
  Mail,
  GraduationCap,
  Calendar,
  Trash2,
} from "lucide-react";

type SettingsSection = "profile" | "interests" | "privacy" | "notifications" | "account";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  interest_tags: EventTag[];
  pronouns: string;
  year: string;
  faculty: string;
  visibility: string;
  created_at: string;
}

const SECTIONS: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "interests", label: "Interests", icon: Sparkles },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: Settings },
];

export default function SettingsClient({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { signOut } = useAuthStore();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  // Profile fields — initialised from server-fetched data
  const [name, setName] = useState(profile.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [pronouns, setPronouns] = useState(profile.pronouns);
  const [year, setYear] = useState(profile.year);
  const [faculty, setFaculty] = useState(profile.faculty);
  const [tags, setTags] = useState<EventTag[]>(profile.interest_tags);
  const [visibility, setVisibility] = useState(profile.visibility);

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
          avatar_url: avatarUrl.trim() || null,
          interest_tags: tags,
          pronouns: pronouns || null,
          year: year || null,
          faculty: faculty || null,
          visibility,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setSaved(true);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your profile, preferences, and account
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-56 flex-shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 lg:sticky lg:top-24">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/10"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {/* ── Profile ── */}
            {activeSection === "profile" && (
              <div className="space-y-6">
                <SettingsCard
                  icon={Camera}
                  title="Profile Photo & Name"
                  description="How others see you on UNI-VERSE"
                >
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex flex-col items-center gap-2">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="w-20 h-20 rounded-2xl object-cover ring-2 ring-primary/10"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                          {(name || profile.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-4 w-full">
                      <FieldGroup label="Display Name" required>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className={
                            name.trim().length > 0 && name.trim().length < 2
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }
                        />
                        {name.trim().length > 0 && name.trim().length < 2 && (
                          <p className="text-xs text-destructive mt-1">
                            At least 2 characters required.
                          </p>
                        )}
                      </FieldGroup>

                      <FieldGroup label="Avatar URL" optional>
                        <Input
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="https://example.com/photo.jpg"
                        />
                      </FieldGroup>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard
                  icon={GraduationCap}
                  title="McGill Details"
                  description="Helps connect you with relevant events and people"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldGroup label="Email">
                      <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{profile.email}</span>
                      </div>
                    </FieldGroup>

                    <FieldGroup label="Pronouns">
                      <select
                        value={pronouns}
                        onChange={(e) => setPronouns(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select...</option>
                        {PRONOUNS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </FieldGroup>

                    <FieldGroup label="Year">
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select...</option>
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </FieldGroup>

                    <FieldGroup label="Faculty">
                      <select
                        value={faculty}
                        onChange={(e) => setFaculty(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select...</option>
                        {FACULTIES.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </FieldGroup>
                  </div>
                </SettingsCard>

                <SaveBar
                  onSave={handleSave}
                  saving={saving}
                  saved={saved}
                  error={error}
                  disabled={!isProfileValid}
                />
              </div>
            )}

            {/* ── Interests ── */}
            {activeSection === "interests" && (
              <div className="space-y-6">
                <SettingsCard
                  icon={Sparkles}
                  title="Interest Tags"
                  description="Select 3–5 to personalise your event feed and recommendations"
                >
                  <InterestTagSelector
                    selected={tags}
                    onChange={setTags}
                    min={3}
                    max={5}
                  />
                  {tags.length > 0 && tags.length < 3 && (
                    <p className="text-xs text-destructive mt-4">
                      Pick at least 3 interests for personalised recommendations.
                    </p>
                  )}
                </SettingsCard>

                <SaveBar
                  onSave={handleSave}
                  saving={saving}
                  saved={saved}
                  error={error}
                  disabled={!isInterestsValid}
                />
              </div>
            )}

            {/* ── Privacy ── */}
            {activeSection === "privacy" && (
              <div className="space-y-6">
                <SettingsCard
                  icon={Shield}
                  title="Profile Visibility"
                  description="Control who can see your profile information"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <VisibilityOption
                      icon={Eye}
                      title="Public"
                      description="Anyone on UNI-VERSE can view your full profile, interests, and clubs."
                      selected={visibility === "public"}
                      onClick={() => setVisibility("public")}
                    />
                    <VisibilityOption
                      icon={EyeOff}
                      title="Private"
                      description="Only your friends can see your interests, clubs, and saved events."
                      selected={visibility === "private"}
                      onClick={() => setVisibility("private")}
                    />
                  </div>
                </SettingsCard>

                <SaveBar
                  onSave={handleSave}
                  saving={saving}
                  saved={saved}
                  error={error}
                  disabled={false}
                />
              </div>
            )}

            {/* ── Notifications ── */}
            {activeSection === "notifications" && (
              <div className="space-y-6">
                <SettingsCard
                  icon={Bell}
                  title="Notification Preferences"
                  description="Choose what you'd like to be notified about"
                >
                  <div className="divide-y divide-border">
                    <ToggleRow
                      label="Event Reminders"
                      description="Get reminded before events you've saved or RSVP'd to"
                      checked={emailReminders}
                      onChange={setEmailReminders}
                    />
                    <ToggleRow
                      label="New Event Alerts"
                      description="Events matching your interests are posted"
                      checked={newEventAlerts}
                      onChange={setNewEventAlerts}
                    />
                    <ToggleRow
                      label="Club Updates"
                      description="News and events from clubs you follow"
                      checked={clubUpdates}
                      onChange={setClubUpdates}
                    />
                  </div>
                </SettingsCard>

                <p className="text-xs text-muted-foreground text-center px-4">
                  Notification preferences are saved locally. Email controls coming in a future update.
                </p>
              </div>
            )}

            {/* ── Account ── */}
            {activeSection === "account" && (
              <div className="space-y-6">
                <SettingsCard
                  icon={User}
                  title="Account"
                  description="Your session and account info"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                      <div className="flex items-center gap-3 min-w-0">
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                            {(profile.name || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {profile.name || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {profile.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5 hover:border-destructive/40 flex-shrink-0"
                      >
                        {signingOut ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5" />
                        )}
                        {signingOut ? "Signing out..." : "Sign Out"}
                      </Button>
                    </div>

                    {profile.created_at && (
                      <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>
                          Member since{" "}
                          {new Date(profile.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </SettingsCard>

                {/* Danger Zone */}
                <div className="rounded-xl border border-destructive/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-destructive/10">
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Danger Zone</h3>
                      <p className="text-xs text-muted-foreground">
                        Permanent actions that cannot be undone
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/20 hover:bg-destructive/5 hover:border-destructive/40"
                    onClick={() => {
                      window.open(
                        "mailto:universe.mcgill@gmail.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20UNI-VERSE%20account.%20My%20email%20is%20" +
                          encodeURIComponent(profile.email)
                      );
                    }}
                  >
                    Request Account Deletion
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
        {optional && (
          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
        )}
      </label>
      {children}
    </div>
  );
}

function SaveBar({
  onSave,
  saving,
  saved,
  error,
  disabled,
}: {
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
      <div className="text-sm">
        {error && <span className="text-destructive">{error}</span>}
        {saved && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Saved successfully
          </span>
        )}
        {!error && !saved && (
          <span className="text-muted-foreground">Remember to save your changes</span>
        )}
      </div>
      <Button
        onClick={onSave}
        disabled={disabled || saving}
        className="gap-2 min-w-[140px]"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

function VisibilityOption({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: typeof Eye;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-xl border-2 text-center transition-all duration-200",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30 hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      {selected && (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          checked ? "bg-primary" : "bg-muted-foreground/25"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
