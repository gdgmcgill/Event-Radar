import { CompanyRequestForm } from "@/components/intake/CompanyRequestForm";
import { requireDiscoveryPage } from "@/server/discoveryAccess";

export const metadata = {
  title: "For companies",
  description: "Tell Uni-Verse about a role for Montréal students. Every request is reviewed; students apply on your site.",
};

const POINTS = [
  "Uni-Verse lists roles for Montréal students alongside events and programs they already follow.",
  "A person reviews every request before anything is published, and may ask you a question first.",
  "A request does not create an account, a company page, or access to applicants.",
  "Students apply on your site, through your own process.",
];

export default async function ForCompaniesPage() {
  await requireDiscoveryPage();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">For companies</p>
      <h1 className="text-3xl font-semibold tracking-tight">Hiring students? Tell us about the role.</h1>
      <ul className="mt-6 grid gap-3 text-sm leading-relaxed text-muted-foreground">
        {POINTS.map((point) => (
          <li key={point} className="border-l-2 border-primary pl-4">
            {point}
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <CompanyRequestForm />
      </div>
    </div>
  );
}
