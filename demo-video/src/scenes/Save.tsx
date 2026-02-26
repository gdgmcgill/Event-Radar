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

export const Save: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoomIn = interpolate(frame, [0, 30], [1, 2.5], {
    extrapolateRight: "clamp",
  });

  const heartBeat = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 8, mass: 0.3, stiffness: 200 },
  });
  const heartScale = frame >= 30 ? interpolate(heartBeat, [0, 1], [0.5, 1]) : 0;
  const heartFilled = frame >= 35;

  const zoomOut = frame >= 50
    ? interpolate(frame, [50, 80], [2.5, 1], { extrapolateRight: "clamp" })
    : zoomIn;

  const showGrid = frame >= 55;

  const gridOpacity = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
      <DeviceMockup width={300} height={600}>
        <div
          style={{
            paddingTop: 50,
            transform: `scale(${zoomOut})`,
            transformOrigin: "center 30%",
          }}
        >
          {!showGrid && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: 200,
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  transform: `scale(${heartScale})`,
                }}
              >
                {heartFilled ? "❤️" : "🤍"}
              </div>
            </div>
          )}

          {showGrid && (
            <div style={{ padding: 12, opacity: gridOpacity }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  fontFamily: '-apple-system, "Inter", sans-serif',
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>❤️</span> My Events
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.textSecondary,
                  fontFamily: '-apple-system, "Inter", sans-serif',
                  marginBottom: 12,
                }}
              >
                6 saved events
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                }}
              >
                {[
                  { title: "Jazz Night", club: "Music Club", date: "Mar 10", time: "7PM", location: "Thomson", categories: ["cultural"] as const, imageColor: "#1A5276" },
                  { title: "Career Fair", club: "CaPS", date: "Mar 20", time: "10AM", location: "New Rez", categories: ["career"] as const, imageColor: "#4A235A" },
                  { title: "Yoga Flow", club: "Wellness", date: "Mar 15", time: "5PM", location: "Gym", categories: ["wellness"] as const, imageColor: "#0E6655" },
                  { title: "Hackathon", club: "CS Games", date: "Mar 22", time: "9AM", location: "Trottier", categories: ["academic"] as const, imageColor: "#1E3A5F" },
                  { title: "Film Night", club: "Film Soc", date: "Mar 25", time: "8PM", location: "Arts W-215", categories: ["social"] as const, imageColor: "#784212" },
                  { title: "Rugby Match", club: "McGill RFC", date: "Mar 28", time: "2PM", location: "Molson", categories: ["sports"] as const, imageColor: "#145A32" },
                ].map((card, i) => (
                  <EventCard
                    key={i}
                    {...card}
                    categories={[...card.categories]}
                    saved
                    scale={0.58}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DeviceMockup>

      <TextSlam text="Save." direction="right" enterFrame={80} />
    </AbsoluteFill>
  );
};
