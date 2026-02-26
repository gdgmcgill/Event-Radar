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
import { CalendarGrid } from "../components/CalendarGrid";
import { TextSlam } from "../components/TextSlam";

export const Plan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wipeProgress = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 },
  });
  const wipeX = interpolate(wipeProgress, [0, 1], [-400, 0]);

  const visibleDots = Math.min(35, Math.max(0, Math.floor((frame - 30) * 0.9)));

  const highlightDay = frame >= 70 ? 17 : undefined;

  const popupProgress = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: { damping: 12, mass: 0.4, stiffness: 160 },
  });

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
          transform: `translateX(${wipeX}px)`,
        }}
      >
        <DeviceMockup width={300} height={600}>
          <div style={{ paddingTop: 50, position: "relative" }}>
            <CalendarGrid
              visibleDots={visibleDots}
              highlightDay={highlightDay}
            />

            {frame >= 75 && (
              <div
                style={{
                  position: "absolute",
                  top: 320,
                  left: "50%",
                  transform: `translateX(-50%) scale(${interpolate(popupProgress, [0, 1], [0.7, 1])})`,
                  opacity: interpolate(popupProgress, [0, 1], [0, 1]),
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${COLORS.glassBorder}`,
                  borderRadius: 10,
                  padding: "8px 14px",
                  whiteSpace: "nowrap",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                  }}
                >
                  Cultural Night
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: COLORS.textSecondary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                  }}
                >
                  7:00 PM · Leacock 132
                </div>
              </div>
            )}
          </div>
        </DeviceMockup>
      </div>

      <TextSlam text="Plan." direction="left" enterFrame={90} />
    </AbsoluteFill>
  );
};
