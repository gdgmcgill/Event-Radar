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
    <div className="flex min-h-screen bg-background">
      {/* Fixed sidebar */}
      <ModerationNav />

      {/* Main content area offset by sidebar width */}
      <div className="flex flex-1 flex-col pl-60">
        {/* Header bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-2xl">
          <div />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <a
              href="/notifications"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </a>
            <a
              href="/profile?tab=settings"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </a>

            <div className="mx-1.5 h-6 w-px bg-border" />

            {/* Admin profile chip */}
            <a
              href="/profile"
              className="flex items-center gap-2.5 rounded-full border border-border bg-card pl-1 pr-3 py-1 hover:border-primary/20 transition-colors"
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
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {initials}
                </div>
              )}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground leading-none">
                  {displayName}
                </span>
                <span className="flex items-center gap-0.5 bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded">
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
