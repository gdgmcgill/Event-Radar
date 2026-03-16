import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();

  cookieStore.set("needs_onboarding", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Deletes the cookie
  });

  return NextResponse.json({ success: true });
}
