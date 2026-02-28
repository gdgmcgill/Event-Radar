import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileHeader from "@/components/profile/ProfileHeader";
import InterestsCard from "@/components/profile/InterestsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Mail, Clock, Heart, Building2 } from "lucide-react";
import EditProfileButton from "@/components/profile/EditProfileButton";

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

  // Fetch clubs the user follows
  const { data: following } = await supabase
    .from("club_followers")
    .select(`
      id,
      created_at,
      clubs (
        id,
        name,
        logo_url,
        description,
        category
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Account
            </h1>
            <p className="text-3xl font-bold text-foreground tracking-tight">
              Your Profile
            </p>
          </div>

          <EditProfileButton
            userId={displayData.id}
            initialName={displayData.name ?? ""}
            initialAvatarUrl={displayData.avatar_url ?? ""}
            initialTags={(displayData.interest_tags ?? []) as import("@/types").EventTag[]}
          />
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
            initialTags={(displayData.interest_tags ?? []) as import("@/types").EventTag[]}
          />

          {/* Following Clubs Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5" />
                Following
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!following || following.length === 0) ? (
                <p className="text-sm text-muted-foreground">
                  You&apos;re not following any clubs yet. Visit the{" "}
                  <Link href="/clubs" className="text-primary hover:underline">clubs page</Link>{" "}
                  to discover clubs to follow.
                </p>
              ) : (
                <div className="space-y-3">
                  {following.map((f) => {
                    const club = f.clubs as unknown as { id: string; name: string; logo_url: string | null; description: string | null; category: string | null };
                    return (
                      <Link
                        key={f.id}
                        href={`/clubs/${club.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        {club.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={club.logo_url} alt={club.name} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{club.name}</p>
                          {club.category && (
                            <p className="text-xs text-muted-foreground">{club.category}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Info Card and other Info*/}
        </div>
      </div>
    </div>
  );
}