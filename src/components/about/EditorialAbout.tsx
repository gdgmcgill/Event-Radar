import Link from "next/link";
import { FOUNDER_STORY } from "@/content/founder";

/** The switch-on About page (Task 7). Factual product description only —
 * what Uni-Verse lists, that listings are checked before publication, that
 * provenance labels never say "Verified", that there is no paid placement,
 * and that a person reviews every public submission. The founder section
 * renders only when `FOUNDER_STORY` is non-null. */
export function EditorialAbout() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        About Uni-Verse
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        A checked list of opportunities for Montréal students
      </h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Uni-Verse lists events, hackathons, jobs, programs, networking
          opportunities and grants relevant to Montréal students. Every
          listing is checked by a person before it is published, whether it
          was submitted directly, indexed from a public source, or shared by
          a partner organization.
        </p>
        <p>
          Each listing carries a provenance label so you know where it came
          from: added by the Uni-Verse team, automatically indexed, or
          submitted by the organizer. We never label a listing
          &ldquo;Verified&rdquo; — provenance says where it came from, not
          that every detail has been confirmed. Always check current details
          with the organizer.
        </p>
        <p>
          There is no paid placement on Uni-Verse. Nothing can be bought into
          the feed, and nothing is ranked because someone paid for it.
        </p>
        <p>
          Every public submission — an opportunity or a company&apos;s hiring
          request — is reviewed by a person before it can appear. Have an
          opportunity or a role to share?{" "}
          <Link href="/submit" className="font-medium underline">
            Submit it here
          </Link>
          .
        </p>
      </div>
      {FOUNDER_STORY && (
        <section className="mt-16 border-t border-border pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {FOUNDER_STORY.heading}
          </h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
            {FOUNDER_STORY.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          {FOUNDER_STORY.link && (
            <Link
              href={FOUNDER_STORY.link.href}
              className="mt-4 inline-block font-medium underline"
            >
              {FOUNDER_STORY.link.label}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
