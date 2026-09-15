# UNI-VERSE Typography

## Primary typeface

| Role | Family | Weight | Source |
|------|--------|--------|--------|
| UI & body | **Inter** | 400 (regular), 500 (medium), 600 (semibold), 700 (bold) | [Google Fonts](https://fonts.google.com/specimen/Inter) |

Loaded in `src/app/layout.tsx` via `next/font/google` with CSS variable `--font-sans`.

```tsx
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
```

Tailwind: `font-sans` → `var(--font-sans), system-ui, sans-serif`

## Brand name styling

Use **UNI-VERSE** in product UI (all caps, hyphenated). Avoid “Uni-Verse” or “Universe” in user-facing chrome.

## Scale (app defaults)

The app uses Tailwind’s default type scale. Common patterns:

| Element | Classes |
|---------|---------|
| Page title | `text-2xl` / `text-3xl font-bold tracking-tight` |
| Section heading | `text-xl font-semibold` |
| Body | `text-sm` / `text-base` |
| Muted caption | `text-sm text-muted-foreground` |

## Icons

[Lucide React](https://lucide.dev/) — stroke icons, typically `h-4 w-4` or `h-5 w-5` inline with text.
