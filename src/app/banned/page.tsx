import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BannedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/landing");

  const { data: profile } = await supabase
    .from("users")
    .select("banned_at, ban_expires_at, ban_reason")
    .eq("id", user.id)
    .single();

  if (!profile?.banned_at) redirect("/");
  if (profile.ban_expires_at && new Date(profile.ban_expires_at) <= new Date()) {
    redirect("/");
  }

  const isPermanent = !profile.ban_expires_at;
  const expiryDate = profile.ban_expires_at ? new Date(profile.ban_expires_at) : null;
  // eslint-disable-next-line react-hooks/purity -- server component, Date.now() is fine
  const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4" aria-hidden="true">&#x1F6AB;</div>
        <h1 className="text-2xl font-bold text-white mb-2">Account Suspended</h1>
        <p className="text-zinc-400 mb-6">
          Your account has been suspended for violating community guidelines.
        </p>
        <div className="bg-zinc-900 rounded-lg p-4 text-left mb-6 border border-zinc-800">
          {profile.ban_reason && (
            <div className="mb-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Reason</div>
              <div className="text-sm text-zinc-300">{profile.ban_reason}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              {isPermanent ? "Duration" : "Expires"}
            </div>
            <div className="text-sm text-amber-400">
              {isPermanent
                ? "Permanent"
                : `${expiryDate!.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} (${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining)`}
            </div>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="px-6 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm hover:bg-zinc-700 transition-colors">
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
