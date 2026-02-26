import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { COLORS } from "../styles/colors";
import { DeviceMockup } from "../components/DeviceMockup";
import { TextSlam } from "../components/TextSlam";

export const FlashCuts: React.FC = () => {
  const frame = useCurrentFrame();

  const cut = frame < 30 ? 0 : frame < 60 ? 1 : 2;

  const flashOpacity =
    (frame >= 29 && frame <= 31) || (frame >= 59 && frame <= 61)
      ? 0.8
      : 0;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Cut 1: Dark mode toggle */}
      {cut === 0 && (
        <DeviceMockup width={300} height={600}>
          <div
            style={{
              padding: 16,
              paddingTop: 50,
              background: frame > 15 ? "#F9F7F2" : COLORS.deviceScreen,
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: frame > 15 ? "#561c24" : COLORS.textPrimary,
                  fontFamily: '-apple-system, "Inter", sans-serif',
                }}
              >
                UNI-VERSE
              </span>
              <div
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: frame > 15 ? "#22c55e" : "#555",
                  display: "flex",
                  alignItems: "center",
                  padding: 2,
                  justifyContent: frame > 15 ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                  }}
                />
              </div>
            </div>

            {[80, 60, 80, 40].map((w, i) => (
              <div
                key={i}
                style={{
                  width: `${w}%`,
                  height: 12,
                  borderRadius: 6,
                  background: frame > 15 ? "#e8d8c4" : "rgba(255,255,255,0.08)",
                  marginBottom: 8,
                }}
              />
            ))}
          </div>
        </DeviceMockup>
      )}

      {/* Cut 2: Clubs page */}
      {cut === 1 && (
        <DeviceMockup width={260} height={520}>
          <div style={{ padding: 12, paddingTop: 50 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.textPrimary,
                fontFamily: '-apple-system, "Inter", sans-serif',
                marginBottom: 10,
              }}
            >
              Clubs
            </div>

            {[
              { name: "CS Society", color: "#3b82f6" },
              { name: "Film Society", color: "#f97316" },
              { name: "McGill RFC", color: "#22c55e" },
            ].map((club, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${COLORS.glassBorder}`,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${club.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    color: club.color,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                  }}
                >
                  {club.name[0]}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      fontFamily: '-apple-system, "Inter", sans-serif',
                    }}
                  >
                    {club.name}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: COLORS.textSecondary,
                      fontFamily: '-apple-system, "Inter", sans-serif',
                    }}
                  >
                    @{club.name.toLowerCase().replace(/\s/g, "")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DeviceMockup>
      )}

      {/* Cut 3: Notification bell */}
      {cut === 2 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <span style={{ fontSize: 80 }}>🔔</span>
            <div
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: COLORS.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                fontFamily: '-apple-system, "Inter", sans-serif',
                boxShadow: `0 0 20px ${COLORS.glow}`,
                transform: `scale(${1 + Math.sin(frame * 0.3) * 0.1})`,
              }}
            >
              3
            </div>
          </div>
        </div>
      )}

      {/* Flash overlay */}
      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `rgba(255,255,255,${flashOpacity})`,
            pointerEvents: "none",
          }}
        />
      )}

      <TextSlam text="Go." direction="center" enterFrame={90} fontSize={96} />
    </AbsoluteFill>
  );
};
