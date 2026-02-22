import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MyClubsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Check club_organizer or admin role
  const { data: profile } = await supabase
    .from("users")
    .select("roles")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  if (!roles.includes("club_organizer") && !roles.includes("admin")) {
    redirect("/");
  }

  return <>{children}</>;
}
