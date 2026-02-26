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

export const LogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo appears at frame 30
  const logoProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 120 },
  });

  const logoScale = interpolate(logoProgress, [0, 1], [0, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);

  // Text appears at frame 50
  const textProgress = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 100 },
  });

  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const letterSpacing = interpolate(textProgress, [0, 1], [-0.05, 0.15]);

  // Glow pulse at frame 70+
  const glowPulse =
    frame >= 70
      ? 0.3 + Math.sin((frame - 70) * 0.15) * 0.1
      : interpolate(logoProgress, [0, 1], [0, 0.3]);

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
      {/* Logo circle with glow */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.primary}, #ff4757)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          boxShadow: `0 0 ${60 + glowPulse * 40}px rgba(237, 27, 47, ${glowPulse})`,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#FFFFFF",
            fontFamily: '-apple-system, "SF Pro Display", "Inter", sans-serif',
          }}
        >
          U
        </span>
      </div>

      {/* UNI-VERSE text */}
      <div
        style={{
          marginTop: 24,
          opacity: textOpacity,
        }}
      >
        <span
          style={{
            ...TYPOGRAPHY.logoText,
            letterSpacing: `${letterSpacing}em`,
          }}
        >
          UNI-VERSE
        </span>
      </div>
    </AbsoluteFill>
  );
};
