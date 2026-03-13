import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";

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
  title: {
    default: "Uni-Verse | McGill Campus Events",
    template: "%s | Uni-Verse",
  },
  description:
    "Discover workshops, hackathons, and social events happening at McGill University. Save events, get personalized recommendations, and never miss what's happening on campus.",
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
    siteName: "Uni-Verse",
    title: "Uni-Verse | McGill Campus Events",
    description:
      "Discover workshops, hackathons, and social events happening at McGill University.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Uni-Verse | McGill Campus Events",
    description:
      "Discover workshops, hackathons, and social events happening at McGill University.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}