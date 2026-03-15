import Link from "next/link";
import { CONTACT_EMAILS } from "@/lib/contact";

const LINKS = [
  { label: "About", href: "/about" },
  { label: "Help & FAQ", href: "/help" },
  { label: "Feedback", href: "/feedback" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const;

export function Footer() {
  const footerEmail = CONTACT_EMAILS.hello;

  return (
    <footer className="relative">
      {/* Top separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="px-6 md:px-10 lg:px-12 py-10 md:py-14">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-8">
          {/* Brand */}
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight text-foreground">
              UNI-VERSE
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Campus event discovery for McGill University.
            </p>
          </div>

          {/* Links — horizontal row with dot separators */}
          <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {LINKS.map((link, i) => (
              <span key={link.label} className="flex items-center gap-2">
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </Link>
                {i < LINKS.length - 1 && (
                  <span className="text-border select-none" aria-hidden>
                    ·
                  </span>
                )}
              </span>
            ))}
          </nav>

          {/* Contact */}
          <a
            href={`mailto:${footerEmail}`}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
          >
            {footerEmail}
          </a>

          {/* Attribution */}
          <div className="pt-6 border-t border-border/40 w-full">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} UNI-VERSE · A{" "}
              <span className="font-semibold text-foreground">GDG McGill</span>{" "}
              project, powered by{" "}
              <span className="font-semibold text-foreground">Apollo Labs</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
