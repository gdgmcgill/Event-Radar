import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, CATEGORY_COLORS } from "../styles/colors";
import { DeviceMockup } from "../components/DeviceMockup";
import { CategoryBadge } from "../components/CategoryBadge";
import { EventCard } from "../components/EventCard";
import { TextSlam } from "../components/TextSlam";

const FILTER_BADGES: { category: keyof typeof CATEGORY_COLORS; delay: number }[] = [
  { category: "academic", delay: 30 },
  { category: "social", delay: 42 },
  { category: "sports", delay: 54 },
];

export const Filter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn,
      }}
    >
      <DeviceMockup width={300} height={600}>
        <div style={{ padding: 16, paddingTop: 50 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textPrimary,
              fontFamily: '-apple-system, "Inter", sans-serif',
              marginBottom: 12,
            }}
          >
            Filter Events
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {FILTER_BADGES.map(({ category, delay }) => {
              const badgeProgress = spring({
                frame: Math.max(0, frame - delay),
                fps,
                config: { damping: 12, mass: 0.4, stiffness: 180 },
              });
              const scale = interpolate(badgeProgress, [0, 1], [0.5, 1]);
              const opacity = interpolate(badgeProgress, [0, 1], [0, 1]);

              return (
                <div
                  key={category}
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                  }}
                >
                  <CategoryBadge
                    category={category}
                    glowing={frame > delay + 10}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  />
                </div>
              );
            })}

            {(["career", "cultural", "wellness"] as const).map((cat) => (
              <CategoryBadge
                key={cat}
                category={cat}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  opacity: 0.3,
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              {
                title: "Intro to AI",
                club: "CS Society",
                date: "Mar 15",
                time: "2:00 PM",
                location: "McConnell 204",
                categories: ["academic"] as (keyof typeof CATEGORY_COLORS)[],
                imageColor: "#1E3A5F",
              },
              {
                title: "Spring Social",
                club: "SSA",
                date: "Mar 18",
                time: "8:00 PM",
                location: "Gerts Bar",
                categories: ["social"] as (keyof typeof CATEGORY_COLORS)[],
                imageColor: "#5B2C6F",
              },
            ].map((card, i) => {
              const cardShuffleProgress = spring({
                frame: Math.max(0, frame - 70 - i * 8),
                fps,
                config: { damping: 15, mass: 0.5, stiffness: 120 },
              });
              const cardX = interpolate(
                cardShuffleProgress,
                [0, 1],
                [i % 2 === 0 ? -40 : 40, 0]
              );
              return (
                <div
                  key={i}
                  style={{ transform: `translateX(${cardX}px)` }}
                >
                  <EventCard {...card} scale={0.85} />
                </div>
              );
            })}
          </div>
        </div>
      </DeviceMockup>

      <TextSlam text="Filter." direction="left" enterFrame={90} />
    </AbsoluteFill>
  );
};
