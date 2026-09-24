import { redirect } from "next/navigation";
import { hasRole } from "@/lib/roles";
import { getRequestContext } from "@/server/context";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getRequestContext();

  if (!ctx.user) redirect("/");

  if (ctx.profile === null || !hasRole(ctx.profile, "admin")) redirect("/");

  return <>{children}</>;
}
