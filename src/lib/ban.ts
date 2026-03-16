import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface BanStatus {
  banned_at: string | null;
  ban_expires_at: string | null;
}

export function isBanned(user: BanStatus): boolean {
  if (!user.banned_at) return false;
  if (!user.ban_expires_at) return true; // permanent
  return new Date(user.ban_expires_at) > new Date();
}

/**
 * Check if the current authenticated user is banned.
 * Returns a 403 NextResponse if banned, or null if not banned / not authenticated.
 * Use at the top of POST handlers to block banned users from creating content.
 */
export async function checkBanStatus(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("banned_at, ban_expires_at")
    .eq("id", user.id)
    .single();

  if (profile && isBanned(profile)) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  return null;
}
