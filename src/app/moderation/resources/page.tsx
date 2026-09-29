import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/server/authz/requireAdminPage";
import { ResourceEditor } from "@/components/moderation/ResourceEditor";
import { getRequestContext } from "@/server/context";

export const metadata = {
  title: "Curate resources",
  robots: { index: false, follow: false },
};

export default async function ResourceModerationPage() {
  if (!(await getRequestContext()).user) redirect("/admin-login");
  await requireAdminPage("/");
  return (
    <Suspense fallback={<p className="p-8">Loading resources…</p>}>
      <ResourceEditor />
    </Suspense>
  );
}
