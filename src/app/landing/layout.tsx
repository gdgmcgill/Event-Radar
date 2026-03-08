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
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html { scroll-behavior: smooth; }

            @keyframes float-laptop {
              0%, 100% { transform: rotateY(-8deg) rotateX(2deg) translateY(0px); }
              50% { transform: rotateY(-8deg) rotateX(2deg) translateY(-12px); }
            }

            @keyframes float-phone {
              0%, 100% { transform: translateY(-50%) rotateY(6deg) rotateX(-1deg) translateZ(0); }
              50% { transform: translateY(calc(-50% - 16px)) rotateY(6deg) rotateX(-1deg) translateZ(0); }
            }
          `,
        }}
      />
      {children}
    </div>
  );
}
