import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { SideNavBar } from "@/components/layout/SideNavBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const themeScript = `
  (function() {
    try {
      const theme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (theme === 'dark' || (!theme && prefersDark)) {
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
          <div className="flex min-h-screen">
            {/* Side Navigation Bar - LEFT SIDE, desktop only */}
            <SideNavBar />
            
            {/* Main Content Area - takes full width on mobile, adjusted for sidebar on desktop */}
            <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
              {/* Header - contains mobile menu */}
              <Header />
              <main className="flex-1 p-6">{children}</main>
              <Footer />
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}