import React from "react";
import { COLORS } from "../styles/colors";

interface DeviceMockupProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
}

export const DeviceMockup: React.FC<DeviceMockupProps> = ({
  children,
  style,
  width = 340,
  height = 700,
}) => {
  const bezelRadius = 48;
  const screenRadius = 40;
  const bezelPadding = 8;

  return (
    <div
      style={{
        width: width + bezelPadding * 2,
        height: height + bezelPadding * 2,
        background: COLORS.deviceBezel,
        borderRadius: bezelRadius,
        padding: bezelPadding,
        position: "relative",
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${COLORS.glassBorder}`,
        ...style,
      }}
    >
      {/* Glass reflection overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: bezelRadius,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* Dynamic Island */}
      <div
        style={{
          position: "absolute",
          top: bezelPadding + 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 28,
          background: "#000000",
          borderRadius: 20,
          zIndex: 20,
        }}
      />

      {/* Screen content */}
      <div
        style={{
          width,
          height,
          borderRadius: screenRadius,
          overflow: "hidden",
          background: COLORS.deviceScreen,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};
