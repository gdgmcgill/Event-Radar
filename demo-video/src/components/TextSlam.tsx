import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../styles/colors";
import { TYPOGRAPHY } from "../styles/fonts";

interface TextSlamProps {
  text: string;
  direction?: "left" | "right" | "center";
  enterFrame?: number;
  fontSize?: number;
}

export const TextSlam: React.FC<TextSlamProps> = ({
  text,
  direction = "right",
  enterFrame = 0,
  fontSize = 72,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = frame - enterFrame;
  if (adjustedFrame < 0) return null;

  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: {
      damping: 14,
      mass: 0.6,
      stiffness: 150,
    },
  });

  const offsetX =
    direction === "left" ? -200 : direction === "right" ? 200 : 0;
  const offsetY = direction === "center" ? 80 : 0;

  const translateX = interpolate(progress, [0, 1], [offsetX, 0]);
  const translateY = interpolate(progress, [0, 1], [offsetY, 0]);
  const scale = interpolate(progress, [0, 1], [0.6, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  const positionStyle: React.CSSProperties =
    direction === "center"
      ? { display: "flex", justifyContent: "center", alignItems: "center" }
      : direction === "left"
        ? { display: "flex", justifyContent: "flex-start", paddingLeft: 60 }
        : { display: "flex", justifyContent: "flex-end", paddingRight: 60 };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        ...positionStyle,
        zIndex: 100,
      }}
    >
      <div
        style={{
          transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
          opacity,
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: `1px solid ${COLORS.glassBorder}`,
          borderRadius: 16,
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <span
          style={{
            ...TYPOGRAPHY.beatWord,
            fontSize,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
