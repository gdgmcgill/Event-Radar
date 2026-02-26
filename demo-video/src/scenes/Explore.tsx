import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../styles/colors";
import { DeviceMockup } from "../components/DeviceMockup";
import { EventCard } from "../components/EventCard";
import { TextSlam } from "../components/TextSlam";
import { GlassCard } from "../components/GlassCard";

const CARDS = [
  {
    title: "Career Fair 2026",
    club: "CaPS McGill",
    date: "Mar 20",
    time: "10:00 AM",
    location: "New Residence",
    categories: ["career"] as const,
    imageColor: "#4A235A",
  },
  {
    title: "Wellness Workshop",
    club: "SSMU Wellness",
    date: "Mar 21",
    time: "3:00 PM",
    location: "SSMU Ballroom",
    categories: ["wellness"] as const,
    imageColor: "#0E6655",
  },
  {
    title: "Film Festival",
    club: "Film Society",
    date: "Mar 22",
    time: "7:00 PM",
    location: "Arts W-215",
    categories: ["cultural", "social"] as const,
    imageColor: "#784212",
  },
];

export const Explore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const modalProgress = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 130 },
  });

  const showModal = frame >= 60;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DeviceMockup width={300} height={600}>
        <div style={{ padding: 16, paddingTop: 50, position: "relative" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CARDS.map((card, i) => {
              const cascadeProgress = spring({
                frame: Math.max(0, frame - i * 8),
                fps,
                config: { damping: 12, mass: 0.5, stiffness: 120 },
              });
              const cardY = interpolate(cascadeProgress, [0, 1], [100, 0]);
              const cardOpacity = interpolate(cascadeProgress, [0, 1], [0, 1]);

              const isMiddle = i === 1;
              const liftProgress = isMiddle
                ? spring({
                    frame: Math.max(0, frame - 30),
                    fps,
                    config: { damping: 15, mass: 0.5, stiffness: 140 },
                  })
                : 0;
              const liftY = interpolate(liftProgress, [0, 1], [0, -10]);
              const liftScale = interpolate(liftProgress, [0, 1], [1, 1.05]);
              const liftShadow = interpolate(liftProgress, [0, 1], [0, 20]);

              return (
                <div
                  key={i}
                  style={{
                    transform: `translateY(${cardY + liftY}px) scale(${liftScale})`,
                    opacity: showModal && isMiddle ? 0 : cardOpacity,
                    boxShadow: isMiddle
                      ? `0 ${liftShadow}px ${liftShadow * 2}px rgba(0,0,0,0.3)`
                      : "none",
                    transition: "opacity 0.1s",
                  }}
                >
                  <EventCard
                    {...card}
                    categories={[...card.categories]}
                    scale={0.58}
                  />
                </div>
              );
            })}
          </div>

          {showModal && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `rgba(0,0,0,${interpolate(modalProgress, [0, 1], [0, 0.6])})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <GlassCard
                borderRadius={16}
                padding={20}
                opacity={0.12}
                style={{
                  transform: `scale(${interpolate(modalProgress, [0, 1], [0.8, 1])})`,
                  opacity: interpolate(modalProgress, [0, 1], [0, 1]),
                  width: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                    marginBottom: 8,
                  }}
                >
                  Wellness Workshop
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textSecondary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                    marginBottom: 4,
                  }}
                >
                  📅 March 21, 2026 &nbsp; 🕐 3:00 PM
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textSecondary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                    marginBottom: 12,
                  }}
                >
                  📍 SSMU Ballroom
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {["Open in Maps", "Add to Calendar", "Share"].map(
                    (label) => (
                      <div
                        key={label}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          background:
                            label === "Open in Maps"
                              ? COLORS.primary
                              : "rgba(255,255,255,0.08)",
                          border:
                            label === "Open in Maps"
                              ? "none"
                              : `1px solid ${COLORS.glassBorder}`,
                          fontSize: 9,
                          color: COLORS.textPrimary,
                          fontFamily: '-apple-system, "Inter", sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </div>
                    )
                  )}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </DeviceMockup>

      <TextSlam text="Explore." direction="right" enterFrame={90} />
    </AbsoluteFill>
  );
};
