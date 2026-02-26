# Remotion Product Demo Video Design

**Date:** 2026-02-25
**Type:** a16z-style product launch demo for X
**Duration:** 30 seconds

## Video Specs

| Spec | Value |
|------|-------|
| Resolution | 1080x1080 (square, X feed optimal) |
| FPS | 30 |
| Duration | 30s (900 frames) |
| Format | MP4 (H.264) |
| Remotion | v4 (latest) |
| Location | `/demo-video/` at repo root |

## Creative Direction

- Apple-style spring motion graphics
- Glassmorphism throughout (frosted glass, backdrop blur)
- SFX-heavy, no music, no voices
- One-word punchy text beats
- iPhone device mockup with recreated + screenshot hybrid UI
- Dark background (#0A0A0A)
- Closing: Logo + "Coming Soon 03.17.2026"

## Project Structure

```
demo-video/
├── src/
│   ├── Root.tsx              # Composition registration
│   ├── DemoVideo.tsx         # Main sequence orchestrator
│   ├── scenes/
│   │   ├── LogoIntro.tsx     # Beat 1: Logo slam
│   │   ├── Discover.tsx      # Beat 2: Hero + search
│   │   ├── Filter.tsx        # Beat 3: Category badges
│   │   ├── Explore.tsx       # Beat 4: Event cards + modal
│   │   ├── Plan.tsx          # Beat 5: Calendar
│   │   ├── Save.tsx          # Beat 6: Heart + My Events
│   │   ├── FlashCuts.tsx     # Beat 7: Rapid montage
│   │   └── Outro.tsx         # Beat 8: Logo + Coming Soon
│   ├── components/
│   │   ├── DeviceMockup.tsx  # iPhone frame with glass treatment
│   │   ├── TextSlam.tsx      # Reusable text slam animation
│   │   ├── EventCard.tsx     # Stylized event card
│   │   ├── CategoryBadge.tsx # Glowing category badge
│   │   ├── CalendarGrid.tsx  # Simplified calendar
│   │   └── GlassCard.tsx     # Reusable glassmorphism container
│   ├── styles/
│   │   └── colors.ts         # McGill palette constants
│   └── assets/
│       └── sfx/              # SFX audio files (placeholder)
├── package.json
└── tsconfig.json
```

## Visual Design Language

### Apple-Style Motion
- Spring physics: `spring({damping: 12, mass: 0.5, stiffness: 120})`
- Depth layers: background blur → mid-ground device → foreground text
- Subtle rotation: 2-3 degree tilt on device entry/exit
- Scale overshoots: 1.0 → 1.08 → 1.0 settle
- Fast starts, slow arrivals (ease-out-cubic)

### Glassmorphism
- Device frame: `rgba(255,255,255,0.15)` border, `backdrop-filter: blur(40px)`
- Text slam pills: frosted glass, 10-15% white opacity
- Logo glow: `0 0 80px rgba(237,27,47,0.4)` pulsing
- Outro card: glass card on dark background

### Colors
```
Background:     #0A0A0A
Glass fill:     rgba(255, 255, 255, 0.08)
Glass border:   rgba(255, 255, 255, 0.15)
Glass blur:     blur(40px)
Primary accent: #ED1B2F (McGill Red)
Glow:           rgba(237, 27, 47, 0.3)
Text primary:   #FFFFFF
Text secondary: rgba(255, 255, 255, 0.6)
```

### Category Colors
- Academic: #3b82f6 (blue)
- Social: #ec4899 (pink)
- Sports: #22c55e (green)
- Career: #a855f7 (purple)
- Cultural: #f97316 (orange)
- Wellness: #14b8a6 (teal)

### Typography
- Beat words: SF Pro Display Bold (fallback Inter Bold), 72px, -0.02em tracking
- "UNI-VERSE": 48px, 0.15em letter-spacing, uppercase
- "Coming Soon": 32px, medium weight
- "03.17.2026": 28px, monospace (SF Mono / JetBrains Mono)

### Device Mockup
- Minimal iPhone 15 Pro frame
- Dark titanium bezel (#1C1C1E)
- Glass reflection overlay (5% diagonal white gradient)
- Dynamic Island notch
- Drop shadow: `0 20px 60px rgba(0,0,0,0.5)`

## Scene Breakdown

### Beat 1 — Logo Intro (0-3s, frames 0-90)
- Frame 0-30: Pure black, tension pause
- Frame 30-50: Logo scales 0 → 1.2 → 1.0 (spring overshoot)
- Frame 50-70: "UNI-VERSE" text fades in, letter-spacing animates tight → normal
- Frame 70-90: Hold, pulse glow on logo
- SFX: Deep bass whoosh → impact hit

### Beat 2 — Discover (3-7s, frames 90-210)
- Frame 0-25: iPhone mockup flies in from bottom with slight rotation
- Frame 25-60: Hero section, search bar types "music"
- Frame 60-90: Event cards appear filtering in real-time
- Frame 90-120: "Discover." slams in from right on glass pill
- SFX: Swoosh, keyboard clicks, snap on text

### Beat 3 — Filter (7-11s, frames 210-330)
- Frame 0-30: UI crossfades to filter panel
- Frame 30-70: Category badges toggle on (Academic, Social, Sports) with glow
- Frame 70-90: Event grid re-shuffles
- Frame 90-120: "Filter." slams in from left
- SFX: Glass tap per badge, shuffle, snap

### Beat 4 — Explore (11-15s, frames 330-450)
- Frame 0-30: Three event cards cascade in from bottom, staggered
- Frame 30-60: Middle card lifts with shadow growth
- Frame 60-90: Card expands into detail modal
- Frame 90-120: "Explore." slams in from right
- SFX: Whoosh + pop, modal slide, snap

### Beat 5 — Plan (15-19s, frames 450-570)
- Frame 0-30: Wipe left to calendar month view
- Frame 30-70: Day cells fill with colored dots, cascading top-left to bottom-right
- Frame 70-90: One day highlights, mini event preview pops
- Frame 90-120: "Plan." slams in from left
- SFX: Rapid ticks, chime, snap

### Beat 6 — Save (19-23s, frames 570-690)
- Frame 0-30: Zoom into event card heart icon
- Frame 30-50: Heart fills red, pulse bounce (1 → 1.4 → 1.0)
- Frame 50-80: Zoom out to My Events grid (6 cards)
- Frame 80-120: "Save." slams in from right
- SFX: Heartbeat thump, whoosh, snap

### Beat 7 — Flash Cuts (23-27s, frames 690-810)
- Frame 0-30: Dark mode toggle, full UI inverts
- Frame 30-60: Hard cut to mobile clubs page
- Frame 60-90: Hard cut to notification bell with "3" badge
- Frame 90-120: "Go." slams center, larger than previous
- SFX: Rapid shutter clicks (x3), deeper impact on "Go."

### Beat 8 — Outro (27-30s, frames 810-900)
- Frame 0-10: Hard cut to black
- Frame 10-40: Logo fades in with McGill Red glow aura
- Frame 40-60: "Coming Soon" fades in below
- Frame 60-75: "03.17.2026" types in monospace
- Frame 75-90: Hold — clean, quiet, confident
- SFX: Single final impact hit, then silence

## SFX Map

| Sound | File | Description |
|-------|------|-------------|
| Deep whoosh | `whoosh-deep.mp3` | Sub-heavy cinematic swoosh |
| Impact hit | `impact-hit.mp3` | Bass-heavy slam, short tail |
| Swoosh | `swoosh-airy.mp3` | Fast airy left-to-right pan |
| Keyboard click | `keyboard-click.mp3` | Soft mechanical key tap |
| Snap hit | `snap-hit.mp3` | Crisp snap for text slams |
| Glass tap | `glass-tap.mp3` | High-pitched crystalline tap |
| Card shuffle | `card-shuffle.mp3` | Digital paper shuffle |
| Pop | `pop.mp3` | Short UI pop |
| Modal slide | `modal-slide.mp3` | Elastic stretch sound |
| Tick | `tick-rapid.mp3` | Clock-like rapid tick |
| Chime | `chime.mp3` | Single bright bell |
| Heartbeat | `heartbeat-thump.mp3` | Low warm single beat |
| Shutter click | `shutter-click.mp3` | Camera mechanical click |
| Final impact | `impact-final.mp3` | Cinematic with reverb tail |

SFX to be sourced from royalty-free libraries (Epidemic Sound, Artlist, freesound.org). Placeholder silent files included in build.

## Technical Implementation

### Dependencies
- `remotion`, `@remotion/cli`, `@remotion/player`, `@remotion/renderer`
- FFmpeg (for MP4 render)

### Animation Approach
- `interpolate()` + `spring()` from Remotion
- `<Sequence>` components for beat timing
- `<Audio>` components for SFX per-sequence
- `<AbsoluteFill>` layering: background → device → text
- CSS `backdrop-filter` for glassmorphism

### Render
```bash
cd demo-video && npx remotion render DemoVideo out/universe-demo.mp4
```
