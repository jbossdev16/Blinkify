/**
 * Veo 3.1 video generation configuration.
 * Models: Blinkify Standard (quality) | Blinkify Fast (speed).
 */

import { CREDIT_COSTS } from "./plan-config.js";

/** User-facing model labels → Gemini model IDs */
export const VIDEO_MODELS = {
  standard: "veo-3.1-generate-preview",
  fast: "veo-3.1-fast-generate-preview",
} as const;

/** Fallback model when primary returns 503 (e.g. standard → fast). */
export const VIDEO_MODEL_FALLBACK: Record<keyof typeof VIDEO_MODELS, keyof typeof VIDEO_MODELS> = {
  standard: "fast",
  fast: "standard",
};

export type VideoModelKey = keyof typeof VIDEO_MODELS;

/** Aspect ratios supported by Veo */
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;

export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

/** Resolutions supported by Veo (1080p = Standard, 4k = Ultra). */
export const VIDEO_RESOLUTIONS = ["1080p", "4k"] as const;

export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

/** Clip duration: only 8 seconds supported. */
export const VIDEO_INITIAL_SECONDS = 8;

/** Max target duration in seconds (fixed at 8s; no longer durations). */
export const VIDEO_MAX_DURATION_SECONDS = VIDEO_INITIAL_SECONDS;

/** Default duration. */
export const VIDEO_DURATION_SECONDS = VIDEO_INITIAL_SECONDS;

/** No-op: only 8s videos supported; no extensions. */
export function extendsNeeded(_targetSeconds: number): number {
  return 0;
}

/** Credit cost for the Creative Studio video tool only (not full campaign). */
export function videoCreditCost(resolution: VideoResolution): number {
  return resolution === "4k"
    ? CREDIT_COSTS.STANDALONE_VIDEO_4K
    : CREDIT_COSTS.STANDALONE_VIDEO_1080P;
}

/** Timeout: 2× typical generation (8s video ≈ 2–5 min; use 10 min base × 2) */
export const VIDEO_GENERATION_TIMEOUT_MS = 20 * 60 * 1000;
