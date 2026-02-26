import React from "react";
import { COLORS } from "../styles/colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  borderRadius?: number;
  padding?: number;
  opacity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  borderRadius = 20,
  padding = 16,
  opacity = 0.08,
}) => {
  return (
    <div
      style={{
        background: `rgba(255, 255, 255, ${opacity})`,
        backdropFilter: COLORS.glassBlur,
        WebkitBackdropFilter: COLORS.glassBlur,
        border: `1px solid ${COLORS.glassBorder}`,
        borderRadius,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
