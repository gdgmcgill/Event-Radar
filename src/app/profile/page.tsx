import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileCard from "@/components/profile/ProfileCard";

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
    name: (user.user_metadata?.name as string) ??
      (user.user_metadata?.full_name as string) ?? null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    preferences: null,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your profile</h1>
      </div>

      <ProfileCard displayData={displayData} />
    </div>
  );
}