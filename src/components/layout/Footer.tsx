/**
 * Footer component
 * TODO: Add links, social media, and copyright information
 */

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="font-semibold mb-4">About Uni-Verse</h3>
            <p className="text-sm text-muted-foreground">
              Discover and explore campus events at McGill University. Find
              academic talks, social gatherings, sports events, and more.
            </p>
          </div>

          {/* Links Section */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Browse Events
                </Link>
              </li>
              <li>
                <Link
                  href="/my-events"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  My Events
                </Link>
              </li>
              {/* TODO: Add more links */}
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <p className="text-sm text-muted-foreground">
              {/* TODO: Add contact information */}
              Questions? Reach out to us.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Uni-Verse. Built for McGill University.
          </p>
        </div>
      </div>
    </footer>
  );
}





