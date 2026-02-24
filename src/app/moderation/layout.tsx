import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModerationNav } from "./ModerationNav";

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
    .select("roles")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  if (!roles.includes("admin")) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <ModerationNav />
      {children}
    </div>
  );
}
