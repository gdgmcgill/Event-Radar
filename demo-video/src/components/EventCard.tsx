import React from "react";
import { COLORS } from "../styles/colors";
import { CategoryBadge } from "./CategoryBadge";
import { CATEGORY_COLORS } from "../styles/colors";

interface EventCardProps {
  title: string;
  club: string;
  date: string;
  time: string;
  location: string;
  categories: (keyof typeof CATEGORY_COLORS)[];
  imageColor?: string;
  style?: React.CSSProperties;
  scale?: number;
  saved?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  title,
  club,
  date,
  time,
  location,
  categories,
  imageColor = "#2A2A2A",
  style,
  scale = 1,
  saved = false,
}) => {
  const cardWidth = 150 * scale;

  return (
    <div
      style={{
        width: cardWidth,
        background: "#1A1A1A",
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${COLORS.glassBorder}`,
        ...style,
      }}
    >
      {/* Image placeholder */}
      <div
        style={{
          width: "100%",
          height: 90 * scale,
          background: `linear-gradient(135deg, ${imageColor}, ${imageColor}88)`,
          position: "relative",
        }}
      >
        {/* Heart icon */}
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 24 * scale,
            height: 24 * scale,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12 * scale,
          }}
        >
          {saved ? "\u2764\uFE0F" : "\uD83E\uDD0D"}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 8 * scale }}>
        <div
          style={{
            fontSize: 9 * scale,
            color: COLORS.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 2,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          {club}
        </div>
        <div
          style={{
            fontSize: 12 * scale,
            fontWeight: 600,
            color: COLORS.textPrimary,
            marginBottom: 4,
            fontFamily: '-apple-system, "Inter", sans-serif',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 9 * scale,
            color: COLORS.textSecondary,
            marginBottom: 2,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          \uD83D\uDCC5 {date}
        </div>
        <div
          style={{
            fontSize: 9 * scale,
            color: COLORS.textSecondary,
            marginBottom: 2,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          \uD83D\uDD50 {time}
        </div>
        <div
          style={{
            fontSize: 9 * scale,
            color: COLORS.textSecondary,
            marginBottom: 6,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          \uD83D\uDCCD {location}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <CategoryBadge
              key={cat}
              category={cat}
              style={{ fontSize: 8 * scale, padding: `${2 * scale}px ${6 * scale}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
