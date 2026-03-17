import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  // Find supabase auth cookies
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const authCookiePrefix = `sb-${projectRef}-auth-token`;
  const authCookies = allCookies.filter((c) => c.name.startsWith(authCookiePrefix));
  const allCookieNames = allCookies.map((c) => c.name);

  // Try to get the user server-side
  let serverUser = null;
  let serverError = null;
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // read-only for this debug endpoint
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    serverUser = data?.user
      ? { id: data.user.id, email: data.user.email }
      : null;
    serverError = error?.message ?? null;
  } catch (e: unknown) {
    serverError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    totalCookies: allCookies.length,
    allCookieNames,
    authCookiePrefix,
    authCookiesFound: authCookies.length,
    authCookieNames: authCookies.map((c) => c.name),
    authCookieSizes: authCookies.map((c) => ({
      name: c.name,
      size: c.value.length,
    })),
    serverUser,
    serverError,
  });
}
