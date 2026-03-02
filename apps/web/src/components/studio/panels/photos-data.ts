/** Photo presets for the studio. Uses Picsum for variety (hundreds of distinct images). */
const PICSUM_BASE = "https://picsum.photos";

/** 200+ photo entries using seed for stable, distinct images. */
export const PHOTOS_LIST: { seed: string; name: string }[] = Array.from({ length: 200 }, (_, i) => ({
  seed: `blinkify-${i + 1}`,
  name: `Photo ${i + 1}`,
}));

export function getPhotoUrl(seed: string, width: number = 400, height: number = 300): string {
  return `${PICSUM_BASE}/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}
