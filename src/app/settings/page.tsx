import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import type { EventTag } from "@/types";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/?signin=required&next=/settings");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const displayData = {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? (user.user_metadata?.name as string) ?? null,
    avatar_url: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null,
    interest_tags: (profile?.interest_tags as EventTag[]) ?? [],
    pronouns: ((profile as Record<string, unknown>)?.pronouns as string) ?? "",
    year: ((profile as Record<string, unknown>)?.year as string) ?? "",
    faculty: ((profile as Record<string, unknown>)?.faculty as string) ?? "",
    visibility: ((profile as Record<string, unknown>)?.visibility as string) ?? "public",
    created_at: user.created_at,
  };

  return <SettingsClient profile={displayData} />;
}
