import { redirect } from "next/navigation";
import { SubmissionQueue } from "@/components/moderation/SubmissionQueue";
import { requireAdminPage } from "@/server/authz/requireAdminPage";
import { getRequestContext } from "@/server/context";

export const metadata = {
  title: "Submissions and reports",
  robots: { index: false, follow: false },
};

export default async function SubmissionModerationPage() {
  if (!(await getRequestContext()).user) redirect("/admin-login");
  await requireAdminPage("/");
  return <SubmissionQueue />;
}
