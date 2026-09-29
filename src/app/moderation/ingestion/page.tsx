import { redirect } from "next/navigation";
import { IngestionPanel } from "@/components/moderation/IngestionPanel";
import { requireAdminPage } from "@/server/authz/requireAdminPage";
import { getRequestContext } from "@/server/context";

export const metadata = {
  title: "Ingestion",
  robots: { index: false, follow: false },
};

export default async function IngestionModerationPage() {
  if (!(await getRequestContext()).user) redirect("/admin-login");
  await requireAdminPage("/");
  return <IngestionPanel />;
}
