import { requireAdminPage } from "@/server/authz/requireAdminPage";
import { OpportunityEditor } from "@/components/moderation/OpportunityEditor";
import { EventDiscoveryEditor } from "@/components/moderation/EventDiscoveryEditor";
import { getRequestContext } from "@/server/context";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Curate opportunities",
  robots: { index: false, follow: false },
};
export default async function OpportunityModerationPage() {
  if (!(await getRequestContext()).user) redirect("/admin-login");
  const ctx = await requireAdminPage("/");
  return (
    <>
      <EventDiscoveryEditor />
      <OpportunityEditor
        canAssignPick={
          !!process.env.CURATOR_USER_ID &&
          ctx.user.id === process.env.CURATOR_USER_ID
        }
      />
    </>
  );
}
