import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.set("needs_onboarding", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Deletes the cookie
  });

  return NextResponse.json({ success: true });
}
