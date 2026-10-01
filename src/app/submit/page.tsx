import { SubmitForm } from "@/components/intake/SubmitForm";
import { requireDiscoveryPage } from "@/server/discoveryAccess";

export const metadata = {
  title: "Submit a listing",
  description: "Suggest an event, hackathon, job, program or resource for Montréal students. A person reviews every submission.",
};

export default async function SubmitPage() {
  await requireDiscoveryPage();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Submit</p>
      <h1 className="text-3xl font-semibold tracking-tight">Suggest something for students</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Know an event, hackathon, job, program or resource that Montréal students should see? Send it here. A person
        reviews every submission before anything is published, and nothing appears automatically.
      </p>
      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}
