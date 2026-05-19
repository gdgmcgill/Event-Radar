# UNI-VERSE Brand Assets

Canonical branding kit for the McGill campus events platform. Files here are served in production via `public/brand` (symlink).

## Folder structure

```
brand/
├── README.md                 ← you are here
├── logo/                     ← logos & app icons
├── colors/                   ← palettes & design tokens
├── typography/               ← fonts & type guidance
└── imagery/                  ← branded photography for heroes
```

## Logo

| File | Size | Use |
|------|------|-----|
| `logo/uni-verse-logo-primary.png` | 2000×2000 | Master asset, print, large UI |
| `logo/uni-verse-logo-512.png` | 512×512 | Social previews, app stores |
| `logo/apple-touch-icon-180x180.png` | 180×180 | iOS home screen |
| `logo/favicon-32x32.png` | 32×32 | Browser tab favicon |

**In-app path:** `/brand/logo/uni-verse-logo-primary.png`

Transparent PNG. Do not stretch; prefer square containers with `object-contain`.

## Colors

| File | Contents |
|------|----------|
| `colors/palette.json` | McGill palette + light/dark semantic colors (hex) |
| `colors/semantic-tokens.css` | HSL CSS variables (matches `globals.css`) |
| `colors/category-colors.json` | Per–event-tag accent colors |

**Primary brand color:** McGill Red `#ED1B2F`

## Typography

See [`typography/typography.md`](./typography/typography.md) — Inter (Google Fonts), loaded via Next.js.

## Imagery

| File | Use |
|------|-----|
| `imagery/hero-mcgill-fallback.jpg` | Default hero when no featured events |
| `imagery/hero-campus-friends.jpg` | Social / friends hero variant |

**In-app paths:** `/brand/imagery/hero-mcgill-fallback.jpg`, `/brand/imagery/hero-campus-friends.jpg`

## Naming conventions

- **Product name:** `UNI-VERSE` (user-facing)
- **Files:** `kebab-case` with descriptive suffixes (`-primary`, `-512`, `favicon-32x32`)
- **Repo folder:** `brand/` at project root

## Updating assets

1. Replace files in this folder (keep filenames or update references in `src/`).
2. Regenerate resized logos from primary if needed:

   ```bash
   sips -z 512 512 brand/logo/uni-verse-logo-primary.png --out brand/logo/uni-verse-logo-512.png
   sips -z 180 180 brand/logo/uni-verse-logo-primary.png --out brand/logo/apple-touch-icon-180x180.png
   sips -z 32 32 brand/logo/uni-verse-logo-primary.png --out brand/logo/favicon-32x32.png
   ```

3. Sync color tokens in `src/app/globals.css` and `tailwind.config.ts` if the palette changes; then update `colors/palette.json` to match.
