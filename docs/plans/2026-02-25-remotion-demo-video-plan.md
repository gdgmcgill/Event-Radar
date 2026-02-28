# Remotion Demo Video Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 30-second a16z-style product launch video for Uni-Verse using Remotion, with Apple-style spring animations, glassmorphism, SFX, and an iPhone device mockup.

**Architecture:** Standalone Remotion v4 project in `/demo-video/` at repo root. 8 scene components orchestrated by a main `<Sequence>` timeline. Shared reusable components (DeviceMockup, TextSlam, GlassCard) handle visual consistency. SFX placeholder files allow drop-in replacement with real audio.

**Tech Stack:** Remotion v4, React 18, TypeScript, CSS (inline styles — no Tailwind in Remotion)

**Design doc:** `docs/plans/2026-02-25-remotion-demo-video-design.md`

---

## Task 1: Scaffold Remotion Project

**Files:**
- Create: `demo-video/package.json`
- Create: `demo-video/tsconfig.json`
- Create: `demo-video/src/Root.tsx`
- Create: `demo-video/src/index.ts`

**Step 1: Create project directory**

```bash
mkdir -p demo-video/src/scenes demo-video/src/components demo-video/src/styles demo-video/src/assets/sfx
```

**Step 2: Create package.json**

Create `demo-video/package.json`:
```json
{
  "name": "universe-demo-video",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "npx remotion studio",
    "build": "npx remotion render DemoVideo out/universe-demo.mp4",
    "preview": "npx remotion preview"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "@remotion/player": "^4.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "remotion": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Create tsconfig.json**

Create `demo-video/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "out"]
}
```

**Step 4: Create Root.tsx composition registration**

Create `demo-video/src/Root.tsx`:
```tsx
import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1080}
    />
  );
};
```

**Step 5: Create entry point**

Create `demo-video/src/index.ts`:
```ts
export { RemotionRoot } from "./Root";
```

**Step 6: Install dependencies**

```bash
cd demo-video && npm install
```

**Step 7: Verify Remotion studio launches**

```bash
cd demo-video && npx remotion studio
```
Expected: Browser opens with Remotion Studio showing "DemoVideo" composition (will show error until DemoVideo component exists — that's fine).

**Step 8: Commit**

```bash
git add demo-video/package.json demo-video/tsconfig.json demo-video/src/Root.tsx demo-video/src/index.ts demo-video/package-lock.json
git commit -m "feat(demo-video): scaffold Remotion v4 project"
```

---

## Task 2: Colors, Constants & Placeholder SFX

**Files:**
- Create: `demo-video/src/styles/colors.ts`
- Create: `demo-video/src/styles/fonts.ts`
- Create: 14 placeholder `.mp3` files in `demo-video/src/assets/sfx/`

**Step 1: Create color constants**

Create `demo-video/src/styles/colors.ts`:
```ts
export const COLORS = {
  background: "#0A0A0A",
  glassFill: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.15)",
  glassBlur: "blur(40px)",
  primary: "#ED1B2F",
  glow: "rgba(237, 27, 47, 0.3)",
  glowStrong: "rgba(237, 27, 47, 0.4)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.6)",
  deviceBezel: "#1C1C1E",
  deviceScreen: "#000000",
} as const;

export const CATEGORY_COLORS = {
  academic: "#3b82f6",
  social: "#ec4899",
  sports: "#22c55e",
  career: "#a855f7",
  cultural: "#f97316",
  wellness: "#14b8a6",
} as const;
```

**Step 2: Create font constants**

Create `demo-video/src/styles/fonts.ts`:
```ts
export const FONTS = {
  display: '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", sans-serif',
  mono: '"SF Mono", "JetBrains Mono", "Fira Code", monospace',
} as const;

export const TYPOGRAPHY = {
  beatWord: {
    fontFamily: FONTS.display,
    fontSize: 72,
    fontWeight: 700 as const,
    letterSpacing: "-0.02em",
    color: "#FFFFFF",
  },
  logoText: {
    fontFamily: FONTS.display,
    fontSize: 48,
    fontWeight: 700 as const,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
    color: "#FFFFFF",
  },
  comingSoon: {
    fontFamily: FONTS.display,
    fontSize: 32,
    fontWeight: 500 as const,
    color: "rgba(255, 255, 255, 0.6)",
  },
  date: {
    fontFamily: FONTS.mono,
    fontSize: 28,
    fontWeight: 400 as const,
    color: "#FFFFFF",
  },
} as const;
```

**Step 3: Create placeholder SFX files**

Generate silent placeholder MP3 files. These are minimal valid MP3 files (users replace with real SFX later):

```bash
cd demo-video/src/assets/sfx
# Create minimal silent mp3 placeholders (44 bytes each — valid MP3 frame)
for name in whoosh-deep impact-hit swoosh-airy keyboard-click snap-hit glass-tap card-shuffle pop modal-slide tick-rapid chime heartbeat-thump shutter-click impact-final; do
  # Use ffmpeg to generate 0.5s of silence as mp3
  ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.5 -q:a 9 "${name}.mp3" -y 2>/dev/null
done
```

If ffmpeg is not available, create a simple script that generates them:
```bash
# Alternative: create empty placeholder files with a note
for name in whoosh-deep impact-hit swoosh-airy keyboard-click snap-hit glass-tap card-shuffle pop modal-slide tick-rapid chime heartbeat-thump shutter-click impact-final; do
  touch "${name}.mp3"
done
```

**Step 4: Commit**

```bash
git add demo-video/src/styles/ demo-video/src/assets/sfx/
git commit -m "feat(demo-video): add color constants and placeholder SFX"
```

---

## Task 3: GlassCard Reusable Component

**Files:**
- Create: `demo-video/src/components/GlassCard.tsx`

**Step 1: Build GlassCard component**

Create `demo-video/src/components/GlassCard.tsx`:
```tsx
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
```

**Step 2: Commit**

```bash
git add demo-video/src/components/GlassCard.tsx
git commit -m "feat(demo-video): add GlassCard glassmorphism component"
```

---

## Task 4: TextSlam Reusable Component

**Files:**
- Create: `demo-video/src/components/TextSlam.tsx`

**Step 1: Build TextSlam component**

This is the one-word text slam animation used for "Discover.", "Filter.", "Explore.", "Plan.", "Save.", "Go." — each word slams in on a glass pill from a specified direction with spring physics.

Create `demo-video/src/components/TextSlam.tsx`:
```tsx
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
  /** Frame within this component's sequence when the slam starts */
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
```

**Step 2: Commit**

```bash
git add demo-video/src/components/TextSlam.tsx
git commit -m "feat(demo-video): add TextSlam spring animation component"
```

---

## Task 5: DeviceMockup Component

**Files:**
- Create: `demo-video/src/components/DeviceMockup.tsx`

**Step 1: Build iPhone 15 Pro mockup**

Create `demo-video/src/components/DeviceMockup.tsx`:
```tsx
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
```

**Step 2: Commit**

```bash
git add demo-video/src/components/DeviceMockup.tsx
git commit -m "feat(demo-video): add iPhone 15 Pro DeviceMockup component"
```

---

## Task 6: EventCard & CategoryBadge Components

**Files:**
- Create: `demo-video/src/components/EventCard.tsx`
- Create: `demo-video/src/components/CategoryBadge.tsx`

**Step 1: Build CategoryBadge**

Create `demo-video/src/components/CategoryBadge.tsx`:
```tsx
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
```

**Step 2: Build EventCard**

Create `demo-video/src/components/EventCard.tsx`:
```tsx
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
          {saved ? "❤️" : "🤍"}
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
          📅 {date}
        </div>
        <div
          style={{
            fontSize: 9 * scale,
            color: COLORS.textSecondary,
            marginBottom: 2,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          🕐 {time}
        </div>
        <div
          style={{
            fontSize: 9 * scale,
            color: COLORS.textSecondary,
            marginBottom: 6,
            fontFamily: '-apple-system, "Inter", sans-serif',
          }}
        >
          📍 {location}
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
```

**Step 3: Commit**

```bash
git add demo-video/src/components/EventCard.tsx demo-video/src/components/CategoryBadge.tsx
git commit -m "feat(demo-video): add EventCard and CategoryBadge components"
```

---

## Task 7: CalendarGrid Component

**Files:**
- Create: `demo-video/src/components/CalendarGrid.tsx`

**Step 1: Build simplified calendar**

Create `demo-video/src/components/CalendarGrid.tsx`:
```tsx
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

  // March 2026 starts on Sunday (index 0)
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
          <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>◀</span>
          <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>▶</span>
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
        {/* Start offset */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} style={{ width: cellSize, height: cellSize }} />
        ))}

        {/* Days */}
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
```

**Step 2: Commit**

```bash
git add demo-video/src/components/CalendarGrid.tsx
git commit -m "feat(demo-video): add CalendarGrid component"
```

---

## Task 8: Scene 1 — LogoIntro

**Files:**
- Create: `demo-video/src/scenes/LogoIntro.tsx`

**Step 1: Build LogoIntro scene (frames 0-90)**

Create `demo-video/src/scenes/LogoIntro.tsx`:
```tsx
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
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/LogoIntro.tsx
git commit -m "feat(demo-video): add LogoIntro scene with spring animation"
```

---

## Task 9: Scene 2 — Discover

**Files:**
- Create: `demo-video/src/scenes/Discover.tsx`

**Step 1: Build Discover scene (frames 90-210)**

Create `demo-video/src/scenes/Discover.tsx`:
```tsx
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

export const Discover: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Device flies in from bottom (frame 0-25)
  const deviceEntry = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.7, stiffness: 100 },
  });

  const deviceY = interpolate(deviceEntry, [0, 1], [600, 0]);
  const deviceRotation = interpolate(deviceEntry, [0, 1], [8, 0]);
  const deviceOpacity = interpolate(deviceEntry, [0, 1], [0, 1]);

  // Typing animation (frame 25-60)
  const searchText = "music";
  const typedChars = Math.min(
    searchText.length,
    Math.max(0, Math.floor((frame - 25) / 5))
  );
  const displayText = searchText.slice(0, typedChars);
  const showCursor = frame >= 25 && frame < 65 && Math.floor(frame / 8) % 2 === 0;

  // Cards appear (frame 60-90)
  const cardsProgress = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 120 },
  });

  const cardsOpacity = interpolate(cardsProgress, [0, 1], [0, 1]);
  const cardsY = interpolate(cardsProgress, [0, 1], [30, 0]);

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
          transform: `translateY(${deviceY}px) rotate(${deviceRotation}deg)`,
          opacity: deviceOpacity,
        }}
      >
        <DeviceMockup width={300} height={600}>
          <div style={{ padding: 16, paddingTop: 50 }}>
            {/* Hero text */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.textPrimary,
                fontFamily: '-apple-system, "Inter", sans-serif',
                marginBottom: 4,
                textAlign: "center",
              }}
            >
              Find your next
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.primary,
                fontFamily: '-apple-system, "Inter", sans-serif',
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              experience
            </div>

            {/* Search bar */}
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${COLORS.glassBorder}`,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 14, opacity: 0.5 }}>🔍</span>
              <span
                style={{
                  fontSize: 13,
                  color: displayText
                    ? COLORS.textPrimary
                    : COLORS.textSecondary,
                  fontFamily: '-apple-system, "Inter", sans-serif',
                }}
              >
                {displayText || "Search events..."}
                {showCursor && (
                  <span style={{ color: COLORS.primary }}>|</span>
                )}
              </span>
            </div>

            {/* Event cards grid */}
            <div
              style={{
                display: "flex",
                gap: 8,
                opacity: cardsOpacity,
                transform: `translateY(${cardsY}px)`,
                flexWrap: "wrap",
              }}
            >
              <EventCard
                title="Live Music Night"
                club="McGill Music Club"
                date="Mar 10"
                time="7:00 PM"
                location="Thomson House"
                categories={["social", "cultural"]}
                imageColor="#6C3483"
                scale={0.85}
              />
              <EventCard
                title="Jazz Ensemble"
                club="Music Faculty"
                date="Mar 12"
                time="6:30 PM"
                location="Pollack Hall"
                categories={["academic", "cultural"]}
                imageColor="#1A5276"
                scale={0.85}
              />
            </div>
          </div>
        </DeviceMockup>
      </div>

      {/* Text slam */}
      <TextSlam text="Discover." direction="right" enterFrame={90} />
    </AbsoluteFill>
  );
};
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/Discover.tsx
git commit -m "feat(demo-video): add Discover scene with search animation"
```

---

## Task 10: Scene 3 — Filter

**Files:**
- Create: `demo-video/src/scenes/Filter.tsx`

**Step 1: Build Filter scene (frames 210-330)**

Create `demo-video/src/scenes/Filter.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, CATEGORY_COLORS } from "../styles/colors";
import { DeviceMockup } from "../components/DeviceMockup";
import { CategoryBadge } from "../components/CategoryBadge";
import { EventCard } from "../components/EventCard";
import { TextSlam } from "../components/TextSlam";

const FILTER_BADGES: { category: keyof typeof CATEGORY_COLORS; delay: number }[] = [
  { category: "academic", delay: 30 },
  { category: "social", delay: 42 },
  { category: "sports", delay: 54 },
];

export const Filter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Crossfade in (0-30)
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn,
      }}
    >
      <DeviceMockup width={300} height={600}>
        <div style={{ padding: 16, paddingTop: 50 }}>
          {/* Filter header */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textPrimary,
              fontFamily: '-apple-system, "Inter", sans-serif',
              marginBottom: 12,
            }}
          >
            Filter Events
          </div>

          {/* Category filter badges */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {FILTER_BADGES.map(({ category, delay }) => {
              const badgeProgress = spring({
                frame: Math.max(0, frame - delay),
                fps,
                config: { damping: 12, mass: 0.4, stiffness: 180 },
              });
              const scale = interpolate(badgeProgress, [0, 1], [0.5, 1]);
              const opacity = interpolate(badgeProgress, [0, 1], [0, 1]);

              return (
                <div
                  key={category}
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                  }}
                >
                  <CategoryBadge
                    category={category}
                    glowing={frame > delay + 10}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  />
                </div>
              );
            })}

            {/* Inactive badges */}
            {(["career", "cultural", "wellness"] as const).map((cat) => (
              <CategoryBadge
                key={cat}
                category={cat}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  opacity: 0.3,
                }}
              />
            ))}
          </div>

          {/* Shuffled event cards */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              {
                title: "Intro to AI",
                club: "CS Society",
                date: "Mar 15",
                time: "2:00 PM",
                location: "McConnell 204",
                categories: ["academic"] as (keyof typeof CATEGORY_COLORS)[],
                imageColor: "#1E3A5F",
              },
              {
                title: "Spring Social",
                club: "SSA",
                date: "Mar 18",
                time: "8:00 PM",
                location: "Gerts Bar",
                categories: ["social"] as (keyof typeof CATEGORY_COLORS)[],
                imageColor: "#5B2C6F",
              },
            ].map((card, i) => {
              const cardShuffleProgress = spring({
                frame: Math.max(0, frame - 70 - i * 8),
                fps,
                config: { damping: 15, mass: 0.5, stiffness: 120 },
              });
              const cardX = interpolate(
                cardShuffleProgress,
                [0, 1],
                [i % 2 === 0 ? -40 : 40, 0]
              );
              return (
                <div
                  key={i}
                  style={{ transform: `translateX(${cardX}px)` }}
                >
                  <EventCard {...card} scale={0.85} />
                </div>
              );
            })}
          </div>
        </div>
      </DeviceMockup>

      <TextSlam text="Filter." direction="left" enterFrame={90} />
    </AbsoluteFill>
  );
};
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/Filter.tsx
git commit -m "feat(demo-video): add Filter scene with badge toggle animation"
```

---

## Task 11: Scene 4 — Explore

**Files:**
- Create: `demo-video/src/scenes/Explore.tsx`

**Step 1: Build Explore scene (frames 330-450)**

Create `demo-video/src/scenes/Explore.tsx`:
```tsx
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
import { GlassCard } from "../components/GlassCard";

const CARDS = [
  {
    title: "Career Fair 2026",
    club: "CaPS McGill",
    date: "Mar 20",
    time: "10:00 AM",
    location: "New Residence",
    categories: ["career"] as const,
    imageColor: "#4A235A",
  },
  {
    title: "Wellness Workshop",
    club: "SSMU Wellness",
    date: "Mar 21",
    time: "3:00 PM",
    location: "SSMU Ballroom",
    categories: ["wellness"] as const,
    imageColor: "#0E6655",
  },
  {
    title: "Film Festival",
    club: "Film Society",
    date: "Mar 22",
    time: "7:00 PM",
    location: "Arts W-215",
    categories: ["cultural", "social"] as const,
    imageColor: "#784212",
  },
];

export const Explore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card expansion into modal (frame 60-90)
  const modalProgress = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 130 },
  });

  const showModal = frame >= 60;

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
        <div style={{ padding: 16, paddingTop: 50, position: "relative" }}>
          {/* Cascading cards */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CARDS.map((card, i) => {
              const cascadeProgress = spring({
                frame: Math.max(0, frame - i * 8),
                fps,
                config: { damping: 12, mass: 0.5, stiffness: 120 },
              });
              const cardY = interpolate(cascadeProgress, [0, 1], [100, 0]);
              const cardOpacity = interpolate(cascadeProgress, [0, 1], [0, 1]);

              // Middle card lifts (frame 30-60)
              const isMiddle = i === 1;
              const liftProgress = isMiddle
                ? spring({
                    frame: Math.max(0, frame - 30),
                    fps,
                    config: { damping: 15, mass: 0.5, stiffness: 140 },
                  })
                : 0;
              const liftY = interpolate(liftProgress, [0, 1], [0, -10]);
              const liftScale = interpolate(liftProgress, [0, 1], [1, 1.05]);
              const liftShadow = interpolate(liftProgress, [0, 1], [0, 20]);

              return (
                <div
                  key={i}
                  style={{
                    transform: `translateY(${cardY + liftY}px) scale(${liftScale})`,
                    opacity: showModal && isMiddle ? 0 : cardOpacity,
                    boxShadow: isMiddle
                      ? `0 ${liftShadow}px ${liftShadow * 2}px rgba(0,0,0,0.3)`
                      : "none",
                    transition: "opacity 0.1s",
                  }}
                >
                  <EventCard
                    {...card}
                    categories={[...card.categories]}
                    scale={0.58}
                  />
                </div>
              );
            })}
          </div>

          {/* Modal overlay */}
          {showModal && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `rgba(0,0,0,${interpolate(modalProgress, [0, 1], [0, 0.6])})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <GlassCard
                borderRadius={16}
                padding={20}
                opacity={0.12}
                style={{
                  transform: `scale(${interpolate(modalProgress, [0, 1], [0.8, 1])})`,
                  opacity: interpolate(modalProgress, [0, 1], [0, 1]),
                  width: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                    marginBottom: 8,
                  }}
                >
                  Wellness Workshop
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textSecondary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                    marginBottom: 4,
                  }}
                >
                  📅 March 21, 2026 &nbsp; 🕐 3:00 PM
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textSecondary,
                    fontFamily: '-apple-system, "Inter", sans-serif',
                    marginBottom: 12,
                  }}
                >
                  📍 SSMU Ballroom
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6 }}>
                  {["Open in Maps", "Add to Calendar", "Share"].map(
                    (label) => (
                      <div
                        key={label}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          background:
                            label === "Open in Maps"
                              ? COLORS.primary
                              : "rgba(255,255,255,0.08)",
                          border:
                            label === "Open in Maps"
                              ? "none"
                              : `1px solid ${COLORS.glassBorder}`,
                          fontSize: 9,
                          color: COLORS.textPrimary,
                          fontFamily: '-apple-system, "Inter", sans-serif',
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </div>
                    )
                  )}
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </DeviceMockup>

      <TextSlam text="Explore." direction="right" enterFrame={90} />
    </AbsoluteFill>
  );
};
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/Explore.tsx
git commit -m "feat(demo-video): add Explore scene with card cascade and modal"
```

---

## Task 12: Scene 5 — Plan

**Files:**
- Create: `demo-video/src/scenes/Plan.tsx`

**Step 1: Build Plan scene (frames 450-570)**

Create `demo-video/src/scenes/Plan.tsx`:
```tsx
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

  // Wipe in from left (frame 0-30)
  const wipeProgress = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 },
  });
  const wipeX = interpolate(wipeProgress, [0, 1], [-400, 0]);

  // Dots fill in progressively (frame 30-70)
  // Each frame reveals ~1 dot, 35 total cells
  const visibleDots = Math.min(35, Math.max(0, Math.floor((frame - 30) * 0.9)));

  // Day highlight (frame 70+)
  const highlightDay = frame >= 70 ? 17 : undefined;

  // Mini popup (frame 75+)
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

            {/* Mini event popup */}
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
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/Plan.tsx
git commit -m "feat(demo-video): add Plan scene with calendar dot cascade"
```

---

## Task 13: Scene 6 — Save

**Files:**
- Create: `demo-video/src/scenes/Save.tsx`

**Step 1: Build Save scene (frames 570-690)**

Create `demo-video/src/scenes/Save.tsx`:
```tsx
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

  // Zoom into heart (frame 0-30): scale up, focus on center
  const zoomIn = interpolate(frame, [0, 30], [1, 2.5], {
    extrapolateRight: "clamp",
  });

  // Heart pulse (frame 30-50)
  const heartBeat = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 8, mass: 0.3, stiffness: 200 },
  });
  const heartScale = frame >= 30 ? interpolate(heartBeat, [0, 1], [0.5, 1]) : 0;
  const heartFilled = frame >= 35;

  // Zoom out to grid (frame 50-80)
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
          {/* Heart icon center */}
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

          {/* My Events grid */}
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
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/Save.tsx
git commit -m "feat(demo-video): add Save scene with heart pulse and grid"
```

---

## Task 14: Scene 7 — FlashCuts

**Files:**
- Create: `demo-video/src/scenes/FlashCuts.tsx`

**Step 1: Build FlashCuts scene (frames 690-810)**

Create `demo-video/src/scenes/FlashCuts.tsx`:
```tsx
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

  // 3 cuts: 0-30, 30-60, 60-90
  const cut = frame < 30 ? 0 : frame < 60 ? 1 : 2;

  // Flash white on each cut transition
  const flashOpacity =
    (frame >= 29 && frame <= 31) || (frame >= 59 && frame <= 61)
      ? interpolate(
          frame % 30,
          [29 % 30, 30 % 30, 31 % 30],
          [0.8, 0.8, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
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
              background: interpolate(frame, [0, 25], [0, 1], {
                extrapolateRight: "clamp",
              })
                ? "#F9F7F2"
                : COLORS.deviceScreen,
              height: "100%",
              transition: "background 0.3s",
            }}
          >
            {/* Light mode UI mockup */}
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

            {/* Placeholder content blocks */}
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

      {/* Cut 2: Clubs page on smaller phone */}
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

            {/* Club cards */}
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
            {/* Badge */}
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
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/FlashCuts.tsx
git commit -m "feat(demo-video): add FlashCuts scene with hard cuts and flash"
```

---

## Task 15: Scene 8 — Outro

**Files:**
- Create: `demo-video/src/scenes/Outro.tsx`

**Step 1: Build Outro scene (frames 810-900)**

Create `demo-video/src/scenes/Outro.tsx`:
```tsx
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

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo fades in (frame 10-40)
  const logoProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 100 },
  });
  const logoOpacity = interpolate(logoProgress, [0, 1], [0, 1]);
  const logoScale = interpolate(logoProgress, [0, 1], [0.9, 1]);

  // "Coming Soon" fades in (frame 40-60)
  const comingSoonProgress = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 100 },
  });
  const comingSoonOpacity = interpolate(comingSoonProgress, [0, 1], [0, 1]);

  // Date types in (frame 60-75)
  const dateText = "03.17.2026";
  const typedChars = Math.min(
    dateText.length,
    Math.max(0, Math.floor((frame - 60) / 1.5))
  );
  const displayDate = dateText.slice(0, typedChars);

  // Glow pulse
  const glowPulse =
    frame >= 10
      ? 0.35 + Math.sin((frame - 10) * 0.08) * 0.1
      : 0;

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
      {/* Logo */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.primary}, #ff4757)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 80px rgba(237, 27, 47, ${glowPulse})`,
          }}
        >
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: "#FFFFFF",
              fontFamily: '-apple-system, "SF Pro Display", "Inter", sans-serif',
            }}
          >
            U
          </span>
        </div>

        <div style={{ marginTop: 20 }}>
          <span style={TYPOGRAPHY.logoText}>UNI-VERSE</span>
        </div>
      </div>

      {/* Coming Soon */}
      <div
        style={{
          marginTop: 32,
          opacity: comingSoonOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={TYPOGRAPHY.comingSoon}>Coming Soon</span>

        {frame >= 60 && (
          <span style={TYPOGRAPHY.date}>
            {displayDate}
            {typedChars < dateText.length && (
              <span style={{ opacity: Math.floor(frame / 4) % 2 }}>_</span>
            )}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
```

**Step 2: Commit**

```bash
git add demo-video/src/scenes/Outro.tsx
git commit -m "feat(demo-video): add Outro scene with logo and date typewriter"
```

---

## Task 16: Main DemoVideo Orchestrator

**Files:**
- Create: `demo-video/src/DemoVideo.tsx`

**Step 1: Wire all scenes together with Sequence timing**

Create `demo-video/src/DemoVideo.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { COLORS } from "./styles/colors";

import { LogoIntro } from "./scenes/LogoIntro";
import { Discover } from "./scenes/Discover";
import { Filter } from "./scenes/Filter";
import { Explore } from "./scenes/Explore";
import { Plan } from "./scenes/Plan";
import { Save } from "./scenes/Save";
import { FlashCuts } from "./scenes/FlashCuts";
import { Outro } from "./scenes/Outro";

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.background }}>
      {/* Beat 1: Logo Intro (0-3s) */}
      <Sequence from={0} durationInFrames={90}>
        <LogoIntro />
      </Sequence>

      {/* Beat 2: Discover (3-7s) */}
      <Sequence from={90} durationInFrames={120}>
        <Discover />
      </Sequence>

      {/* Beat 3: Filter (7-11s) */}
      <Sequence from={210} durationInFrames={120}>
        <Filter />
      </Sequence>

      {/* Beat 4: Explore (11-15s) */}
      <Sequence from={330} durationInFrames={120}>
        <Explore />
      </Sequence>

      {/* Beat 5: Plan (15-19s) */}
      <Sequence from={450} durationInFrames={120}>
        <Plan />
      </Sequence>

      {/* Beat 6: Save (19-23s) */}
      <Sequence from={570} durationInFrames={120}>
        <Save />
      </Sequence>

      {/* Beat 7: Flash Cuts (23-27s) */}
      <Sequence from={690} durationInFrames={120}>
        <FlashCuts />
      </Sequence>

      {/* Beat 8: Outro (27-30s) */}
      <Sequence from={810} durationInFrames={90}>
        <Outro />
      </Sequence>

      {/* === SFX Audio Layers === */}

      {/* Beat 1: Deep whoosh + impact */}
      <Sequence from={20}>
        <Audio src={staticFile("sfx/whoosh-deep.mp3")} volume={0.8} />
      </Sequence>
      <Sequence from={30}>
        <Audio src={staticFile("sfx/impact-hit.mp3")} volume={0.9} />
      </Sequence>

      {/* Beat 2: Swoosh + keyboard clicks + snap */}
      <Sequence from={90}>
        <Audio src={staticFile("sfx/swoosh-airy.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={115}>
        <Audio src={staticFile("sfx/keyboard-click.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={180}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 3: Glass taps + shuffle + snap */}
      <Sequence from={240}>
        <Audio src={staticFile("sfx/glass-tap.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={252}>
        <Audio src={staticFile("sfx/glass-tap.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={264}>
        <Audio src={staticFile("sfx/glass-tap.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={280}>
        <Audio src={staticFile("sfx/card-shuffle.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={300}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 4: Pop + modal slide + snap */}
      <Sequence from={330}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={390}>
        <Audio src={staticFile("sfx/modal-slide.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={420}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 5: Rapid ticks + chime + snap */}
      <Sequence from={480}>
        <Audio src={staticFile("sfx/tick-rapid.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={520}>
        <Audio src={staticFile("sfx/chime.mp3")} volume={0.6} />
      </Sequence>
      <Sequence from={540}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 6: Heartbeat + whoosh + snap */}
      <Sequence from={600}>
        <Audio src={staticFile("sfx/heartbeat-thump.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={620}>
        <Audio src={staticFile("sfx/swoosh-airy.mp3")} volume={0.5} />
      </Sequence>
      <Sequence from={650}>
        <Audio src={staticFile("sfx/snap-hit.mp3")} volume={0.8} />
      </Sequence>

      {/* Beat 7: Shutter clicks + impact */}
      <Sequence from={690}>
        <Audio src={staticFile("sfx/shutter-click.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={720}>
        <Audio src={staticFile("sfx/shutter-click.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={750}>
        <Audio src={staticFile("sfx/shutter-click.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={780}>
        <Audio src={staticFile("sfx/impact-hit.mp3")} volume={1.0} />
      </Sequence>

      {/* Beat 8: Final impact */}
      <Sequence from={820}>
        <Audio src={staticFile("sfx/impact-final.mp3")} volume={1.0} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

**Step 2: Commit**

```bash
git add demo-video/src/DemoVideo.tsx
git commit -m "feat(demo-video): add main DemoVideo orchestrator with all sequences and SFX"
```

---

## Task 17: Move SFX to public/sfx for staticFile()

Remotion's `staticFile()` serves from a `public/` directory inside the Remotion project root.

**Files:**
- Move: `demo-video/src/assets/sfx/*` → `demo-video/public/sfx/`

**Step 1: Create public directory and move SFX**

```bash
mkdir -p demo-video/public/sfx
mv demo-video/src/assets/sfx/*.mp3 demo-video/public/sfx/
rmdir demo-video/src/assets/sfx
rmdir demo-video/src/assets
```

**Step 2: Commit**

```bash
git add demo-video/public/sfx/ demo-video/src/assets/
git commit -m "refactor(demo-video): move SFX to public/ for staticFile()"
```

---

## Task 18: Preview, Polish & Render

**Step 1: Launch Remotion Studio and preview**

```bash
cd demo-video && npx remotion studio
```

Expected: Browser opens, all 8 scenes render in sequence with correct timing.

**Step 2: Check each scene in the timeline**

Scrub through the timeline and verify:
- Beat 1 (0-90): Logo slams in, text fades in, glow pulses
- Beat 2 (90-210): Device flies up, search types, cards appear, "Discover." slams
- Beat 3 (210-330): Badges toggle on with glow, cards shuffle, "Filter." slams
- Beat 4 (330-450): Cards cascade, middle lifts, modal opens, "Explore." slams
- Beat 5 (450-570): Calendar wipes in, dots fill, day highlights, "Plan." slams
- Beat 6 (570-690): Heart zooms in, pulses, zooms out to grid, "Save." slams
- Beat 7 (690-810): Dark mode → clubs → notification bell, "Go." slams
- Beat 8 (810-900): Logo + "Coming Soon" + date typewriter

**Step 3: Fix any visual issues found during preview**

Adjust spring configs, timing, or positioning as needed.

**Step 4: Render final MP4**

```bash
cd demo-video && npx remotion render DemoVideo out/universe-demo.mp4
```

Expected: `demo-video/out/universe-demo.mp4` (1080x1080, 30fps, 30s).

**Step 5: Add out/ to .gitignore**

```bash
echo "out/" >> demo-video/.gitignore
```

**Step 6: Final commit**

```bash
git add demo-video/.gitignore
git commit -m "feat(demo-video): finalize video and add .gitignore for renders"
```

---

## Task Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Scaffold Remotion project | 3 min |
| 2 | Colors, constants, placeholder SFX | 2 min |
| 3 | GlassCard component | 2 min |
| 4 | TextSlam component | 3 min |
| 5 | DeviceMockup component | 3 min |
| 6 | EventCard + CategoryBadge components | 3 min |
| 7 | CalendarGrid component | 3 min |
| 8 | Scene 1: LogoIntro | 3 min |
| 9 | Scene 2: Discover | 4 min |
| 10 | Scene 3: Filter | 4 min |
| 11 | Scene 4: Explore | 4 min |
| 12 | Scene 5: Plan | 3 min |
| 13 | Scene 6: Save | 3 min |
| 14 | Scene 7: FlashCuts | 4 min |
| 15 | Scene 8: Outro | 3 min |
| 16 | DemoVideo orchestrator | 3 min |
| 17 | Move SFX to public/ | 1 min |
| 18 | Preview, polish & render | 5 min |
