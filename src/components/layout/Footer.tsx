import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <h3 className="font-semibold mb-4">About Uni-Verse</h3>
            <p className="text-sm text-muted-foreground">
              Discover and explore campus events at McGill University. Find
              academic talks, social gatherings, sports events, and more.
            </p>
          </div>

          {/* Quick Links */}
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
                  href="/calendar"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Calendar
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
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/help"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Help & FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/feedback"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Send Feedback
                </Link>
              </li>
              <li>
                <a
                  href="mailto:universe.mcgill@gmail.com"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  universe.mcgill@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground space-y-1">
          <p>
            © {new Date().getFullYear()} Uni-Verse. A{" "}
            <span className="font-semibold text-foreground">GDG McGill</span>{" "}
            project, powered by{" "}
            <span className="font-semibold text-foreground">Apollo Labs</span>.
          </p>
          <p className="text-xs">
            Built for the McGill University community.
          </p>
        </div>
      </div>
    </footer>
  );
}

