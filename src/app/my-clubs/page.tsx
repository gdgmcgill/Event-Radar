import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { MyClubsList } from "@/components/clubs/MyClubsList";

export default async function MyClubsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch memberships to determine redirect vs list
  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id);

  const count = memberships?.length ?? 0;

  // Single-club redirect (LOCKED DECISION): skip list page entirely
  if (count === 1) {
    redirect(`/my-clubs/${memberships![0].club_id}`);
  }

  // No clubs: empty state
  if (count === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">My Clubs</h1>
        <EmptyState
          icon={Building2}
          title="You're not part of any clubs yet"
          description="Join a club or create one to start organizing events."
          action={{ label: "Browse Clubs", href: "/clubs" }}
        />
      </div>
    );
  }

  // 2+ clubs: render the client list
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">My Clubs</h1>
      <MyClubsList />
    </div>
  );
}
