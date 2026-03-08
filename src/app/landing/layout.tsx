import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uni-Verse | The Pulse of McGill",
  description:
    "Experience the ultimate campus hub. Discover exclusive events, connect with clubs, and never miss what's happening at McGill University.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8f6f6] dark:bg-[#221012] text-slate-900 dark:text-slate-100 antialiased">
      {children}
    </div>
  );
}
