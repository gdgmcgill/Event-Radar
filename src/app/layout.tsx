import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { discoverySurface } from "@/server/discoveryAccess";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('theme');
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (saved === 'light') {
        document.documentElement.classList.remove('dark');
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })()
`;

export const metadata: Metadata = {
  // The sitemap (`src/app/sitemap.ts`) already hard-codes this base; setting
  // it here too makes every relative canonical/OG/Twitter URL emitted from
  // `generateMetadata` (events, opportunities, resources) resolve to an
  // absolute URL instead of a bare path.
  metadataBase: new URL("https://universeapp.ca"),
  title: {
    default: "UNI-VERSE | Opportunities for Montreal students",
    template: "%s | UNI-VERSE",
  },
  description:
    "Discover events, hackathons, jobs, and programs for Montreal students. Find your next opportunity with UNI-VERSE.",
  keywords: [
    "McGill",
    "university events",
    "campus events",
    "student events",
    "Montreal",
  ],
  authors: [{ name: "GDG McGill" }],
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "UNI-VERSE",
    title: "UNI-VERSE | Opportunities for Montreal students",
    description:
      "Events, hackathons, jobs, and programs for Montreal students.",
  },
  twitter: {
    card: "summary_large_image",
    title: "UNI-VERSE | Opportunities for Montreal students",
    description:
      "Events, hackathons, jobs, and programs for Montreal students.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/brand/logo/favicon-32x32.png",
    apple: "/brand/logo/apple-touch-icon-180x180.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const discovery = await discoverySurface();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
        <AuthProvider>
          <AppShell discovery={discovery}>{children}</AppShell>
        </AuthProvider>
        {process.env.VERCEL === "1" && <Analytics />}
        {process.env.VERCEL === "1" && <SpeedInsights />}
      </body>
    </html>
  );
}
