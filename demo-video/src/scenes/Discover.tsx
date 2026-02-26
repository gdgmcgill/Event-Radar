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

export const Discover: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const deviceEntry = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.7, stiffness: 100 },
  });

  const deviceY = interpolate(deviceEntry, [0, 1], [600, 0]);
  const deviceRotation = interpolate(deviceEntry, [0, 1], [8, 0]);
  const deviceOpacity = interpolate(deviceEntry, [0, 1], [0, 1]);

  const searchText = "music";
  const typedChars = Math.min(
    searchText.length,
    Math.max(0, Math.floor((frame - 25) / 5))
  );
  const displayText = searchText.slice(0, typedChars);
  const showCursor = frame >= 25 && frame < 65 && Math.floor(frame / 8) % 2 === 0;

  const cardsProgress = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 120 },
  });

  const cardsOpacity = interpolate(cardsProgress, [0, 1], [0, 1]);
  const cardsY = interpolate(cardsProgress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `translateY(${deviceY}px) rotate(${deviceRotation}deg)`,
          opacity: deviceOpacity,
        }}
      >
        <DeviceMockup width={300} height={600}>
          <div style={{ padding: 16, paddingTop: 50 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.textPrimary,
                fontFamily: '-apple-system, "Inter", sans-serif',
                marginBottom: 4,
                textAlign: "center",
              }}
            >
              Find your next
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.primary,
                fontFamily: '-apple-system, "Inter", sans-serif',
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              experience
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${COLORS.glassBorder}`,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 14, opacity: 0.5 }}>🔍</span>
              <span
                style={{
                  fontSize: 13,
                  color: displayText
                    ? COLORS.textPrimary
                    : COLORS.textSecondary,
                  fontFamily: '-apple-system, "Inter", sans-serif',
                }}
              >
                {displayText || "Search events..."}
                {showCursor && (
                  <span style={{ color: COLORS.primary }}>|</span>
                )}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                opacity: cardsOpacity,
                transform: `translateY(${cardsY}px)`,
                flexWrap: "wrap",
              }}
            >
              <EventCard
                title="Live Music Night"
                club="McGill Music Club"
                date="Mar 10"
                time="7:00 PM"
                location="Thomson House"
                categories={["social", "cultural"]}
                imageColor="#6C3483"
                scale={0.85}
              />
              <EventCard
                title="Jazz Ensemble"
                club="Music Faculty"
                date="Mar 12"
                time="6:30 PM"
                location="Pollack Hall"
                categories={["academic", "cultural"]}
                imageColor="#1A5276"
                scale={0.85}
              />
            </div>
          </div>
        </DeviceMockup>
      </div>

      <TextSlam text="Discover." direction="right" enterFrame={90} />
    </AbsoluteFill>
  );
};
