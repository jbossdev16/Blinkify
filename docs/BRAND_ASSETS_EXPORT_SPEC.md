# Brand assets export spec

Use this checklist to export all Blinkify logo variants for the brand page and email.

---

## Variants to export

| # | Variant | Description | Background |
|---|---------|-------------|------------|
| 1 | **Color icon** | Gradient star only | Transparent |
| 2 | **Color full logo** | Gradient star + "Blinkify" wordmark | Transparent |
| 3 | **Black icon** | Solid black star only | Transparent |
| 4 | **Black full logo** | Solid black star + "Blinkify" wordmark | Transparent |
| 5 | **Color on dark** | Gradient star only | Black (#000) |
| 6 | **Color full on dark** | Gradient star + wordmark | Black (#000) |
| 7 | **White icon on dark** | Solid white star only | Black (#000) |
| 8 | **White full on dark** | Solid white star + wordmark | Black (#000) |
| 9 | **White icon** | Solid white star only | Transparent |
| 10 | **White full logo** | Solid white star + "Blinkify" wordmark | Transparent |

---

## Formats

| Format | Use | Variants |
|--------|-----|----------| 
| **SVG** | Web, scalable, dev/design | 1–4, 9–10 (transparent variants) |
| **PNG** | Email, social, presentations | All 10 variants |

---

## Dimensions

### Full logo (icon + wordmark)

| Scale | Width × Height (px) | Filename suffix |
|-------|---------------------|-----------------|
| 1x | 280 × 64 | (none) |
| 2x | 560 × 128 | `@2x` |
| 4x | 1120 × 256 | `@4x` |

### Icon only

| Scale | Width × Height (px) | Filename suffix |
|-------|---------------------|-----------------|
| 1x | 64 × 64 | (none) |
| 2x | 128 × 128 | `@2x` |
| 4x | 256 × 256 | `@4x` |

---

## Filenames and quantities

**Transparent background**

| Variant | SVG | PNG 1x | PNG 2x | PNG 4x |
|---------|-----|--------|--------|--------|
| Color icon | `blinkify-icon-color.svg` | `blinkify-icon-color.png` | `blinkify-icon-color@2x.png` | `blinkify-icon-color@4x.png` |
| Color full logo | `blinkify-logo-color.svg` | `blinkify-logo-color.png` | `blinkify-logo-color@2x.png` | `blinkify-logo-color@4x.png` |
| Black icon | `blinkify-icon-black.svg` | `blinkify-icon-black.png` | `blinkify-icon-black@2x.png` | `blinkify-icon-black@4x.png` |
| Black full logo | `blinkify-logo-black.svg` | `blinkify-logo-black.png` | `blinkify-logo-black@2x.png` | `blinkify-logo-black@4x.png` |

**White on transparent** — for use on any dark or colored background.

| Variant | SVG | PNG 1x | PNG 2x | PNG 4x |
|---------|-----|--------|--------|--------|
| White icon | `blinkify-icon-white.svg` | `blinkify-icon-white.png` | `blinkify-icon-white@2x.png` | `blinkify-icon-white@4x.png` |
| White full logo | `blinkify-logo-white.svg` | `blinkify-logo-white.png` | `blinkify-logo-white@2x.png` | `blinkify-logo-white@4x.png` |

---

## Total count

| Type | Count |
|------|-------|
| SVG | 6 |
| PNG (all scales, all variants) | 6×3 (transparent) + 4×3 (dark bg) = 18 + 12 = **30** |
| **Total files** | **36** |

---

## Where to put files

Place all exports in:

```
apps/web/public/logo/
```

---

## Email requirement

The waitlist welcome email uses the **color full logo** at 1x:

- **File:** `blinkify-logo-color.png`
- **Dimensions:** 280 × 64 px
- **Background:** Transparent

Export this first if you need the email logo working quickly.

---

## Quick reference: full logo dimensions

| Scale | Full logo (W×H) | Icon (W×H) |
|-------|----------------|------------|
| 1x | 280 × 64 | 64 × 64 |
| 2x | 560 × 128 | 128 × 128 |
| 4x | 1120 × 256 | 256 × 256 |
