import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileHeader from "@/components/profile/ProfileHeader";
import InterestsCard from "@/components/profile/InterestsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Mail, Clock } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/");
  }

  // Fetch profile from database
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fallback to auth user data if profile doesn't exist
  const displayData = profile ?? {
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.name as string) ??
      (user.user_metadata?.full_name as string) ??
      null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    interest_tags: [],
    preferences: null,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto py-12 px-4 sm:px-6 space-y-8">
        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Account
          </h1>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            Your Profile
          </p>
        </div>

        {/* Profile Header - Avatar & Name (no card) */}
        <ProfileHeader
          name={displayData.name}
          email={displayData.email}
          avatarUrl={displayData.avatar_url}
          userId={displayData.id}
          editable
        />

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Main Content Grid */}
        <div className="grid gap-6">
          {/* Interests Card */}
          <InterestsCard
            userId={displayData.id}
            initialTags={displayData.interest_tags ?? []}
          />

        {/* Account Info Card and other Info*/}
        </div>
      </div>
    </div>
  );
}