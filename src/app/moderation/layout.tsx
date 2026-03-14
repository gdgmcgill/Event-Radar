import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModerationNav } from "./ModerationNav";
import { Bell, Settings } from "lucide-react";

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

  // Check admin role
  const { data: profile } = await supabase
    .from("users")
    .select("roles, email")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  if (!roles.includes("admin")) {
    redirect("/");
  }

  const adminEmail = profile?.email ?? user.email ?? "Admin";
  const adminName = adminEmail.split("@")[0];

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Fixed sidebar */}
      <ModerationNav />

      {/* Main content area offset by sidebar width */}
      <div className="flex flex-1 flex-col pl-60">
        {/* Header bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          {/* Breadcrumb slot — pages can render into this area via their own heading */}
          <div />

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
              <Bell className="h-4 w-4" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
              <Settings className="h-4 w-4" />
            </button>

            <div className="mx-2 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold leading-none capitalize text-zinc-900 dark:text-zinc-100">
                  {adminName}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Admin</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
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
