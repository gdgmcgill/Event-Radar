import { Building2, ShieldCheck } from "lucide-react";
import { CreateClubForm } from "./CreateClubForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Your Club | UNI-VERSE",
  description: "Register a new student club or organization at McGill University",
};

export default function CreateClubPage() {
  return (
    <div className="flex-1 min-w-0">
      {/* ── Hero / Header ────────────────────────────────────────────── */}
      <section className="px-6 lg:px-10 pt-10 lg:pt-14 pb-8 lg:pb-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-7 w-7 text-primary" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Register Your Club
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto mb-4">
            Fill out the form below to get your club listed on UNI-VERSE and start reaching students across campus.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-muted-foreground text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            All submissions are reviewed before going live
          </div>
        </div>
      </section>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-10 pb-16">
        <CreateClubForm />
      </section>
    </div>
  );
}
