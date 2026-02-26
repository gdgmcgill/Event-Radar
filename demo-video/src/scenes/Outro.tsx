import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../styles/colors";
import { TYPOGRAPHY } from "../styles/fonts";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 100 },
  });
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);
  const logoScale = interpolate(logoProgress, [0, 1], [0.9, 1]);

  const comingSoonProgress = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 100 },
  });
  const comingSoonOpacity = interpolate(comingSoonProgress, [0, 1], [0, 1]);

  const dateText = "03.17.2026";
  const typedChars = Math.min(
    dateText.length,
    Math.max(0, Math.floor((frame - 60) / 1.5))
  );
  const displayDate = dateText.slice(0, typedChars);

  const glowPulse =
    frame >= 10
      ? 0.35 + Math.sin((frame - 10) * 0.08) * 0.1
      : 0;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.primary}, #ff4757)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 80px rgba(237, 27, 47, ${glowPulse})`,
          }}
        >
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: "#FFFFFF",
              fontFamily: '-apple-system, "SF Pro Display", "Inter", sans-serif',
            }}
          >
            U
          </span>
        </div>

        <div style={{ marginTop: 20 }}>
          <span style={TYPOGRAPHY.logoText}>UNI-VERSE</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          opacity: comingSoonOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={TYPOGRAPHY.comingSoon}>Coming Soon</span>

        {frame >= 60 && (
          <span style={TYPOGRAPHY.date}>
            {displayDate}
            {typedChars < dateText.length && (
              <span style={{ opacity: Math.floor(frame / 4) % 2 }}>_</span>
            )}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
