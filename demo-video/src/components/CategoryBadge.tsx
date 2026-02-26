import React from "react";
import { CATEGORY_COLORS } from "../styles/colors";

interface CategoryBadgeProps {
  category: keyof typeof CATEGORY_COLORS;
  glowing?: boolean;
  style?: React.CSSProperties;
}

const LABELS: Record<keyof typeof CATEGORY_COLORS, string> = {
  academic: "Academic",
  social: "Social",
  sports: "Sports",
  career: "Career",
  cultural: "Cultural",
  wellness: "Wellness",
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  glowing = false,
  style,
}) => {
  const color = CATEGORY_COLORS[category];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: '-apple-system, "Inter", sans-serif',
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        boxShadow: glowing ? `0 0 15px ${color}40` : "none",
        ...style,
      }}
    >
      {LABELS[category]}
    </span>
  );
};
