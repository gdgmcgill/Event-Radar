import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SideNavBar } from "@/components/layout/SideNavBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Uni-Verse - Campus Event Discovery for McGill University",
  description:
    "Discover and explore campus events at McGill University. Find academic talks, social gatherings, sports events, and more.",
  keywords: ["McGill", "events", "campus", "university", "calendar"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          {/* Side Navigation Bar - LEFT SIDE, desktop only */}
          <SideNavBar />
          
          {/* Main Content Area - takes full width on mobile, adjusted for sidebar on desktop */}
          <div className="flex flex-col flex-1">
            {/* Header - contains mobile menu */}
            <Header />
            <main className="flex-1 p-6">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
