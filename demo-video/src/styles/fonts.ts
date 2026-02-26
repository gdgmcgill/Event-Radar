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
