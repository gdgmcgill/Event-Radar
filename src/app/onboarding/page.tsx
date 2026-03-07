import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/");

  const { data: profile } = await (supabase as any)
    .from("users")
    .select("onboarding_completed, name, avatar_url")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/");

  return (
    <OnboardingWizard
      userId={user.id}
      initialName={
        (profile?.name as string) ??
        (user.user_metadata?.name as string) ??
        (user.user_metadata?.full_name as string) ??
        ""
      }
      avatarUrl={
        (profile?.avatar_url as string) ??
        (user.user_metadata?.avatar_url as string) ??
        null
      }
    />
  );
}
