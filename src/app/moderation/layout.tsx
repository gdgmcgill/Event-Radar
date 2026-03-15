import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ModerationNav } from "./ModerationNav";
import { Bell, Settings, Shield } from "lucide-react";

export default async function ModerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin-login");
  }

  // Check admin role — also fetch name and avatar
  const { data: profile } = await supabase
    .from("users")
    .select("roles, email, name, avatar_url")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  if (!roles.includes("admin")) {
    redirect("/");
  }

  const displayName = profile?.name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Admin";
  const avatarUrl = profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null;
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Fixed sidebar */}
      <ModerationNav />

      {/* Main content area offset by sidebar width */}
      <div className="flex flex-1 flex-col pl-60">
        {/* Header bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <a
              href="/notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </a>
            <a
              href="/profile?tab=settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </a>

            <div className="mx-1.5 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

            {/* Admin profile chip */}
            <a
              href="/profile"
              className="flex items-center gap-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-1 pr-3 py-1 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-600 text-[10px] font-bold text-white">
                  {initials}
                </div>
              )}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-none">
                  {displayName}
                </span>
                <span className="flex items-center gap-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  <Shield className="h-2.5 w-2.5" />
                  Admin
                </span>
              </div>
            </a>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
