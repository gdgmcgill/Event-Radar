import React from "react";
import { COLORS, CATEGORY_COLORS } from "../styles/colors";

interface CalendarEvent {
  day: number;
  colors: string[];
}

interface CalendarGridProps {
  month?: string;
  year?: number;
  events?: CalendarEvent[];
  highlightDay?: number;
  visibleDots?: number;
  style?: React.CSSProperties;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_EVENTS: CalendarEvent[] = [
  { day: 3, colors: [CATEGORY_COLORS.academic] },
  { day: 5, colors: [CATEGORY_COLORS.social, CATEGORY_COLORS.cultural] },
  { day: 7, colors: [CATEGORY_COLORS.sports] },
  { day: 10, colors: [CATEGORY_COLORS.career] },
  { day: 12, colors: [CATEGORY_COLORS.academic, CATEGORY_COLORS.wellness] },
  { day: 14, colors: [CATEGORY_COLORS.social] },
  { day: 17, colors: [CATEGORY_COLORS.cultural, CATEGORY_COLORS.sports] },
  { day: 19, colors: [CATEGORY_COLORS.wellness] },
  { day: 21, colors: [CATEGORY_COLORS.career, CATEGORY_COLORS.academic] },
  { day: 23, colors: [CATEGORY_COLORS.social] },
  { day: 25, colors: [CATEGORY_COLORS.sports, CATEGORY_COLORS.cultural] },
  { day: 28, colors: [CATEGORY_COLORS.academic] },
];

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  month = "March",
  year = 2026,
  events = DEFAULT_EVENTS,
  highlightDay,
  visibleDots = 35,
  style,
}) => {
  const cellSize = 38;
  const gap = 3;

  const getEventsForDay = (day: number) =>
    events.find((e) => e.day === day);

  const startOffset = 0;
  const totalDays = 31;

  return (
    <div style={{ padding: 12, ...style }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.textPrimary,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          {month} {year}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>&#9664;</span>
          <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>&#9654;</span>
        </div>
      </div>

      {/* Day names */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(7, ${cellSize}px)`,
          gap,
          marginBottom: 4,
        }}
      >
        {DAYS_OF_WEEK.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 9,
              color: COLORS.textSecondary,
              fontFamily: '-apple-system, "Inter", sans-serif',
              fontWeight: 500,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(7, ${cellSize}px)`,
          gap,
        }}
      >
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} style={{ width: cellSize, height: cellSize }} />
        ))}

        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dayIndex = startOffset + i;
          const evt = getEventsForDay(day);
          const isHighlighted = highlightDay === day;
          const isVisible = dayIndex < visibleDots;

          return (
            <div
              key={day}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: isHighlighted
                  ? `${COLORS.primary}20`
                  : "rgba(255,255,255,0.03)",
                border: isHighlighted
                  ? `1px solid ${COLORS.primary}50`
                  : "1px solid transparent",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: COLORS.textPrimary,
                  fontFamily: '-apple-system, "Inter", sans-serif',
                  fontWeight: isHighlighted ? 700 : 400,
                }}
              >
                {day}
              </span>
              {evt && isVisible && (
                <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                  {evt.colors.map((color, ci) => (
                    <div
                      key={ci}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: color,
                        boxShadow: `0 0 6px ${color}60`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
