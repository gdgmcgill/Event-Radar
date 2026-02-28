import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClubDashboard } from "@/components/clubs/ClubDashboard";
import type { Club } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ClubDashboardPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [
    { data: club },
    { data: membership },
    { count: memberCount },
    { count: followerCount },
  ] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).single(),
    supabase
      .from("club_members")
      .select("role")
      .eq("club_id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("club_members")
      .select("*", { count: "exact", head: true })
      .eq("club_id", id),
    supabase
      .from("club_followers")
      .select("*", { count: "exact", head: true })
      .eq("club_id", id),
  ]);

  if (!club || !membership) {
    notFound();
  }

  const role = membership.role as "owner" | "organizer";

  let pendingInvitesCount: number | null = null;
  if (role === "owner") {
    const { count } = await supabase
      .from("club_invitations")
      .select("*", { count: "exact", head: true })
      .eq("club_id", id)
      .eq("status", "pending");
    pendingInvitesCount = count ?? 0;
  }

  const initialTab = tab ?? "overview";

  return (
    <ClubDashboard
      club={club as Club}
      role={role}
      memberCount={memberCount ?? 0}
      pendingInvitesCount={pendingInvitesCount}
      initialTab={initialTab}
      userId={user.id}
      followerCount={followerCount ?? 0}
    />
  );
}
