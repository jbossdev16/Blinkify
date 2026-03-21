"use client";

import { useState, useRef, useEffect, useCallback, Fragment, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Send,
  SlidersHorizontal,
  ImagePlus,
  Video,
  Mail,
  Monitor,
  Plus,
  ChevronDown,
  Bookmark,
  Download,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  RotateCcw,
  Copy,
  Reply,
  X,
  Palette,
  Check,
  Hammer,
  Zap,
  Lock,
} from "lucide-react";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { Project } from "@/lib/api";
import { apiClientFetch } from "@/lib/api-client";
import { browserApiUrl } from "@/lib/browser-api-base";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { renderContentWithBold } from "@/lib/render-content-with-bold";
import { getPlanFeatures, imageCreditCost, emailCreditCost, videoCreditCost } from "@/lib/constants";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { DotGridBg } from "@/components/ui/dot-grid-bg";
import { toast } from "sonner";
import { isEmailTemplateId, type EmailTemplateId } from "@/lib/email-templates";
import { buildStandaloneMarketingEmailHtml } from "@/lib/standalone-email-html";

/* ─── Types ───────────────────────────────────────────────────────────── */

type CreativeTool = "image" | "video" | "email" | "full" | null;

type ImageAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
type ImageResolution = "1K" | "4K";

type AdStyleId = "none" | "luxury_editorial" | "element_explosion" | "product_in_action";

interface ImageOptions {
  aspectRatio: ImageAspectRatio;
  resolution: ImageResolution;
  temperature: number;
  numberOfImages: number;
  carousel: boolean;
  adStyle: AdStyleId;
}

type VideoModelKey = "standard" | "fast";
type VideoAspectRatio = "16:9" | "9:16";
type VideoResolution = "1080p" | "4k";

interface VideoOptions {
  model: VideoModelKey;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  durationSeconds: number;
  generateAudio: boolean;
  negativePrompt: string;
}

type EmailAspectRatio = "9:16" | "1:1";
type EmailNumberOfImages = 1 | 2 | 3;
type EmailImageQuality = "1K" | "4K";
interface EmailOptions {
  aspectRatio: EmailAspectRatio;
  numberOfImages: EmailNumberOfImages;
  imageQuality: EmailImageQuality;
}

export interface EmailPayload {
  subjectLine: string;
  headline: string;
  introCopy: string;
  closingCopy: string;
  ctaText: string;
  ctaUrl: string | null;
  numberOfImages?: EmailNumberOfImages;
}

export interface EmailBrandSnapshot {
  brand_name?: string;
  brand_colors: string[];
  font_styles: unknown;
  brand_logo_url: string | null;
  /** Website URL for CTA and clickable images in email. */
  website_url?: string | null;
  social_links?: Record<string, string> | null;
}

interface CreativeMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  tool?: CreativeTool;
  /** Stage lines shown before content (e.g. "Creating a plan...") */
  stages?: string[];
  imageUrls?: string[];
  videoUrl?: string | null;
  generationId?: string;
  /** All generation ids for this message (e.g. email with N images). Used to hydrate imageUrls in order. */
  generationIds?: string[];
  generating?: boolean;
  progress?: number;
  /** Email marketing: structured copy when tool === "email" */
  emailPayload?: EmailPayload;
  /** Brand snapshot for Copy HTML (not persisted; logo URL expires) */
  emailBrandSnapshot?: EmailBrandSnapshot;
  /** Long-lived signed URLs for email images (used in Copy HTML). */
  signedImageUrls?: string[];
  /** Data URLs of images attached to this user message (not persisted). */
  attachedImageUrls?: string[];
  /** User message was sent from Full Campaign form; show follow-up chips below next assistant reply. */
  fullCampaignRequest?: boolean;
  /** Layout for Ad Creative / video results panel */
  studioMeta?: {
    aspectRatio?: ImageAspectRatio;
    imageCount?: number;
    videoAspect?: VideoAspectRatio;
  };
}

const IMAGE_ASPECT_RATIOS: { value: ImageAspectRatio; label: string }[] = [
  { value: "4:5", label: "Portrait (4:5)" },
  { value: "9:16", label: "Story (9:16)" },
  { value: "16:9", label: "Landscape (16:9)" },
];

const IMAGE_RESOLUTIONS: { value: ImageResolution; label: string; note?: string }[] = [
  { value: "1K", label: "Standard (1K)" },
  { value: "4K", label: "Ultra (4K)", note: "Uses 2.5× credits" },
];

const VIDEO_MODELS: { value: VideoModelKey; label: string }[] = [
  { value: "fast", label: "Blinkify Fast" },
  { value: "standard", label: "Blinkify Standard" },
];

const VIDEO_ASPECT_RATIOS: { value: VideoAspectRatio; label: string }[] = [
  { value: "16:9", label: "Landscape (YouTube / Meta)" },
  { value: "9:16", label: "Vertical (TikTok / Reels / Stories)" },
];

const VIDEO_DURATIONS = [
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
] as const;

const VIDEO_RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: "1080p", label: "Standard" },
  { value: "4k", label: "Ultra (4K)" },
];

const EMAIL_NUMBER_OF_IMAGES: { value: EmailNumberOfImages; label: string }[] = [
  { value: 1, label: "1 image" },
  { value: 2, label: "2 images" },
  { value: 3, label: "3 images" },
];

const EMAIL_IMAGE_QUALITIES: { value: EmailImageQuality; label: string; note?: string }[] = [
  { value: "1K", label: "Standard (1K)" },
  { value: "4K", label: "Ultra (4K)", note: "Uses 2.5× credits" },
];

const POLL_INTERVAL_MS = 5000;
const MAX_INPUT_IMAGES = 10;
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const TEMPERATURE_DEFAULT = 0.9;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Stored message shape (no imageUrls/videoUrl — they expire). signedImageUrls are kept (1-year expiry). */
interface StoredCreativeMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  tool?: CreativeTool;
  stages?: string[];
  generationId?: string;
  generationIds?: string[];
  hasImage?: boolean;
  emailPayload?: EmailPayload;
  signedImageUrls?: string[];
  fullCampaignRequest?: boolean;
  /** User message image attachments (data URLs) so they persist across refresh */
  attachedImageUrls?: string[];
}

/** Keeps JSONB small — avoids timeouts on `creative_studio_chats.data` reads/writes. */
const MAX_STORED_CREATIVE_MESSAGES = 100;
/** Rough cap for base64 data URLs persisted per user message (~100KB). */
const MAX_ATTACHED_DATA_URL_CHARS = 100_000;

function clampAttachedImageUrlsForStorage(urls: string[] | undefined): string[] | undefined {
  if (!urls?.length) return undefined;
  const out: string[] = [];
  let total = 0;
  for (const u of urls) {
    if (total + u.length > MAX_ATTACHED_DATA_URL_CHARS) break;
    out.push(u);
    total += u.length;
  }
  return out.length > 0 ? out : undefined;
}

/** Drop huge email HTML when session can be rehydrated by campaign id (reduces disk I/O). */
function slimCampaignStateForPersistence(cs: SavedCampaignState): SavedCampaignState {
  const results = { ...cs.results };
  if (results.campaignId) {
    delete results.emailHtml;
    delete results.emailHtmls;
  }
  return { ...cs, results };
}

function standaloneAdImageLayoutClass(aspect: ImageAspectRatio, n: number): string {
  const wide =
    aspect === "16:9" ||
    aspect === "21:9" ||
    aspect === "5:4" ||
    aspect === "4:3" ||
    aspect === "3:2";
  if (wide) {
    if (n <= 3) return "flex flex-col gap-5 w-full max-w-5xl mx-auto items-stretch";
    return "grid grid-cols-2 gap-5 w-full max-w-6xl mx-auto items-start";
  }
  if (n <= 1) return "flex justify-center items-start w-full px-1";
  if (n <= 3)
    return "flex flex-row flex-wrap gap-5 justify-center items-start w-full max-w-[min(100%,1240px)] mx-auto px-1";
  return "grid grid-cols-2 gap-5 w-full max-w-[min(100%,1100px)] mx-auto justify-items-center px-1";
}

function standaloneAdImageCellWrapClass(aspect: ImageAspectRatio, n: number): string {
  const wide =
    aspect === "16:9" ||
    aspect === "21:9" ||
    aspect === "5:4" ||
    aspect === "4:3" ||
    aspect === "3:2";
  if (wide) return "w-full rounded-xl overflow-hidden border border-border bg-background shadow-sm";
  if (n <= 1)
    return "w-full max-w-[min(92vw,620px)] shrink-0 rounded-xl overflow-hidden border border-border bg-background shadow-sm";
  if (n <= 3)
    return "w-[min(48vw,560px)] sm:w-[min(47%,560px)] max-w-[560px] shrink-0 rounded-xl overflow-hidden border border-border bg-background shadow-sm";
  return "w-full max-w-[540px] rounded-xl overflow-hidden border border-border bg-background shadow-sm";
}

/** Loading placeholders only — matches expected ratio so layout doesn’t jump wildly. */
function standaloneAdImageSkeletonClass(aspect: ImageAspectRatio): string {
  const wide =
    aspect === "16:9" ||
    aspect === "21:9" ||
    aspect === "5:4" ||
    aspect === "4:3" ||
    aspect === "3:2";
  if (wide) return "aspect-video w-full min-h-[220px] rounded-lg bg-muted/50 animate-pulse";
  if (aspect === "9:16") return "aspect-[9/16] w-full min-h-[420px] rounded-lg bg-muted/50 animate-pulse";
  if (aspect === "1:1") return "aspect-square w-full max-w-[560px] mx-auto min-h-[280px] rounded-lg bg-muted/50 animate-pulse";
  return "aspect-[4/5] w-full min-h-[380px] rounded-lg bg-muted/50 animate-pulse";
}

function defaultImageOptions(): ImageOptions {
  return {
    aspectRatio: "4:5",
    resolution: "1K",
    temperature: TEMPERATURE_DEFAULT,
    numberOfImages: 2,
    carousel: false,
    adStyle: "none",
  };
}

function defaultVideoOptions(): VideoOptions {
  return {
    model: "standard",
    aspectRatio: "16:9",
    resolution: "1080p",
    durationSeconds: 8,
    generateAudio: true,
    negativePrompt: "",
  };
}

function defaultEmailOptions(): EmailOptions {
  return { aspectRatio: "1:1", numberOfImages: 1, imageQuality: "1K" };
}

function buildImagePromptWithAdStyle(
  userPrompt: string,
  imageOptions: ImageOptions,
  adStylesConfig: { styles: Record<string, { name: string; nano_banana_suffix: string }> } | null,
  primaryColorHex: string,
  secondaryColorHex: string
): string {
  if (imageOptions.adStyle === "none" || !adStylesConfig?.styles?.[imageOptions.adStyle]) {
    return userPrompt;
  }
  const style = adStylesConfig.styles[imageOptions.adStyle];
  if (!style?.nano_banana_suffix) return userPrompt;
  return `${userPrompt}\n\n${style.nano_banana_suffix}\n\nAspect ratio: ${imageOptions.aspectRatio}. Brand primary color: ${primaryColorHex}. Brand secondary color: ${secondaryColorHex}.`;
}

function continuationSlotsForDuration(seconds: number): number {
  if (seconds <= 8) return 0;
  return Math.min(20, Math.ceil((seconds - 8) / 7));
}

const PREFERENCE_SNIPPETS_MAX = 10;

const SUGGESTED_PROMPT_CHIPS = [
  "Create a Meta ad for my best seller",
  "Generate a product launch email",
  "Make a TikTok video for this product",
  "Create an Instagram carousel for my product",
];

const FULL_CAMPAIGN_GOALS = ["New launch", "Flash sale", "Seasonal promo", "Brand awareness"] as const;
const FULL_CAMPAIGN_PLATFORMS = ["Meta feed", "Stories / Reels", "TikTok", "Email", "Pinterest"] as const;
const FULL_CAMPAIGN_FOLLOWUP_CHIPS = [
  "↻ Regenerate creatives",
  "✏️ Change campaign goal",
  "📐 Add more formats",
];

type FullCampaignStepStatus = "pending" | "in_progress" | "done" | "failed";
interface FullCampaignStepState {
  id: string;
  label: string;
  subLabel: string;
  status: FullCampaignStepStatus;
  timeTaken?: number;
  credits: number;
  progress?: number;
}
type FullCampaignQuality = "1K" | "4K";

function buildFullCampaignSteps(
  quality: FullCampaignQuality
): Omit<FullCampaignStepState, "status" | "timeTaken">[] {
  const pi = quality === "4K" ? 25 : 10;
  const pv = quality === "4K" ? 150 : 100;
  const emailC = quality === "4K" ? 50 : 40;
  const res = quality === "4K" ? "4K" : "1K";
  return [
    {
      id: "claude_json",
      label: "Campaign intelligence",
      subLabel: "Claude — prompts + copy (included)",
      credits: 0,
    },
    {
      id: "meta_feed_image_1",
      label: "Feed image 1 (1:1)",
      subLabel: `Nano Banana · ${res}`,
      credits: pi,
    },
    {
      id: "meta_feed_image_2",
      label: "Feed image 2 (1:1)",
      subLabel: `Nano Banana · ${res}`,
      credits: pi,
    },
    {
      id: "meta_feed_image_3",
      label: "Feed image 3 (1:1)",
      subLabel: `Nano Banana · ${res}`,
      credits: pi,
    },
    {
      id: "story_image_1",
      label: "Story image 1 (9:16)",
      subLabel: `Nano Banana · ${res} vertical`,
      credits: pi,
    },
    {
      id: "story_image_2",
      label: "Story image 2 (9:16)",
      subLabel: `Nano Banana · ${res} vertical`,
      credits: pi,
    },
    {
      id: "story_image_3",
      label: "Story image 3 (9:16)",
      subLabel: `Nano Banana · ${res} vertical`,
      credits: pi,
    },
    {
      id: "video_16x9",
      label: "Product video — 16:9",
      subLabel: quality === "4K" ? "Veo · 4K 16:9" : "Veo · Standard 1080p",
      credits: pv,
    },
    {
      id: "video_9x16",
      label: "Vertical video — 9:16",
      subLabel: quality === "4K" ? "Veo · 4K 9:16" : "Veo · 720p vertical",
      credits: pv,
    },
    {
      id: "email_html",
      label: "Marketing emails (2)",
      subLabel: `${emailC} credits · 2 HTML variants`,
      credits: emailC,
    },
  ];
}

function fullCampaignBudgetCredits(quality: FullCampaignQuality): number {
  return quality === "4K" ? 500 : 300;
}

async function loadCreativeStudioChatFromSupabase(workspaceId: string, projectId: string): Promise<{
  messages: CreativeMessage[];
  prompt: string;
  selectedTool: CreativeTool;
  imageOptions: ImageOptions;
  videoOptions: VideoOptions;
  emailOptions: EmailOptions;
  continuationPrompts: string[];
  imageSlidePrompts: string[];
  likedSnippets: string[];
  dislikedSnippets: string[];
  selectedEmailTemplateId: EmailTemplateId | null;
  campaignState: SavedCampaignState | null;
  /** True when we read a row from DB; false when error or no row (so we don't overwrite with empty). */
  loadedFromDb: boolean;
}> {
  let data: { data?: unknown } | null = null;
  let error: { message?: string } | null = null;
  try {
    const supabase = createSupabaseBrowserClient();
    const res = await supabase
      .from("creative_studio_chats")
      .select("data")
      .eq("project_id", projectId)
      .maybeSingle();
    data = res.data;
    error = res.error;
  } catch {
    return {
      messages: [],
      prompt: "",
      selectedTool: "image",
      imageOptions: defaultImageOptions(),
      videoOptions: defaultVideoOptions(),
      emailOptions: defaultEmailOptions(),
      continuationPrompts: [],
      imageSlidePrompts: [],
      likedSnippets: [],
      dislikedSnippets: [],
      selectedEmailTemplateId: null,
      campaignState: null,
      loadedFromDb: false,
    };
  }

  if (error || !data?.data) {
    return {
      messages: [],
      prompt: "",
      selectedTool: "image",
      imageOptions: defaultImageOptions(),
      videoOptions: defaultVideoOptions(),
      emailOptions: defaultEmailOptions(),
      continuationPrompts: [],
      imageSlidePrompts: [],
      likedSnippets: [],
      dislikedSnippets: [],
      selectedEmailTemplateId: null,
      campaignState: null,
      loadedFromDb: false,
    };
  }

  const d = data.data as {
    messages?: StoredCreativeMessage[];
    prompt?: string;
    selectedTool?: CreativeTool;
    imageOptions?: Partial<ImageOptions>;
    videoOptions?: Partial<VideoOptions>;
    emailOptions?: Partial<EmailOptions>;
    continuationPrompts?: string[];
    imageSlidePrompts?: string[];
    likedSnippets?: string[];
    dislikedSnippets?: string[];
    selectedEmailTemplateId?: string | null;
    campaignState?: SavedCampaignState | null;
  };
  const stored = d.messages ?? [];
  const messages: CreativeMessage[] = stored.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    tool: m.tool,
    stages: m.stages,
    generationId: m.generationId,
    generationIds: m.generationIds,
    hasImage: m.hasImage,
    emailPayload: m.emailPayload,
    signedImageUrls: m.signedImageUrls,
    ...(m.fullCampaignRequest && { fullCampaignRequest: true }),
    ...(m.attachedImageUrls?.length && { attachedImageUrls: m.attachedImageUrls }),
  }));
  const selectedEmailTemplateId = isEmailTemplateId(d.selectedEmailTemplateId) ? d.selectedEmailTemplateId : null;
  const mergedImage = { ...defaultImageOptions(), ...d.imageOptions };
  if (mergedImage.aspectRatio === "1:1") mergedImage.aspectRatio = "4:5";
  return {
    messages,
    prompt: d.prompt ?? "",
    selectedTool: d.selectedTool ?? null,
    imageOptions: mergedImage,
    videoOptions: { ...defaultVideoOptions(), ...d.videoOptions },
    emailOptions: { ...defaultEmailOptions(), ...d.emailOptions },
    continuationPrompts: Array.isArray(d.continuationPrompts) ? d.continuationPrompts : [],
    imageSlidePrompts: Array.isArray(d.imageSlidePrompts) ? d.imageSlidePrompts : [],
    likedSnippets: Array.isArray(d.likedSnippets) ? d.likedSnippets.slice(0, PREFERENCE_SNIPPETS_MAX) : [],
    dislikedSnippets: Array.isArray(d.dislikedSnippets) ? d.dislikedSnippets.slice(0, PREFERENCE_SNIPPETS_MAX) : [],
    selectedEmailTemplateId,
    campaignState: d.campaignState ?? null,
    loadedFromDb: true,
  };
}

interface SavedCampaignState {
  generation: {
    status: "complete";
    steps: Omit<FullCampaignStepState, "status">[];
    creditsUsed: number;
    brandName: string;
    campaignGoal: string | null;
    imageStyleChosen?: string | null;
    campaignQuality?: FullCampaignQuality;
  };
  results: {
    metaImageUrl?: string;
    metaImageUrls?: string[];
    storyImageUrl?: string;
    storyImageUrls?: string[];
    videoUrl?: string;
    videoUrl16x9?: string;
    videoUrl9x16?: string;
    emailHtml?: string;
    emailHtmls?: string[];
    emailCopy?: Record<string, string>;
    socialCopy?: Record<string, unknown>;
    emailImageUrls?: string[];
    campaignId?: string;
  };
}

async function saveCreativeStudioChatToSupabase(
  workspaceId: string,
  projectId: string,
  state: {
    messages: CreativeMessage[];
    prompt: string;
    selectedTool: CreativeTool;
    imageOptions: ImageOptions;
    videoOptions: VideoOptions;
    emailOptions: EmailOptions;
    continuationPrompts: string[];
    imageSlidePrompts: string[];
    likedSnippets: string[];
    dislikedSnippets: string[];
    selectedEmailTemplateId: EmailTemplateId | null;
    campaignState?: SavedCampaignState | null;
  },
  options?: {
    /** When state.campaignState is null, merge this so we do not wipe a completed campaign (avoids extra SELECT). */
    preservedCampaignWhenNull?: SavedCampaignState | null;
    /** Set false on full chat reset so DB campaign row is cleared. Default true. */
    mergePreservedCampaign?: boolean;
  }
): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient();
    const messagesToSave = state.messages.filter(
      (m) => !(m.role === "assistant" && m.generating)
    );
    const cappedMessages =
      messagesToSave.length > MAX_STORED_CREATIVE_MESSAGES
        ? messagesToSave.slice(-MAX_STORED_CREATIVE_MESSAGES)
        : messagesToSave;
    const storedMessages: StoredCreativeMessage[] = cappedMessages.map((m) => {
      const persistSigned =
        m.signedImageUrls?.length &&
        !(m.generationIds?.length || m.generationId);
      return {
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.tool != null && { tool: m.tool }),
        ...(m.stages != null && { stages: m.stages }),
        ...(m.generationId != null && { generationId: m.generationId }),
        ...(m.generationIds?.length && { generationIds: m.generationIds }),
        ...(m.imageUrls?.length && { hasImage: true }),
        ...(m.emailPayload && { emailPayload: m.emailPayload }),
        ...(persistSigned && { signedImageUrls: m.signedImageUrls }),
        ...(m.fullCampaignRequest && { fullCampaignRequest: true }),
        ...(m.role === "user" &&
          m.attachedImageUrls?.length && {
            attachedImageUrls: clampAttachedImageUrlsForStorage(m.attachedImageUrls),
          }),
      };
    });

    const mergePreserved = options?.mergePreservedCampaign !== false;
    let campaignStateToWrite: SavedCampaignState | null | undefined = state.campaignState;
    if (campaignStateToWrite == null && mergePreserved) {
      campaignStateToWrite = options?.preservedCampaignWhenNull ?? null;
    }
    if (campaignStateToWrite != null) {
      campaignStateToWrite = slimCampaignStateForPersistence(campaignStateToWrite);
    }

    await supabase.from("creative_studio_chats").upsert(
      {
        workspace_id: workspaceId,
        project_id: projectId,
        data: {
          messages: storedMessages,
          prompt: state.prompt,
          selectedTool: state.selectedTool,
          imageOptions: state.imageOptions,
          videoOptions: state.videoOptions,
          emailOptions: state.emailOptions,
          continuationPrompts: state.continuationPrompts,
          imageSlidePrompts: state.imageSlidePrompts,
          likedSnippets: state.likedSnippets.slice(0, PREFERENCE_SNIPPETS_MAX),
          dislikedSnippets: state.dislikedSnippets.slice(0, PREFERENCE_SNIPPETS_MAX),
          selectedEmailTemplateId: state.selectedEmailTemplateId ?? null,
          ...(campaignStateToWrite != null && { campaignState: campaignStateToWrite }),
        },
      },
      { onConflict: "project_id" }
    );
  } catch {
    /* network / Supabase unreachable — avoid unhandled rejection */
  }
}

/** Tools → Email: left panel shows HTML only; images in iframe open preview (download there) and save to collection on load. */
function MarketingEmailStandalonePreview({
  subjectLine,
  html,
  generationIdList,
  setImagePreviewUrl,
  handleSaveToCollection,
}: {
  subjectLine: string;
  html: string | null;
  generationIdList: string[];
  setImagePreviewUrl: (url: string | null) => void;
  handleSaveToCollection: (id: string) => Promise<void>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoSavedKeyRef = useRef("");

  useEffect(() => {
    autoSavedKeyRef.current = "";
  }, [html, subjectLine]);

  const onIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    const saveKey = [...generationIdList].sort().join("|");
    if (saveKey && autoSavedKeyRef.current !== saveKey) {
      autoSavedKeyRef.current = saveKey;
      for (const id of generationIdList) {
        void handleSaveToCollection(id);
      }
    }

    doc.querySelectorAll("img").forEach((node) => {
      const img = node as HTMLImageElement;
      if (img.getAttribute("data-blinkify-email-img") === "1") return;
      img.setAttribute("data-blinkify-email-img", "1");
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) return;
      img.style.cursor = "pointer";
      img.title = "Click to preview · download in viewer";
      img.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          setImagePreviewUrl(img.currentSrc || img.src);
        },
        true
      );
    });
  }, [html, generationIdList, handleSaveToCollection, setImagePreviewUrl]);

  return (
    <div className="w-full max-w-2xl max-h-[min(88vh,calc(100vh-6rem))] flex flex-col gap-3 mx-auto min-h-0">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">Subject:</span>
        <span className="text-sm font-medium truncate flex-1 min-w-0">{subjectLine}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(subjectLine);
            toast.success("Subject copied");
          }}
          className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80"
        >
          Copy subject
        </button>
        {html && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(html);
              toast.success("HTML copied");
            }}
            className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80"
          >
            Copy HTML
          </button>
        )}
      </div>
      <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {html ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Email preview"
            className="w-full flex-1 min-h-[min(60vh,520px)] border-0 bg-white"
            sandbox="allow-same-origin"
            onLoad={onIframeLoad}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
            Preview loading…
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────────── */

interface CreativeStudioChatProps {
  project: Project;
  allProjects?: Project[];
  workspaceId: string;
  plan: string;
}

export function CreativeStudioChat({ project, allProjects, workspaceId, plan }: CreativeStudioChatProps) {
  const [activeProject, setActiveProject] = useState<Project>(project);
  const projectId = activeProject.id;
  const planFeatures = getPlanFeatures(plan);
  const videoEnabled = planFeatures.videoEnabled;
  const fullCampaignEnabled = planFeatures.fullCampaignEnabled;
  const emailEnabled = planFeatures.emailEnabled;

  const [upgradeModal, setUpgradeModal] = useState<{
    feature: string;
    requiredPlan: "standard" | "pro";
  } | null>(null);

  function tryHandleBillingError(body: Record<string, unknown>): boolean {
    const code = body.code as string | undefined;
    const feature = (body.feature as string) || "credits_empty";
    const requiredPlan = (body.requiredPlan as "standard" | "pro") || "pro";
    if (
      code === "PLAN_UPGRADE_REQUIRED" ||
      code === "FREE_LIMIT_REACHED" ||
      code === "INSUFFICIENT_CREDITS"
    ) {
      setUpgradeModal({
        feature: code === "INSUFFICIENT_CREDITS" ? "credits_empty" : feature,
        requiredPlan: code === "INSUFFICIENT_CREDITS" ? "standard" : requiredPlan,
      });
      return true;
    }
    return false;
  }
  const showBrandPicker = planFeatures.maxBrands > 1 && (allProjects?.length ?? 0) > 0;
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const brandPickerRef = useRef<HTMLDivElement>(null);
  const [selectedTool, setSelectedTool] = useState<CreativeTool>(null);

  const [imageOptions, setImageOptions] = useState<ImageOptions>(defaultImageOptions);
  const [videoOptions, setVideoOptions] = useState<VideoOptions>(defaultVideoOptions);
  const [emailOptions, setEmailOptions] = useState<EmailOptions>(defaultEmailOptions);
  const [prompt, setPrompt] = useState("");
  const [continuationPrompts, setContinuationPrompts] = useState<string[]>([]);
  const [imageSlidePrompts, setImageSlidePrompts] = useState<string[]>([]);
  const [messages, setMessages] = useState<CreativeMessage[]>([]);
  const [likedSnippets, setLikedSnippets] = useState<string[]>([]);
  const [dislikedSnippets, setDislikedSnippets] = useState<string[]>([]);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<EmailTemplateId | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [adStylesConfig, setAdStylesConfig] = useState<{
    styles: Record<string, { name: string; nano_banana_suffix: string }>;
  } | null>(null);
  const adStylesLoadRef = useRef<"idle" | "loading" | "done">("idle");
  const fetchAdStyles = useCallback(() => {
    if (adStylesLoadRef.current !== "idle") return;
    adStylesLoadRef.current = "loading";
    fetch(browserApiUrl("/ad-styles"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.styles != null && typeof data.styles === "object") {
          setAdStylesConfig({ styles: data.styles });
        }
        adStylesLoadRef.current = "done";
      })
      .catch(() => {
        adStylesLoadRef.current = "idle";
      });
  }, []);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) fetchAdStyles();
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = setTimeout(run, 1400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fetchAdStyles]);

  const [generating, setGenerating] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  /** Object URLs for pending image previews; synced from pendingFiles and revoked on cleanup. */
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]);
  /** When set, the next send is a reply to this message (for context and image edit). */
  const [replyingTo, setReplyingTo] = useState<{ messageIndex: number } | null>(null);
  /* Full Campaign form state */
  const [fullCampaignProductImage, setFullCampaignProductImage] = useState<File | null>(null);
  const [fullCampaignProductPreviewUrl, setFullCampaignProductPreviewUrl] = useState<string | null>(null);
  const [fullCampaignProductDescription, setFullCampaignProductDescription] = useState("");
  const [fullCampaignGoal, setFullCampaignGoal] = useState<string | null>(null);
  const [fullCampaignPreferredStyle, setFullCampaignPreferredStyle] = useState<string>("auto");
  const [fullCampaignPlatforms, setFullCampaignPlatforms] = useState<string[]>([]);
  const [fullCampaignShake, setFullCampaignShake] = useState(false);
  const [fullCampaignQuality, setFullCampaignQuality] = useState<FullCampaignQuality>("1K");
  const [fullCampaignGeneration, setFullCampaignGeneration] = useState<{
    status: "idle" | "generating" | "complete";
    steps: FullCampaignStepState[];
    creditsUsed: number;
    brandName: string;
    campaignGoal: string | null;
    videoCountdownSeconds: number | null;
    imageStyleChosen: string | null;
    campaignQuality?: FullCampaignQuality;
    generationUnavailableRetryable?: boolean;
  }>({ status: "idle", steps: [], creditsUsed: 0, brandName: "", campaignGoal: null, videoCountdownSeconds: null, imageStyleChosen: null });
  const [fullCampaignResults, setFullCampaignResults] = useState<{
    metaImageUrl?: string;
    metaImageUrls?: string[];
    metaFeedFailed?: boolean[];
    storyImageUrl?: string;
    storyImageUrls?: string[];
    storyFailed?: boolean[];
    videoUrl?: string;
    videoUrl16x9?: string;
    videoUrl9x16?: string;
    emailHtml?: string;
    emailHtmls?: string[];
    emailCopy?: Record<string, string>;
    emailCopies?: Record<string, string>[];
    emailPayload?: CreativeMessage["emailPayload"];
    socialCopy?: {
      meta_feed?: { caption: string; hashtags: string; alt_caption: string };
      instagram_stories?: { text_overlay: string; poll_or_question: string; swipe_up_text: string };
      tiktok?: { hook: string; caption: string; hashtags: string };
      pinterest?: { title: string; description: string; hashtags: string };
      linkedin?: { caption: string; hashtags: string };
    };
    emailImageUrls?: string[];
    campaignId?: string;
  } | null>(null);
  const [fullCampaignSwipeSlide, setFullCampaignSwipeSlide] = useState(0);
  const [selectedEmailVariant, setSelectedEmailVariant] = useState(0);
  const [campaignResultsByMsgIndex, setCampaignResultsByMsgIndex] = useState<Record<number, typeof fullCampaignResults>>({});
  const [selectedCampaignMsgIndex, setSelectedCampaignMsgIndex] = useState<number | null>(null);
  const [currentCampaignMsgIndex, setCurrentCampaignMsgIndex] = useState<number | null>(null);
  const fullCampaignLastUserMsgIndexRef = useRef<number | null>(null);
  const fullCampaignResultsRef = useRef<HTMLDivElement>(null);
  const fullCampaignTouchStartX = useRef<number>(0);

  const downloadAsset = useCallback(async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error(`Failed to download ${filename}`);
    }
  }, []);

  const downloadFullCampaignZip = useCallback(async () => {
    if (!fullCampaignResults) return;
    const parts: { url: string; name: string }[] = [];
    const feedUrls = fullCampaignResults.metaImageUrls?.length ? fullCampaignResults.metaImageUrls : (fullCampaignResults.metaImageUrl ? [fullCampaignResults.metaImageUrl] : []);
    feedUrls.forEach((url, i) => parts.push({ url, name: `feed-${i + 1}.png` }));
    const storyUrls = fullCampaignResults.storyImageUrls?.length ? fullCampaignResults.storyImageUrls : (fullCampaignResults.storyImageUrl ? [fullCampaignResults.storyImageUrl] : []);
    storyUrls.forEach((url, i) => parts.push({ url, name: `story-${i + 1}.png` }));
    if (fullCampaignResults.videoUrl16x9) parts.push({ url: fullCampaignResults.videoUrl16x9, name: "video-16x9.mp4" });
    if (fullCampaignResults.videoUrl9x16) parts.push({ url: fullCampaignResults.videoUrl9x16, name: "video-9x16.mp4" });
    if (!fullCampaignResults.videoUrl16x9 && !fullCampaignResults.videoUrl9x16 && fullCampaignResults.videoUrl) parts.push({ url: fullCampaignResults.videoUrl, name: "video.mp4" });

    if (parts.length === 0 && !fullCampaignResults.emailHtml) {
      toast.error("No assets to download");
      return;
    }

    for (const { url, name } of parts) {
      await downloadAsset(url, name);
    }

    if (fullCampaignResults.emailHtml) {
      const blob = new Blob([fullCampaignResults.emailHtml], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "email.html";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    toast.success("Campaign assets downloaded");
  }, [fullCampaignResults, downloadAsset]);

  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullCampaignFileInputRef = useRef<HTMLInputElement>(null);
  const isFullCampaignSendRef = useRef(false);
  const chipSendRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Skips Supabase upsert when serialized state unchanged (reduces WAL / disk I/O). */
  const lastCreativeSavePayloadRef = useRef<string>("");
  /** Last completed campaign to merge when autosave has no campaignState (avoids SELECT on `creative_studio_chats`). */
  const preservedCampaignForSaveRef = useRef<SavedCampaignState | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  /** Tracks current load context so image/video URL fetches only apply when still relevant (avoids hydration lost to effect cleanup). */
  const hydrationContextRef = useRef<{ workspaceId: string; projectId: string } | null>(null);
  /** True after a load that returned a row from DB; prevents save effect from overwriting with empty when load failed or had no row. */
  const loadedFromDbRef = useRef(false);
  const stateRef = useRef({
    messages: [] as CreativeMessage[],
    prompt: "",
    selectedTool: null as CreativeTool,
    imageOptions: defaultImageOptions(),
    videoOptions: defaultVideoOptions(),
    emailOptions: defaultEmailOptions(),
    continuationPrompts: [] as string[],
    imageSlidePrompts: [] as string[],
    likedSnippets: [] as string[],
    dislikedSnippets: [] as string[],
    selectedEmailTemplateId: null as EmailTemplateId | null,
  });
  stateRef.current = {
    messages,
    prompt,
    selectedTool,
    imageOptions,
    videoOptions,
    emailOptions,
    continuationPrompts,
    imageSlidePrompts,
    likedSnippets,
    dislikedSnippets,
    selectedEmailTemplateId,
  };
  const [hydrated, setHydrated] = useState(false);
  const [bookmarkedGenIds, setBookmarkedGenIds] = useState<Set<string>>(new Set());
  const [bookmarkedVideoGenIds, setBookmarkedVideoGenIds] = useState<Set<string>>(new Set());
  const [refetchUrlsTrigger, setRefetchUrlsTrigger] = useState(0);
  const [failedMediaUrls, setFailedMediaUrls] = useState<string[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const continuationSlots =
    selectedTool === "video" ? continuationSlotsForDuration(videoOptions.durationSeconds) : 0;

  const TEXTAREA_MIN_LINES_PX = 4.5 * 16; // 3 lines ~4.5rem
  const TEXTAREA_MAX_LINES_PX = Math.round(9.2 * 16); // 7 lines only (~21px/line)

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(
      TEXTAREA_MAX_LINES_PX,
      Math.max(TEXTAREA_MIN_LINES_PX, el.scrollHeight)
    );
    el.style.height = h + "px";
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, [prompt]);

  useEffect(() => {
    const t = setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      0
    );
    return () => clearTimeout(t);
  }, [messages.length, generating]);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (fullCampaignResults?.campaignId != null && fullCampaignLastUserMsgIndexRef.current != null) {
      const idx = fullCampaignLastUserMsgIndexRef.current;
      setCampaignResultsByMsgIndex((prev) => ({ ...prev, [idx]: fullCampaignResults }));
    }
  }, [fullCampaignResults?.campaignId, fullCampaignResults]);

  const pendingPreviewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    const imageFiles = pendingFiles.filter((f) => f.type.startsWith("image/"));
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    pendingPreviewUrlsRef.current.forEach(URL.revokeObjectURL);
    pendingPreviewUrlsRef.current = urls;
    setPendingPreviewUrls(urls);
    return () => {
      pendingPreviewUrlsRef.current.forEach(URL.revokeObjectURL);
      pendingPreviewUrlsRef.current = [];
    };
  }, [pendingFiles]);

  useEffect(() => {
    if (!fullCampaignProductImage) {
      setFullCampaignProductPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(fullCampaignProductImage);
    setFullCampaignProductPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fullCampaignProductImage]);

  useEffect(() => {
    if (chipSendRef.current == null || prompt !== chipSendRef.current) return;
    chipSendRef.current = null;
    handleSend();
  }, [prompt]);

  const fullCampaignVideoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (fullCampaignGeneration.status !== "complete") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setFullCampaignSwipeSlide((s) => Math.max(0, s - 1));
      if (e.key === "ArrowRight") setFullCampaignSwipeSlide((s) => Math.min(2, s + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullCampaignGeneration.status]);

  useEffect(() => {
    let cancelled = false;
    loadedFromDbRef.current = false;
    loadCreativeStudioChatFromSupabase(workspaceId, projectId).then((loaded) => {
      if (cancelled) return;
      loadedFromDbRef.current = loaded.loadedFromDb;
      setSelectedTool(null);
      setImageOptions(loaded.imageOptions);
      if (loaded.imageOptions.adStyle !== "none") {
        queueMicrotask(() => fetchAdStyles());
      }
      setVideoOptions(loaded.videoOptions);
      setEmailOptions({ ...defaultEmailOptions(), ...loaded.emailOptions });
      setPrompt(loaded.prompt);
      setContinuationPrompts(loaded.continuationPrompts);
      setImageSlidePrompts(loaded.imageSlidePrompts);
      const normalizedMessages = loaded.messages.map((m) =>
        m.role === "assistant" && m.generating
          ? { ...m, content: "Generation cancelled.", generating: false }
          : m
      );
      setMessages(normalizedMessages);
      setLikedSnippets(loaded.likedSnippets);
      setDislikedSnippets(loaded.dislikedSnippets);
      setSelectedEmailTemplateId(loaded.selectedEmailTemplateId);

      if (loaded.campaignState) {
        const cs = loaded.campaignState;
        preservedCampaignForSaveRef.current = slimCampaignStateForPersistence(cs);
        const cq = cs.generation.campaignQuality;
        if (cq === "1K" || cq === "4K") setFullCampaignQuality(cq);
        setFullCampaignGeneration({
          status: "complete",
          steps: cs.generation.steps.map((s) => ({ ...s, status: "done" as FullCampaignStepStatus })),
          creditsUsed: cs.generation.creditsUsed,
          brandName: cs.generation.brandName,
          campaignGoal: cs.generation.campaignGoal,
          videoCountdownSeconds: null,
          imageStyleChosen: cs.generation.imageStyleChosen ?? null,
          campaignQuality: cq === "1K" || cq === "4K" ? cq : undefined,
        });
        setFullCampaignResults(cs.results as typeof fullCampaignResults);
        const campaignId = cs.results?.campaignId;
        if (campaignId && workspaceId && projectId) {
          apiClientFetch<{
            asset_urls: { meta_image_urls?: string[]; story_image_urls?: string[]; video_16x9?: string | null; video_9x16?: string | null; email_html?: string | null; email_htmls?: string[] };
            email_copy?: Record<string, string>;
            email_copies?: Record<string, string>[];
          }>(`/workspaces/${workspaceId}/projects/${projectId}/campaign/sessions/${campaignId}`)
            .then((data) => {
              const ctx = hydrationContextRef.current;
              if (!ctx || ctx.workspaceId !== workspaceId || ctx.projectId !== projectId) return;
              const urls = data.asset_urls;
              if (urls) {
                setFullCampaignResults((prev) => ({
                  ...prev,
                  metaImageUrls: urls.meta_image_urls ?? prev?.metaImageUrls,
                  storyImageUrls: urls.story_image_urls ?? prev?.storyImageUrls,
                  videoUrl16x9: urls.video_16x9 ?? prev?.videoUrl16x9,
                  videoUrl9x16: urls.video_9x16 ?? prev?.videoUrl9x16,
                  emailHtml: urls.email_html ?? prev?.emailHtml,
                  emailHtmls: urls.email_htmls ?? prev?.emailHtmls,
                  emailCopy: data.email_copy ?? prev?.emailCopy,
                  emailCopies: data.email_copies ?? prev?.emailCopies,
                }));
              }
            })
            .catch(() => {});
        }
      } else {
        preservedCampaignForSaveRef.current = null;
        setFullCampaignGeneration({
          status: "idle",
          steps: [],
          creditsUsed: 0,
          brandName: "",
          campaignGoal: null,
          videoCountdownSeconds: null,
          imageStyleChosen: null,
        });
        setFullCampaignResults(null);
        setFullCampaignSwipeSlide(0);
        setCampaignResultsByMsgIndex({});
        setSelectedCampaignMsgIndex(null);
        setCurrentCampaignMsgIndex(null);
        fullCampaignLastUserMsgIndexRef.current = null;
      }

      setHydrated(true);

      if (!projectId) return;
      hydrationContextRef.current = { workspaceId, projectId };

      const needImageUrls = loaded.messages.filter(
        (m) => m.role === "assistant" && (m.generationId || (m.generationIds?.length ?? 0) > 0) && m.tool !== "video"
      );
      const needVideoUrls = loaded.messages.filter(
        (m) => m.role === "assistant" && m.generationId && m.tool === "video"
      );

      if (needImageUrls.length > 0) {
        apiClientFetch<{ generations: { id: string; imageUrl: string | null }[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/generations`
        )
          .then(({ generations }) => {
            const ctx = hydrationContextRef.current;
            if (!ctx || ctx.workspaceId !== workspaceId || ctx.projectId !== projectId) return;
            const genMap = new Map((generations ?? []).map((g) => [g.id, g.imageUrl]));
            setMessages((prev) =>
              prev.map((m) => {
                if (m.role !== "assistant" || m.tool === "video" || m.imageUrls?.length) return m;
                const ids = m.generationIds?.length ? m.generationIds : m.generationId ? [m.generationId] : [];
                if (!ids.length) return m;
                const imageUrls = ids.map((id) => genMap.get(id)).filter((u): u is string => u != null && u.length > 0);
                if (!imageUrls.length) return m;
                return { ...m, imageUrls };
              })
            );
          })
          .catch(() => {});
      }

      if (needVideoUrls.length > 0) {
        Promise.all(
          needVideoUrls.map((m) =>
            apiClientFetch<{
              status: string;
              videoUrl?: string | null;
              error?: string;
            }>(
              `/workspaces/${workspaceId}/projects/${projectId}/video-generations/${m.generationId}/status`
            ).then((res) => ({ msg: m, res }))
          )
        ).then((results) => {
          const ctx = hydrationContextRef.current;
          if (!ctx || ctx.workspaceId !== workspaceId || ctx.projectId !== projectId) return;
          let shouldRefresh = false;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.role !== "assistant" || m.tool !== "video" || !m.generationId) return m;
              const r = results.find((x) => x.msg.generationId === m.generationId);
              if (!r) return m;
              const { status, videoUrl, error } = r.res;
              if (status === "completed" && videoUrl) {
                shouldRefresh = true;
                return { ...m, videoUrl, generating: false };
              }
              if (status === "failed") {
                return { ...m, content: error ? `Error: ${error}` : "Video generation failed.", generating: false };
              }
              if (status === "cancelled") {
                return { ...m, content: "Generation cancelled.", generating: false };
              }
              return { ...m, generating: false, content: m.content || "Video was still processing. It may have completed—check Asset Collection or generate again." };
            })
          );
          if (shouldRefresh) router.refresh();
        }).catch(() => {});
      }
    }).catch(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [workspaceId, projectId, router, fetchAdStyles]);

  // Refetch image/video URLs when user returns to tab (signed URLs expire after 1h).
  useEffect(() => {
    if (refetchUrlsTrigger === 0 || !workspaceId || !projectId) return;
    let cancelled = false;
    setFailedMediaUrls([]);
    const needImageUrls = messages.filter(
      (m) => m.role === "assistant" && (m.generationId || (m.generationIds?.length ?? 0) > 0) && m.tool !== "video"
    );
    const needVideoUrls = messages.filter(
      (m) => m.role === "assistant" && m.generationId && m.tool === "video"
    );
    if (needImageUrls.length > 0) {
      apiClientFetch<{ generations: { id: string; imageUrl: string | null }[] }>(
        `/workspaces/${workspaceId}/projects/${projectId}/generations`
      )
        .then(({ generations }) => {
          if (cancelled) return;
          const genMap = new Map((generations ?? []).map((g) => [g.id, g.imageUrl]));
          setMessages((prev) =>
            prev.map((m) => {
              if (m.role !== "assistant" || m.tool === "video") return m;
              const ids = m.generationIds?.length ? m.generationIds : m.generationId ? [m.generationId] : [];
              if (!ids.length) return m;
              const imageUrls = ids.map((id) => genMap.get(id)).filter((u): u is string => u != null && u.length > 0);
              if (!imageUrls.length) return m;
              return { ...m, imageUrls };
            })
          );
        })
        .catch(() => {});
    }
    if (needVideoUrls.length > 0) {
      Promise.all(
        needVideoUrls.map((m) =>
          apiClientFetch<{
            status: string;
            videoUrl?: string | null;
            error?: string;
          }>(
              `/workspaces/${workspaceId}/projects/${projectId}/video-generations/${m.generationId}/status`
            ).then((res) => ({ msg: m, res }))
        )
      ).then((results) => {
        if (cancelled) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.role !== "assistant" || m.tool !== "video" || !m.generationId) return m;
            const r = results.find((x) => x.msg.generationId === m.generationId);
            if (!r) return m;
            const { status, videoUrl } = r.res;
            if (status === "completed" && videoUrl) {
              return { ...m, videoUrl };
            }
            return m;
          })
        );
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [workspaceId, projectId, refetchUrlsTrigger]);

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        workspaceId &&
        projectId &&
        messages.some((m) => m.role === "assistant" && m.generationId)
      ) {
        setRefetchUrlsTrigger((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [workspaceId, projectId, messages]);

  useEffect(() => {
    if (fullCampaignGeneration.status !== "generating") return;
    const tick = 100;
    const id = setInterval(() => {
      setFullCampaignGeneration((prev) => {
        const next = prev.steps.map((s) => {
          if (s.status !== "in_progress") return s;
          const current = s.progress ?? 0;
          if (current >= 94) return s;
          const delta = current < 50 ? 3.5 : 0.75;
          return { ...s, progress: Math.min(94, current + delta) };
        });
        return { ...prev, steps: next };
      });
    }, tick);
    return () => clearInterval(id);
  }, [fullCampaignGeneration.status]);

  useEffect(() => {
    lastCreativeSavePayloadRef.current = "";
    preservedCampaignForSaveRef.current = null;
  }, [workspaceId, projectId]);

  useEffect(() => {
    if (!hydrated) return;
    if (messages.length === 0 && !loadedFromDbRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const campaignState: SavedCampaignState | null =
        fullCampaignGeneration.status === "complete" && fullCampaignResults
          ? {
              generation: {
                status: "complete",
                steps: fullCampaignGeneration.steps.map(({ id, label, subLabel, credits }) => ({ id, label, subLabel, credits })),
                creditsUsed: fullCampaignGeneration.creditsUsed,
                brandName: fullCampaignGeneration.brandName,
                campaignGoal: fullCampaignGeneration.campaignGoal,
                imageStyleChosen: fullCampaignGeneration.imageStyleChosen ?? null,
                campaignQuality:
                  fullCampaignGeneration.campaignQuality ?? fullCampaignQuality,
              },
              results: fullCampaignResults,
            }
          : null;
      if (campaignState != null) {
        preservedCampaignForSaveRef.current = slimCampaignStateForPersistence(campaignState);
      }
      const payload = {
        messages,
        prompt,
        selectedTool,
        imageOptions,
        videoOptions,
        emailOptions,
        continuationPrompts,
        imageSlidePrompts,
        likedSnippets,
        dislikedSnippets,
        selectedEmailTemplateId,
        campaignState,
      };
      const key = JSON.stringify(payload);
      if (key === lastCreativeSavePayloadRef.current) return;
      lastCreativeSavePayloadRef.current = key;
      saveCreativeStudioChatToSupabase(workspaceId, projectId, payload, {
        preservedCampaignWhenNull: preservedCampaignForSaveRef.current,
      });
    }, 1200);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    hydrated,
    workspaceId,
    projectId,
    messages,
    prompt,
    selectedTool,
    imageOptions,
    videoOptions,
    emailOptions,
    continuationPrompts,
    imageSlidePrompts,
    likedSnippets,
    dislikedSnippets,
    selectedEmailTemplateId,
    fullCampaignGeneration,
    fullCampaignResults,
  ]);

  useEffect(() => {
    let cancelled = false;
    apiClientFetch<{
      generationIds: string[];
      videoGenerationIds: string[];
    }>(`/workspaces/${workspaceId}/asset-collection?mode=ids`)
      .then((res) => {
        if (!cancelled) {
          setBookmarkedGenIds(new Set(res.generationIds ?? []));
          setBookmarkedVideoGenIds(new Set(res.videoGenerationIds ?? []));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    if (selectedTool === "image" || optionsOpen) fetchAdStyles();
  }, [selectedTool, optionsOpen, fetchAdStyles]);

  async function downloadImageAsPng(url: string, filename?: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename ?? `blinkify-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // ignore
    }
  }

  async function downloadVideo(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `blinkify-video-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // ignore
    }
  }

  async function handleSaveToCollection(generationId: string) {
    if (!generationId || bookmarkedGenIds.has(generationId)) return;
    try {
      await apiClientFetch<{ id: string }>(
        `/workspaces/${workspaceId}/asset-collection`,
        { method: "POST", body: JSON.stringify({ generationId }) }
      );
      setBookmarkedGenIds((prev) => new Set(prev).add(generationId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Already in collection")) {
        setBookmarkedGenIds((prev) => new Set(prev).add(generationId));
      }
    }
  }

  async function handleSaveVideoToCollection(videoGenerationId: string) {
    if (!videoGenerationId || bookmarkedVideoGenIds.has(videoGenerationId)) return;
    try {
      await apiClientFetch<{ id: string }>(
        `/workspaces/${workspaceId}/asset-collection`,
        { method: "POST", body: JSON.stringify({ videoGenerationId }) }
      );
      setBookmarkedVideoGenIds((prev) => new Set(prev).add(videoGenerationId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Already in collection")) {
        setBookmarkedVideoGenIds((prev) => new Set(prev).add(videoGenerationId));
      }
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (optionsRef.current && !optionsRef.current.contains(target)) setOptionsOpen(false);
      if (toolsRef.current && !toolsRef.current.contains(target)) setToolsOpen(false);
      if (brandPickerRef.current && !brandPickerRef.current.contains(target)) setBrandPickerOpen(false);
      if (plusMenuRef.current && !plusMenuRef.current.contains(target)) setPlusMenuOpen(false);
    }
    if (optionsOpen || toolsOpen || brandPickerOpen || plusMenuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [optionsOpen, toolsOpen, brandPickerOpen, plusMenuOpen]);

  useEffect(() => {
    if (!imagePreviewUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImagePreviewUrl(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [imagePreviewUrl]);


  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files].slice(0, 10));
    e.target.value = "";
  }

  /** When opening Full Campaign with existing pending images, use first as product photo. */
  useEffect(() => {
    if (selectedTool !== "full" || pendingFiles.length === 0) return;
    const first = pendingFiles[0];
    if (!first?.type.startsWith("image/")) return;
    setFullCampaignProductImage(first);
    setPendingFiles([]);
  }, [selectedTool, pendingFiles.length]);

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const setContinuationPromptAt = useCallback((i: number, value: string) => {
    setContinuationPrompts((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push("");
      next[i] = value;
      return next;
    });
  }, []);

  const setImageSlidePromptAt = useCallback((i: number, value: string) => {
    setImageSlidePrompts((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push("");
      next[i] = value;
      return next;
    });
  }, []);

  function getSnippetForMessage(msg: CreativeMessage, idx: number): string {
    const maxLen = 400;
    if (msg.content?.trim()) return msg.content.slice(0, maxLen).trim();
    const prev = messages[idx - 1];
    if (prev?.role === "user" && prev.content)
      return `[Image/Video] ${prev.content.slice(0, maxLen - 20)}`;
    return "Generated response";
  }

  function handleGoodResponse(msgIndex: number) {
    const msg = messages[msgIndex];
    if (msg?.role !== "assistant") return;
    const snippet = getSnippetForMessage(msg, msgIndex);
    const nextLiked = [...likedSnippets, snippet].slice(-PREFERENCE_SNIPPETS_MAX);
    setLikedSnippets(nextLiked);
    saveCreativeStudioChatToSupabase(workspaceId, projectId, { ...stateRef.current, likedSnippets: nextLiked });
    toast.success("Thanks — we'll favor responses like this.");
  }

  function handleBadResponse(msgIndex: number) {
    const msg = messages[msgIndex];
    if (msg?.role !== "assistant") return;
    const snippet = getSnippetForMessage(msg, msgIndex);
    const nextDisliked = [...dislikedSnippets, snippet].slice(-PREFERENCE_SNIPPETS_MAX);
    setDislikedSnippets(nextDisliked);
    saveCreativeStudioChatToSupabase(workspaceId, projectId, { ...stateRef.current, dislikedSnippets: nextDisliked });
    toast.success("Got it — we'll avoid responses like this.");
  }

  function getEmailHtmlFromMessage(msg: CreativeMessage): string | null {
    if (msg.tool !== "email" || !msg.emailPayload) return null;
    const p = msg.emailPayload;
    const brand = msg.emailBrandSnapshot;
    const htmlImageUrls = (msg.signedImageUrls?.length ? msg.signedImageUrls : msg.imageUrls) ?? [];
    const n = Math.min(3, Math.max(1, p.numberOfImages ?? htmlImageUrls.length ?? 1)) as 1 | 2 | 3;
    const ctaUrlRaw =
      p.ctaUrl?.trim() && p.ctaUrl !== "#" ? p.ctaUrl.trim() : brand?.website_url?.trim() || "#";
    return buildStandaloneMarketingEmailHtml({
      subjectLine: p.subjectLine || "",
      headline: p.headline || "",
      introCopy: p.introCopy || "",
      closingCopy: p.closingCopy || "",
      ctaText: p.ctaText || "Shop now",
      ctaUrl: ctaUrlRaw,
      imageUrls: htmlImageUrls,
      numberOfImages: n,
      brandName: (brand?.brand_name || "Your brand").trim() || "Your brand",
      primaryColor: (Array.isArray(brand?.brand_colors) && brand.brand_colors[0]) || "#3b82f6",
      secondaryColor: (Array.isArray(brand?.brand_colors) && brand.brand_colors[1]) || "#f8f8f8",
      websiteUrl: brand?.website_url?.trim() || "#",
      logoUrl: brand?.brand_logo_url?.trim() || null,
      socialLinks: (brand?.social_links && typeof brand.social_links === "object" ? brand.social_links : {}) as Record<string, string>,
      fontFamily: "Arial,Helvetica,sans-serif",
    });
  }

  async function handleCopyResponse(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    const emailHtml = getEmailHtmlFromMessage(msg);
    if (emailHtml) {
      await navigator.clipboard.writeText(emailHtml).catch(() => {});
      toast.success("HTML copied — paste into Mailchimp, Klaviyo, or use Insert HTML extension for Gmail");
      return;
    }
    const text = msg.content?.trim() || (msgIndex > 0 ? messages[msgIndex - 1]?.content : "") || "";
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Copied to clipboard.");
  }

  function handleReplyToMessage(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    setReplyingTo({ messageIndex: msgIndex });
    queueMicrotask(() => textareaRef.current?.focus());
  }

  async function handleRedoResponse(msgIndex: number) {
    const userContent = messages[msgIndex - 1]?.content?.trim();
    if (!userContent || generating) return;
    const placeholder: CreativeMessage = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      tool: null,
      generating: true,
    };
    const next = messages.filter((_, i) => i !== msgIndex);
    next.push(placeholder);
    const placeholderIndex = next.length - 1;
    setMessages(next);
    queueMicrotask(() => flushSave(next));
    setGenerating(true);
    let isVideo = false;
    let isEmail = false;
    try {
      const res = await apiClientFetch<{ content: string; intent?: "image" | "video" | "email" | null }>(
        `/workspaces/${workspaceId}/projects/${projectId}/creative-studio-chat`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: userContent,
            likedSnippets: likedSnippets.length ? likedSnippets : undefined,
            dislikedSnippets: dislikedSnippets.length ? dislikedSnippets : undefined,
          }),
        }
      );
      const intent = res.intent ?? null;
      setMessages((prev) => {
        const n = [...prev];
        const m = n[placeholderIndex];
        if (m && m.role === "assistant") {
          n[placeholderIndex] = { ...m, content: res.content ?? "", tool: intent };
        }
        return n;
      });
      if (intent === "image") setSelectedTool("image");
      if (intent === "video") {
        setSelectedTool("video");
        isVideo = true;
      }
      if (intent === "email") {
        setSelectedTool("email");
        isEmail = true;
      }
      if (intent === "image") {
        const imageFiles = pendingFiles.filter((f) => f.type.startsWith("image/")).slice(0, MAX_INPUT_IMAGES);
        const inputImages =
          imageFiles.length > 0
            ? await Promise.all(
                imageFiles.map(async (f) => ({
                  data: await fileToBase64(f),
                  mimeType: f.type || "image/png",
                }))
              )
            : [];
        const primaryHex = activeProject?.brand_colors?.[0] ?? "#000000";
        const secondaryHex = activeProject?.brand_colors?.[1] ?? "#000000";
        const imagePrompt = buildImagePromptWithAdStyle(userContent, imageOptions, adStylesConfig, primaryHex, secondaryHex);
        const body: Record<string, unknown> = {
          prompt: imagePrompt,
          aspectRatio: imageOptions.aspectRatio,
          imageSize: imageOptions.resolution,
          temperature: imageOptions.temperature,
          numberOfImages: imageOptions.numberOfImages,
        };
        if (inputImages.length > 0) body.inputImages = inputImages;
        if (imageOptions.carousel && imageOptions.numberOfImages >= 2) {
          body.carousel = true;
          body.slidePrompts = Array.from(
            { length: imageOptions.numberOfImages },
            (_, i) => imageSlidePrompts[i]?.trim() ?? ""
          );
        }
        const genRes = await apiClientFetch<{
          generation: { id: string; text_response?: string | null };
          imageUrl: string | null;
          imageUrls?: string[];
          generationIds?: string[];
        }>(`/workspaces/${workspaceId}/projects/${projectId}/generate`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        const urls =
          (genRes.imageUrls?.length ?? 0) > 0
            ? genRes.imageUrls!
            : genRes.imageUrl
              ? [genRes.imageUrl]
              : [];
        const genIds = (genRes.generationIds?.length ?? 0) > 0 ? genRes.generationIds : undefined;
        setMessages((prev) => {
          const n = [...prev];
          const m = n[placeholderIndex];
          if (m && m.role === "assistant") {
            const fromApi = genRes.generation?.text_response?.trim();
            const keepContent = m.content?.trim();
            n[placeholderIndex] = {
              ...m,
              content: keepContent ? keepContent : (fromApi ?? ""),
              imageUrls: urls,
              generationId: genRes.generation?.id,
              ...(genIds && { generationIds: genIds }),
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(n));
          return n;
        });
        const imageIdsToSave = genIds?.length ? genIds : (genRes.generation?.id ? [genRes.generation.id] : []);
        imageIdsToSave.forEach((id) => handleSaveToCollection(id).catch(() => {}));
        router.refresh();
      } else if (intent === "video") {
        if (!videoEnabled) {
          setUpgradeModal({ feature: "video", requiredPlan: "pro" });
          setMessages((prev) => {
            const n = [...prev];
            const m = n[placeholderIndex];
            if (m && m.role === "assistant") {
              n[placeholderIndex] = { ...m, content: "", generating: false };
            }
            queueMicrotask(() => flushSave(n));
            return n;
          });
        } else {
        const body: Record<string, unknown> = {
          prompt: userContent,
          model: videoOptions.model,
          aspectRatio: videoOptions.aspectRatio,
          resolution: videoOptions.resolution,
          durationSeconds: videoOptions.durationSeconds,
          generateAudio: videoOptions.generateAudio,
          negativePrompt: videoOptions.negativePrompt || undefined,
        };
        const genRes = await apiClientFetch<{ generationId: string }>(
          `/workspaces/${workspaceId}/projects/${projectId}/generate-video`,
          { method: "POST", body: JSON.stringify(body) }
        );
        setMessages((prev) => {
          const n = [...prev];
          const m = n[placeholderIndex];
          if (m && m.role === "assistant") {
            n[placeholderIndex] = { ...m, generationId: genRes.generationId };
          }
          return n;
        });
        pollTimeoutRef.current = setTimeout(
          () => pollVideoStatus(genRes.generationId, placeholderIndex),
          POLL_INTERVAL_MS
        );
        }
      } else if (intent === "email") {
        const abortCtrl = new AbortController();
        generationAbortRef.current = abortCtrl;
        const emailRes = await apiClientFetch<{
          generation: { id: string };
          generationIds?: string[];
          imageUrls: string[];
          signedImageUrls?: string[];
          numberOfImages: 1 | 2 | 3;
          subjectLine: string;
          headline: string;
          introCopy: string;
          closingCopy: string;
          ctaText: string;
          ctaUrl: string | null;
          brandSnapshot?: EmailBrandSnapshot;
        }>(`/workspaces/${workspaceId}/projects/${projectId}/generate-email`, {
          method: "POST",
          body: JSON.stringify({
            prompt: userContent,
            aspectRatio: "1:1",
            numberOfImages: 1,
            imageSize: "1K",
          }),
          signal: abortCtrl.signal,
          timeoutMs: 180_000,
        });
        const emailUrls = Array.isArray(emailRes.imageUrls) ? emailRes.imageUrls : [];
        const emailNumImages = emailRes.numberOfImages ?? 1;
        const emailGenIds = Array.isArray(emailRes.generationIds) ? emailRes.generationIds : (emailRes.generation?.id ? [emailRes.generation.id] : []);
        setMessages((prev) => {
          const n = [...prev];
          const m = n[placeholderIndex];
          if (m && m.role === "assistant") {
            n[placeholderIndex] = {
              ...m,
              content: "",
              emailPayload: {
                subjectLine: emailRes.subjectLine,
                headline: emailRes.headline,
                introCopy: emailRes.introCopy,
                closingCopy: emailRes.closingCopy,
                ctaText: emailRes.ctaText,
                ctaUrl: emailRes.ctaUrl,
                numberOfImages: emailNumImages,
              },
              imageUrls: emailUrls,
              signedImageUrls: Array.isArray(emailRes.signedImageUrls) ? emailRes.signedImageUrls : undefined,
              emailBrandSnapshot: emailRes.brandSnapshot,
              generationId: emailRes.generation?.id,
              generationIds: emailGenIds.length ? emailGenIds : undefined,
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(n));
          return n;
        });
        const emailImageIdsToSave = emailGenIds.length ? emailGenIds : (emailRes.generation?.id ? [emailRes.generation.id] : []);
        emailImageIdsToSave.forEach((id) => handleSaveToCollection(id).catch(() => {}));
        setGenerating(false);
        router.refresh();
      } else {
        setMessages((prev) => {
          const n = [...prev];
          const m = n[placeholderIndex];
          if (m && m.role === "assistant") {
            n[placeholderIndex] = { ...m, generating: false };
          }
          return n;
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Request failed";
      const wasCancelled = errMsg === "Generation cancelled.";
      const displayMsg = wasCancelled
        ? "Generation cancelled."
        : errMsg.includes("Please select") || errMsg.includes("try again")
          ? errMsg
          : `Error: ${errMsg}`;
      setMessages((prev) => {
        const n = [...prev];
        const m = n[placeholderIndex];
        if (m && m.role === "assistant") {
          n[placeholderIndex] = { ...m, content: displayMsg, generating: false };
        }
        return n;
      });
      if (isEmail) setGenerating(false);
    } finally {
      generationAbortRef.current = null;
      if (!isVideo && !isEmail) setGenerating(false);
    }
  }

  useEffect(() => {
    if (selectedTool === "image" && imageOptions.carousel && imageOptions.numberOfImages >= 2) {
      setImageSlidePrompts((prev) => {
        const n = imageOptions.numberOfImages;
        const next = [...prev];
        while (next.length < n) next.push("");
        return next.slice(0, n);
      });
    }
  }, [selectedTool, imageOptions.carousel, imageOptions.numberOfImages]);

  const flushSave = useCallback(
    (nextMessages: CreativeMessage[]) => {
      saveCreativeStudioChatToSupabase(workspaceId, projectId, {
        ...stateRef.current,
        messages: nextMessages,
      });
    },
    [workspaceId, projectId]
  );

  const cancelGeneration = useCallback(
    (msgIndex?: number) => {
      if (generationAbortRef.current) {
        generationAbortRef.current.abort();
        generationAbortRef.current = null;
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      setMessages((prev) => {
        const next = prev.map((m, i) => {
          if (m.role !== "assistant" || !m.generating || (msgIndex !== undefined && i !== msgIndex))
            return m;
          const hasFinalOutput =
            (m.tool === "image" && (m.imageUrls?.length ?? 0) > 0) ||
            (m.tool === "video" && !!m.videoUrl) ||
            (m.tool === "email" && !!m.emailPayload);
          if (hasFinalOutput) return m;
          if (m.tool === "video" && m.generationId) {
            apiClientFetch(
              `/workspaces/${workspaceId}/projects/${projectId}/video-generations/${m.generationId}/cancel`,
              { method: "PATCH" }
            ).catch(() => {});
          }
          return { ...m, content: "Generation cancelled.", generating: false };
        });
        queueMicrotask(() => flushSave(next));
        return next;
      });
      setGenerating(false);
    },
    [flushSave, workspaceId, projectId]
  );

  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
      if (generating) cancelGeneration();
    }
  }, [pathname, generating, cancelGeneration]);

  const pollVideoStatus = useCallback(
    async (generationId: string, msgIndex: number) => {
      try {
        const res = await apiClientFetch<{
          status: string;
          videoUrl?: string | null;
          progress?: number;
          error?: string;
        }>(
          `/workspaces/${workspaceId}/projects/${projectId}/video-generations/${generationId}/status`
        );

        if (res.status === "completed") {
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              next[msgIndex] = {
                ...m,
                videoUrl: res.videoUrl ?? null,
                generating: false,
                content: "Generation complete.",
              };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          setGenerating(false);
          handleSaveVideoToCollection(generationId).catch(() => {});
          router.refresh();
          return;
        }

        if (res.status === "failed") {
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              next[msgIndex] = {
                ...m,
                content: `Error: ${res.error ?? "Generation failed"}`,
                generating: false,
              };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          setGenerating(false);
          return;
        }

        if (res.status === "cancelled") {
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              next[msgIndex] = { ...m, content: "Generation cancelled.", generating: false };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          setGenerating(false);
          return;
        }

        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = { ...m, progress: res.progress ?? 50 };
          }
          return next;
        });

        pollTimeoutRef.current = setTimeout(
          () => pollVideoStatus(generationId, msgIndex),
          POLL_INTERVAL_MS
        );
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = {
              ...m,
              content: `Error: ${err instanceof Error ? err.message : "Poll failed"}`,
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(next));
          return next;
        });
        setGenerating(false);
      }
    },
    [workspaceId, projectId, flushSave, router]
  );

  async function handleSend() {
    const text = prompt.trim();
    if (!text || generating) return;

    const hasCreateTool = selectedTool === "image" || selectedTool === "video" || selectedTool === "email" || selectedTool === "full";
    if (hasCreateTool === false) {
      // Reply context: capture and clear so chip disappears
      const replyToMessage =
        replyingTo != null ? messages[replyingTo.messageIndex] : undefined;
      const isVideoResponse = replyToMessage?.tool === "video" || !!replyToMessage?.videoUrl;
      const isImageResponse = (replyToMessage?.imageUrls?.length ?? 0) > 0;
      const originalPrompt =
        replyingTo != null && replyingTo.messageIndex > 0
          ? messages[replyingTo.messageIndex - 1]?.content?.trim()
          : undefined;
      const replyTo =
        replyToMessage && replyToMessage.role === "assistant"
          ? {
              assistantContent: replyToMessage.content?.trim() || (isVideoResponse ? "(video response)" : isImageResponse ? "(image response)" : ""),
              hasImage: isImageResponse,
              hasVideo: isVideoResponse,
              originalPrompt: isVideoResponse && originalPrompt ? originalPrompt : undefined,
            }
          : undefined;
      setReplyingTo(null);

      const imageFiles = pendingFiles.filter((f) => f.type.startsWith("image/")).slice(0, MAX_INPUT_IMAGES);
      const attachedUrls = imageFiles.length > 0 ? await Promise.all(imageFiles.map(fileToDataUrl)) : [];
      const attachedImagesForApi =
        imageFiles.length > 0
          ? await Promise.all(
              imageFiles.map(async (f) => ({
                data: await fileToBase64(f),
                mimeType: f.type || "image/png",
              }))
            )
          : [];

      const userMsg: CreativeMessage = {
        role: "user",
        content: text,
        timestamp: Date.now(),
        tool: null,
        ...(attachedUrls.length > 0 && { attachedImageUrls: attachedUrls }),
        ...(isFullCampaignSendRef.current && { fullCampaignRequest: true }),
      };
      if (isFullCampaignSendRef.current) {
        fullCampaignLastUserMsgIndexRef.current = messages.length;
        setCurrentCampaignMsgIndex(messages.length);
        setSelectedCampaignMsgIndex(null);
        isFullCampaignSendRef.current = false;
      }
      const placeholderAssistant: CreativeMessage = {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        tool: null,
        generating: true,
      };
      setMessages((prev) => {
        const next = [...prev, userMsg, placeholderAssistant];
        queueMicrotask(() => flushSave(next));
        return next;
      });
      setPrompt("");
      setPendingFiles([]);
      setGenerating(true);
      const msgIndex = messages.length + 1;
      let detectedIntent: "image" | "video" | "email" | null = null;
      try {
        const res = await apiClientFetch<{ content: string; intent?: "image" | "video" | "email" | null }>(
          `/workspaces/${workspaceId}/projects/${projectId}/creative-studio-chat`,
          {
            method: "POST",
            body: JSON.stringify({
              prompt: text,
              likedSnippets: likedSnippets.length ? likedSnippets : undefined,
              dislikedSnippets: dislikedSnippets.length ? dislikedSnippets : undefined,
              replyTo,
              ...(attachedImagesForApi.length > 0 && { attachedImages: attachedImagesForApi }),
            }),
          }
        );
        const intent = res.intent ?? null;
        // When replying to an image, treat as image edit so user doesn't need to select tool
        const doImageEdit =
          intent === "image" ||
          (replyTo?.hasImage && replyToMessage?.generationId);
        detectedIntent = intent;

        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = {
              ...m,
              content: res.content ?? "",
              tool: doImageEdit ? "image" : intent ?? null,
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(next));
          return next;
        });
        if (doImageEdit) setSelectedTool("image");
        else if (intent === "video") setSelectedTool("video");
        else if (intent === "email") setSelectedTool("email");

        if (doImageEdit) {
          const imageFiles = pendingFiles
            .filter((f) => f.type.startsWith("image/"))
            .slice(0, MAX_INPUT_IMAGES);
          const inputImages =
            imageFiles.length > 0
              ? await Promise.all(
                  imageFiles.map(async (f) => ({
                    data: await fileToBase64(f),
                    mimeType: f.type || "image/png",
                  }))
                )
              : [];
          const isReplyToImage = replyTo?.hasImage && replyToMessage?.generationId;
          const primaryHex = activeProject?.brand_colors?.[0] ?? "#000000";
          const secondaryHex = activeProject?.brand_colors?.[1] ?? "#000000";
          const imagePrompt = buildImagePromptWithAdStyle(text, imageOptions, adStylesConfig, primaryHex, secondaryHex);
          const body: Record<string, unknown> = {
            prompt: imagePrompt,
            aspectRatio: imageOptions.aspectRatio,
            imageSize: imageOptions.resolution,
            temperature: imageOptions.temperature,
            numberOfImages: isReplyToImage ? 1 : imageOptions.numberOfImages,
          };
          if (inputImages.length > 0) body.inputImages = inputImages;
          if (isReplyToImage) body.editFromGenerationId = replyToMessage.generationId;
          if (
            !isReplyToImage &&
            imageOptions.carousel &&
            imageOptions.numberOfImages >= 2
          ) {
            body.carousel = true;
            body.slidePrompts = Array.from(
              { length: imageOptions.numberOfImages },
              (_, i) => imageSlidePrompts[i]?.trim() ?? ""
            );
          }
          const genRes = await apiClientFetch<{
            generation: { id: string; text_response?: string | null };
            imageUrl: string | null;
            imageUrls?: string[];
            generationIds?: string[];
          }>(`/workspaces/${workspaceId}/projects/${projectId}/generate`, {
            method: "POST",
            body: JSON.stringify(body),
          });
          const urls =
            (genRes.imageUrls?.length ?? 0) > 0
              ? genRes.imageUrls!
              : genRes.imageUrl
                ? [genRes.imageUrl]
                : [];
          const genIds = (genRes.generationIds?.length ?? 0) > 0 ? genRes.generationIds : undefined;
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              const fromApi = genRes.generation?.text_response?.trim();
              const keepContent = m.content?.trim();
              next[msgIndex] = {
                ...m,
                content: keepContent ? keepContent : (fromApi ?? ""),
                imageUrls: urls,
                generationId: genRes.generation?.id,
                ...(genIds && { generationIds: genIds }),
                generating: false,
              };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          const replyImageIdsToSave = genIds?.length ? genIds : (genRes.generation?.id ? [genRes.generation.id] : []);
          replyImageIdsToSave.forEach((id) => handleSaveToCollection(id).catch(() => {}));
          setPendingFiles([]);
        } else if (intent === "video") {
          if (!videoEnabled) {
            setUpgradeModal({ feature: "video", requiredPlan: "pro" });
            setMessages((prev) => {
              const next = [...prev];
              const m = next[msgIndex];
              if (m && m.role === "assistant") {
                next[msgIndex] = { ...m, content: "", generating: false };
              }
              queueMicrotask(() => flushSave(next));
              return next;
            });
          } else {
          const body: Record<string, unknown> = {
            prompt: text,
            model: videoOptions.model,
            aspectRatio: videoOptions.aspectRatio,
            resolution: videoOptions.resolution,
            durationSeconds: videoOptions.durationSeconds,
            generateAudio: videoOptions.generateAudio,
            negativePrompt: videoOptions.negativePrompt || undefined,
          };
          const genRes = await apiClientFetch<{ generationId: string }>(
            `/workspaces/${workspaceId}/projects/${projectId}/generate-video`,
            { method: "POST", body: JSON.stringify(body) }
          );
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              next[msgIndex] = { ...m, generationId: genRes.generationId };
            }
            return next;
          });
          pollTimeoutRef.current = setTimeout(
            () => pollVideoStatus(genRes.generationId, msgIndex),
            POLL_INTERVAL_MS
          );
          }
        } else if (intent === "email") {
          const abortCtrl = new AbortController();
          generationAbortRef.current = abortCtrl;
          const emailRes = await apiClientFetch<{
            generation: { id: string };
            generationIds?: string[];
            imageUrls: string[];
            signedImageUrls?: string[];
            numberOfImages: 1 | 2 | 3;
            subjectLine: string;
            headline: string;
            introCopy: string;
            closingCopy: string;
            ctaText: string;
            ctaUrl: string | null;
            brandSnapshot?: EmailBrandSnapshot;
          }>(`/workspaces/${workspaceId}/projects/${projectId}/generate-email`, {
            method: "POST",
            body: JSON.stringify({
              prompt: text,
              aspectRatio: "1:1",
              numberOfImages: 1,
              imageSize: "1K",
            }),
            signal: abortCtrl.signal,
            timeoutMs: 180_000,
          });
          const emailUrls = Array.isArray(emailRes.imageUrls) ? emailRes.imageUrls : [];
          const emailNumImages = emailRes.numberOfImages ?? 1;
          const emailGenIds = Array.isArray(emailRes.generationIds) ? emailRes.generationIds : (emailRes.generation?.id ? [emailRes.generation.id] : []);
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              next[msgIndex] = {
                ...m,
                content: "",
                emailPayload: {
                  subjectLine: emailRes.subjectLine,
                  headline: emailRes.headline,
                  introCopy: emailRes.introCopy,
                  closingCopy: emailRes.closingCopy,
                  ctaText: emailRes.ctaText,
                  ctaUrl: emailRes.ctaUrl,
                  numberOfImages: emailNumImages,
                },
                imageUrls: emailUrls,
                signedImageUrls: Array.isArray(emailRes.signedImageUrls) ? emailRes.signedImageUrls : undefined,
                emailBrandSnapshot: emailRes.brandSnapshot,
                generationId: emailRes.generation?.id,
                generationIds: emailGenIds.length ? emailGenIds : undefined,
                generating: false,
              };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          const replyEmailIdsToSave = emailGenIds.length ? emailGenIds : (emailRes.generation?.id ? [emailRes.generation.id] : []);
          replyEmailIdsToSave.forEach((id) => handleSaveToCollection(id).catch(() => {}));
        } else {
          setMessages((prev) => {
            const next = [...prev];
            const m = next[msgIndex];
            if (m && m.role === "assistant") {
              next[msgIndex] = { ...m, generating: false };
            }
            return next;
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Request failed";
        const wasCancelled = errMsg === "Generation cancelled.";
        const displayMsg = wasCancelled
          ? "Generation cancelled."
          : errMsg.includes("Please select") || errMsg.includes("try again")
            ? errMsg
            : `Error: ${errMsg}`;
        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = { ...m, content: displayMsg, generating: false };
          }
          return next;
        });
      } finally {
        generationAbortRef.current = null;
        if (detectedIntent !== "video") setGenerating(false);
      }
      return;
    }

    const isImage = selectedTool === "image";
    const isImageCarousel =
      isImage && imageOptions.carousel && imageOptions.numberOfImages >= 2;
    const imageCarouselValid =
      !isImageCarousel ||
      imageSlidePrompts.slice(0, imageOptions.numberOfImages).every((p) => p.trim().length > 0);
    if (isImageCarousel && !imageCarouselValid) return;

    const isVideo = selectedTool === "video";
    const videoNeedsSegments =
      isVideo && continuationSlots > 0;
    const segmentPromptsValid =
      !videoNeedsSegments ||
      continuationPrompts.slice(0, continuationSlots).every((p) => p.trim().length > 0);
    if (videoNeedsSegments && !segmentPromptsValid) return;

    const imageFiles = pendingFiles.filter((f) => f.type.startsWith("image/")).slice(0, MAX_INPUT_IMAGES);
    const attachedUrls = imageFiles.length > 0 ? await Promise.all(imageFiles.map(fileToDataUrl)) : [];

    const userMsg: CreativeMessage = {
      role: "user",
      content: text,
      timestamp: Date.now(),
      tool: selectedTool,
      ...(attachedUrls.length > 0 && { attachedImageUrls: attachedUrls }),
    };
    const placeholderAssistant: CreativeMessage = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      tool: selectedTool,
      generating: true,
      ...(selectedTool === "image" && {
        studioMeta: { aspectRatio: imageOptions.aspectRatio, imageCount: imageOptions.numberOfImages },
      }),
      ...(selectedTool === "video" && {
        studioMeta: { videoAspect: videoOptions.aspectRatio },
      }),
    };
    setMessages((prev) => {
      const next = [...prev, userMsg, placeholderAssistant];
      queueMicrotask(() => flushSave(next));
      return next;
    });
    setPrompt("");
    setPendingFiles([]);
    setGenerating(true);
    const msgIndex = messages.length + 1;
    const abortCtrl = new AbortController();
    generationAbortRef.current = abortCtrl;

    try {
      if (selectedTool === "image") {
        const imageFiles = pendingFiles
          .filter((f) => f.type.startsWith("image/"))
          .slice(0, MAX_INPUT_IMAGES);
        const inputImages =
          imageFiles.length > 0
            ? await Promise.all(
                imageFiles.map(async (f) => ({
                  data: await fileToBase64(f),
                  mimeType: f.type || "image/png",
                }))
              )
            : [];
        const primaryHex = activeProject?.brand_colors?.[0] ?? "#000000";
        const secondaryHex = activeProject?.brand_colors?.[1] ?? "#000000";
        const imagePrompt = buildImagePromptWithAdStyle(text, imageOptions, adStylesConfig, primaryHex, secondaryHex);
        const body: Record<string, unknown> = {
          prompt: imagePrompt,
          aspectRatio: imageOptions.aspectRatio,
          imageSize: imageOptions.resolution,
          temperature: imageOptions.temperature,
          numberOfImages: imageOptions.numberOfImages,
        };
        if (inputImages.length > 0) body.inputImages = inputImages;
        if (imageOptions.carousel && imageOptions.numberOfImages >= 2) {
          body.carousel = true;
          body.slidePrompts = Array.from(
            { length: imageOptions.numberOfImages },
            (_, i) => imageSlidePrompts[i]?.trim() ?? ""
          );
        }

        const res = await apiClientFetch<{
          generation: { id: string; text_response?: string | null };
          imageUrl: string | null;
          imageUrls?: string[];
          generationIds?: string[];
        }>(`/workspaces/${workspaceId}/projects/${projectId}/generate`, {
          method: "POST",
          body: JSON.stringify(body),
          signal: abortCtrl.signal,
        });

        const urls =
          (res.imageUrls?.length ?? 0) > 0
            ? res.imageUrls!
            : res.imageUrl
              ? [res.imageUrl]
              : [];
        const genIds = (res.generationIds?.length ?? 0) > 0 ? res.generationIds : undefined;

        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            const fromApi = res.generation?.text_response?.trim();
            const keepContent = m.content?.trim();
            next[msgIndex] = {
              ...m,
              content: "Generation complete.",
              imageUrls: urls,
              generationId: res.generation?.id,
              ...(genIds && { generationIds: genIds }),
              generating: false,
              studioMeta: {
                ...m.studioMeta,
                aspectRatio: imageOptions.aspectRatio,
                imageCount: urls.length,
              },
            };
          }
          queueMicrotask(() => flushSave(next));
          return next;
        });
        const regenImageIdsToSave = genIds?.length ? genIds : (res.generation?.id ? [res.generation.id] : []);
        regenImageIdsToSave.forEach((id) => handleSaveToCollection(id).catch(() => {}));
        setPendingFiles([]);
        router.refresh();
      } else if (selectedTool === "video") {
        const continuationForApi = continuationPrompts
          .slice(0, continuationSlots)
          .map((p) => p.trim())
          .filter(Boolean);

        const body: Record<string, unknown> = {
          prompt: text,
          model: videoOptions.model,
          aspectRatio: videoOptions.aspectRatio,
          resolution: videoOptions.resolution,
          durationSeconds: videoOptions.durationSeconds,
          generateAudio: videoOptions.generateAudio,
          negativePrompt: videoOptions.negativePrompt || undefined,
        };
        if (continuationForApi.length > 0) {
          body.continuationPrompts = continuationForApi;
        }

        const res = await apiClientFetch<{ generationId: string }>(
          `/workspaces/${workspaceId}/projects/${projectId}/generate-video`,
          { method: "POST", body: JSON.stringify(body) }
        );

        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = { ...m, generationId: res.generationId };
          }
          return next;
        });

        pollTimeoutRef.current = setTimeout(
          () => pollVideoStatus(res.generationId, msgIndex),
          POLL_INTERVAL_MS
        );
        return;
      } else if (selectedTool === "email") {
        const res = await apiClientFetch<{
          generation: { id: string };
          generationIds?: string[];
          imageUrls: string[];
          signedImageUrls?: string[];
          numberOfImages: 1 | 2 | 3;
          subjectLine: string;
          headline: string;
          introCopy: string;
          closingCopy: string;
          ctaText: string;
          ctaUrl: string | null;
          brandSnapshot?: EmailBrandSnapshot;
        }>(`/workspaces/${workspaceId}/projects/${projectId}/generate-email`, {
          method: "POST",
          body: JSON.stringify({
            prompt: text,
            aspectRatio: "1:1",
            numberOfImages: emailOptions.numberOfImages,
            imageSize: emailOptions.imageQuality,
            ...(selectedEmailTemplateId && { templateId: selectedEmailTemplateId }),
          }),
          signal: abortCtrl.signal,
          timeoutMs: 180_000,
        });

        const urls = Array.isArray(res.imageUrls) ? res.imageUrls : [];
        const numImages = res.numberOfImages ?? 1;
        const genIds = Array.isArray(res.generationIds) ? res.generationIds : (res.generation?.id ? [res.generation.id] : []);
        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = {
              ...m,
              content: "Generation complete.",
              emailPayload: {
                subjectLine: res.subjectLine,
                headline: res.headline,
                introCopy: res.introCopy,
                closingCopy: res.closingCopy,
                ctaText: res.ctaText,
                ctaUrl: res.ctaUrl,
                numberOfImages: numImages,
              },
              imageUrls: urls,
              signedImageUrls: Array.isArray(res.signedImageUrls) ? res.signedImageUrls : undefined,
              emailBrandSnapshot: res.brandSnapshot,
              generationId: res.generation?.id,
              generationIds: genIds.length ? genIds : undefined,
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(next));
          return next;
        });
        const regenEmailIdsToSave = genIds.length ? genIds : (res.generation?.id ? [res.generation.id] : []);
        regenEmailIdsToSave.forEach((id) => handleSaveToCollection(id).catch(() => {}));
        router.refresh();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Request failed";
      const wasCancelled = errMsg === "Generation cancelled.";
      setMessages((prev) => {
        const next = [...prev];
        const m = next[msgIndex];
        if (m && m.role === "assistant" && m.generating) {
          next[msgIndex] = {
            ...m,
            content: wasCancelled ? "Generation cancelled." : `Error: ${errMsg}`,
            generating: false,
          };
        }
        return next;
      });
    } finally {
      generationAbortRef.current = null;
      if (selectedTool === "image" || selectedTool === "email") setGenerating(false);
    }
  }

  const imageCarouselValid =
    selectedTool !== "image" ||
    !imageOptions.carousel ||
    imageOptions.numberOfImages < 2 ||
    imageSlidePrompts.slice(0, imageOptions.numberOfImages).every((p) => p.trim().length > 0);
  const hasCreateTool = selectedTool === "image" || selectedTool === "video" || selectedTool === "email" || selectedTool === "full";
  const generationCost =
    selectedTool === "image"
      ? imageCreditCost(imageOptions.resolution) *
        (imageOptions.carousel && imageOptions.numberOfImages >= 2 ? imageOptions.numberOfImages : 1)
      : selectedTool === "video"
        ? videoCreditCost(videoOptions.resolution)
        : selectedTool === "email"
          ? emailCreditCost(emailOptions.imageQuality, emailOptions.numberOfImages)
          : selectedTool === "full"
            ? fullCampaignBudgetCredits(fullCampaignQuality)
            : 0;
  const fullCampaignFormValid =
    fullCampaignProductImage != null &&
    fullCampaignGoal != null;
  const canSend =
    selectedTool === "full"
      ? fullCampaignFormValid
      : prompt.trim().length > 0 &&
        (hasCreateTool
          ? (selectedTool === "email"
              ? true
              : imageCarouselValid &&
                (selectedTool !== "video" ||
                  continuationSlots === 0 ||
                  continuationPrompts.slice(0, continuationSlots).every((p) => p.trim().length > 0)))
          : true);

  const hasMessages = messages.length > 0;

  /* ─── Options panel content by tool ──────────────────────────────────── */

  const imageOptionsPanel = (
    <div className="flex flex-col gap-4 p-2">
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Format</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IMAGE_ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setImageOptions((o) => ({ ...o, aspectRatio: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                imageOptions.aspectRatio === r.value
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Ad Style</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "none" as const, name: "None / Custom" },
            { id: "luxury_editorial" as const, name: "Luxury Editorial" },
            { id: "element_explosion" as const, name: "Element Explosion" },
            { id: "product_in_action" as const, name: "Product In Action" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setImageOptions((o) => ({ ...o, adStyle: s.id }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                imageOptions.adStyle === s.id
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Quality</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IMAGE_RESOLUTIONS.map((r) => (
            <div key={r.value} className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setImageOptions((o) => ({ ...o, resolution: r.value }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer w-full text-left",
                  imageOptions.resolution === r.value
                    ? "bg-primary text-white"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
              {r.note && imageOptions.resolution === r.value && (
                <p className="text-[10px] text-muted-foreground px-0.5">{r.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <SlidersHorizontal className="size-3.5" />
          <span className="text-xs font-medium">Creativity</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground shrink-0">Consistent</span>
            <input
              type="range"
              min={TEMPERATURE_MIN}
              max={TEMPERATURE_MAX}
              step={0.1}
              value={imageOptions.temperature}
              onChange={(e) =>
                setImageOptions((o) => ({
                  ...o,
                  temperature: parseFloat(e.target.value) || TEMPERATURE_DEFAULT,
                }))
              }
              className="flex-1 h-2 rounded-full appearance-none bg-secondary/60 cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">Creative</span>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {imageOptions.temperature.toFixed(1)}
          </p>
        </div>
      </div>
      <div>
        <span className="text-xs font-medium mb-2 block">How many versions?</span>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() =>
                setImageOptions((o) => ({
                  ...o,
                  numberOfImages: n,
                  ...(n === 1 && { carousel: false }),
                }))
              }
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                imageOptions.numberOfImages === n
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const videoOptionsPanel = (
    <div className="flex flex-col gap-4 p-2">
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Model</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VIDEO_MODELS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setVideoOptions((o) => ({ ...o, model: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                videoOptions.model === r.value
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Format</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VIDEO_ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setVideoOptions((o) => ({ ...o, aspectRatio: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                videoOptions.aspectRatio === r.value
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Quality</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VIDEO_RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setVideoOptions((o) => ({ ...o, resolution: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                videoOptions.resolution === r.value
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const emailOptionsPanel = (
    <div className="flex flex-col gap-4 p-2">
      <div>
        <span className="text-xs font-medium block mb-2">Creative variations</span>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_NUMBER_OF_IMAGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setEmailOptions((o) => ({ ...o, numberOfImages: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                emailOptions.numberOfImages === r.value
                  ? "bg-primary text-white"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Monitor className="size-3.5" />
          <span className="text-xs font-medium">Quality</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_IMAGE_QUALITIES.map((r) => (
            <div key={r.value} className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setEmailOptions((o) => ({ ...o, imageQuality: r.value }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer w-full text-left",
                  emailOptions.imageQuality === r.value
                    ? "bg-primary text-white"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
              {r.note && emailOptions.imageQuality === r.value && (
                <p className="text-[10px] text-muted-foreground px-0.5">{r.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const optionsPanelContent =
    selectedTool === "image"
      ? imageOptionsPanel
      : selectedTool === "video"
        ? videoOptionsPanel
        : selectedTool === "email"
          ? emailOptionsPanel
          : selectedTool === "full"
            ? (
                <div className="flex flex-col gap-4 p-3 text-[#000000] dark:text-white">
                  <div>
                    <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-[#888]">
                      Campaign goal
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {FULL_CAMPAIGN_GOALS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setFullCampaignGoal(fullCampaignGoal === g ? null : g)}
                          className={cn(
                            "cursor-pointer h-[30px] shrink-0 rounded-full border-[1.5px] px-3 text-xs transition-colors",
                            fullCampaignGoal === g
                              ? "border-[#007aff] bg-[#007aff] font-semibold text-[#ffffff]"
                              : "border-[#e5e7eb] bg-white text-[#555] hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-[#888]">
                      Creative style
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "auto", name: "Auto (Claude decides)" },
                        { id: "Luxury Editorial", name: "Luxury Editorial" },
                        { id: "Element Explosion", name: "Element Explosion" },
                        { id: "Product In Action", name: "Product In Action" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setFullCampaignPreferredStyle(s.id)}
                          className={cn(
                            "cursor-pointer h-[30px] shrink-0 rounded-full border-[1.5px] px-3 text-xs transition-colors",
                            fullCampaignPreferredStyle === s.id
                              ? "border-[#007aff] bg-[#007aff] font-semibold text-[#ffffff]"
                              : "border-[#e5e7eb] bg-white text-[#555] hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-[#888]">
                      Output quality
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "1K" as const, name: "Standard (1K)" },
                          { id: "4K" as const, name: "Ultra (4K)" },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={fullCampaignGeneration.status === "generating"}
                          onClick={() => setFullCampaignQuality(s.id)}
                          className={cn(
                            "cursor-pointer h-[30px] shrink-0 rounded-full border-[1.5px] px-3 text-xs transition-colors disabled:opacity-50",
                            fullCampaignQuality === s.id
                              ? "border-[#007aff] bg-[#007aff] font-semibold text-[#ffffff]"
                              : "border-[#e5e7eb] bg-white text-[#555] hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Select a tool to see options.
              </div>
            );

  function handleResetChat() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setMessages([]);
    setPrompt("");
    setSelectedTool(null);
    setContinuationPrompts([]);
    setImageSlidePrompts([]);
    setImageOptions(defaultImageOptions());
    setVideoOptions(defaultVideoOptions());
    setEmailOptions(defaultEmailOptions());
    setLikedSnippets([]);
    setDislikedSnippets([]);
    setSelectedEmailTemplateId(null);
    setReplyingTo(null);
    setFullCampaignGeneration({ status: "idle", steps: [], creditsUsed: 0, brandName: "", campaignGoal: null, videoCountdownSeconds: null, imageStyleChosen: null });
    setFullCampaignResults(null);
    setFullCampaignSwipeSlide(0);
    setCampaignResultsByMsgIndex({});
    setSelectedCampaignMsgIndex(null);
    setCurrentCampaignMsgIndex(null);
    fullCampaignLastUserMsgIndexRef.current = null;
    const clearedState = {
      messages: [],
      prompt: "",
      selectedTool: null as CreativeTool,
      imageOptions: defaultImageOptions(),
      videoOptions: defaultVideoOptions(),
      emailOptions: defaultEmailOptions(),
      continuationPrompts: [] as string[],
      imageSlidePrompts: [] as string[],
      likedSnippets: [] as string[],
      dislikedSnippets: [] as string[],
      selectedEmailTemplateId: null as EmailTemplateId | null,
      campaignState: null,
    };
    preservedCampaignForSaveRef.current = null;
    saveCreativeStudioChatToSupabase(workspaceId, projectId, clearedState, {
      mergePreservedCampaign: false,
    });
  }

  async function handleFullCampaignGenerate() {
    const hasProduct = fullCampaignProductImage != null;
    const hasGoal = fullCampaignGoal != null;
    if (!hasProduct || !hasGoal) {
      setFullCampaignShake(true);
      setTimeout(() => setFullCampaignShake(false), 400);
      return;
    }

    if (!fullCampaignEnabled) {
      setUpgradeModal({ feature: "full_campaign", requiredPlan: "pro" });
      return;
    }

    const brandName = activeProject?.name ?? "";
    if (!brandName) {
      toast.error("Your brand profile is incomplete. Add your brand name to continue.");
      return;
    }

    const campaignGoal = fullCampaignGoal!;
    const platformsCopy = ["Meta feed", "Stories / Reels", "Email"];
    const productImage = fullCampaignProductImage;
    const productDesc = fullCampaignProductDescription.trim();

    setFullCampaignProductImage(null);
    setFullCampaignGoal(null);

    const campaignUserMsg: CreativeMessage = {
      role: "user",
      content: `Full campaign: ${campaignGoal} for ${brandName} on ${platformsCopy.join(", ")}`,
      timestamp: Date.now(),
      fullCampaignRequest: true,
    };
    setMessages((prev) => [...prev, campaignUserMsg]);

    const qc = fullCampaignQuality;
    setFullCampaignGeneration({
      status: "generating",
      steps: buildFullCampaignSteps(qc).map((s) => ({
        ...s,
        status: "pending" as FullCampaignStepStatus,
      })),
      imageStyleChosen: null,
      creditsUsed: 0,
      brandName,
      campaignGoal,
      videoCountdownSeconds: null,
      generationUnavailableRetryable: false,
      campaignQuality: qc,
    });
    setFullCampaignResults(null);
    setFullCampaignSwipeSlide(0);
    setSelectedTool(null);

    let productImageBase64: string | undefined;
    let productImageMimeType: string | undefined;
    if (productImage) {
      try {
        const buf = await productImage.arrayBuffer();
        productImageBase64 = btoa(
          new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
        );
        productImageMimeType = productImage.type === "image/webp" ? "image/jpeg" : productImage.type || "image/jpeg";
      } catch {
        toast.error("Failed to read product image");
      }
    }

    let accessToken: string | undefined;
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      accessToken = session?.access_token;
    } catch {
      toast.error("Could not reach the sign-in service. Check your network.");
      setFullCampaignGeneration((prev) => ({ ...prev, status: "idle", steps: [] }));
      return;
    }

    try {
      const response = await fetch(
        browserApiUrl(`/workspaces/${workspaceId}/projects/${projectId}/campaign/generate`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({
            productDescription: productDesc || undefined,
            productImage: productImageBase64,
            productImageMimeType,
            campaignGoal,
            platforms: platformsCopy,
            preferredStyle: fullCampaignPreferredStyle === "auto" ? undefined : fullCampaignPreferredStyle,
            campaignQuality: qc,
          }),
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (tryHandleBillingError(body)) {
          setFullCampaignGeneration((prev) => ({ ...prev, status: "idle", steps: [] }));
          return;
        }
        const errMsg =
          typeof body.error === "string"
            ? body.error
            : `Campaign generation failed (${response.status})`;
        toast.error(errMsg);
        setFullCampaignGeneration((prev) => ({ ...prev, status: "complete" }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        toast.error("Failed to connect to campaign stream");
        setFullCampaignGeneration((prev) => ({ ...prev, status: "complete" }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      const updateStep = (taskId: string, status: FullCampaignStepStatus, timeTaken?: number) => {
        setFullCampaignGeneration((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === taskId
              ? { ...s, status, ...(timeTaken != null && { timeTaken }), progress: status === "done" || status === "failed" ? 100 : status === "in_progress" ? 0 : s.progress }
              : s
          ),
        }));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop()!;

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(chunk.slice(6)) as Record<string, unknown>;
            const task = event.task as string;
            const status = event.status as string;

            if (status === "in_progress") {
              updateStep(task, "in_progress");
            } else if (status === "complete") {
              updateStep(task, "done", event.time_taken as number | undefined);
              setFullCampaignGeneration((prev) => ({
                ...prev,
                creditsUsed: prev.creditsUsed + ((event.credits_used as number) ?? 0),
                ...(task === "claude_json" && event.image_style_chosen != null && { imageStyleChosen: String(event.image_style_chosen) }),
              }));

              if (task === "meta_feed_image" && event.result_url) {
                setFullCampaignResults((prev) => ({ ...prev, metaImageUrl: event.result_url as string }));
              } else if (task === "meta_feed_image_1" && event.result_url) {
                setFullCampaignResults((prev) => {
                  const urls = [...(prev?.metaImageUrls ?? [])];
                  urls[0] = event.result_url as string;
                  return { ...prev, metaImageUrls: urls, metaImageUrl: urls[0] };
                });
              } else if (task === "meta_feed_image_2" && event.result_url) {
                setFullCampaignResults((prev) => {
                  const urls = [...(prev?.metaImageUrls ?? [])];
                  urls[1] = event.result_url as string;
                  return { ...prev, metaImageUrls: urls };
                });
              } else if (task === "meta_feed_image_3" && event.result_url) {
                setFullCampaignResults((prev) => {
                  const urls = [...(prev?.metaImageUrls ?? [])];
                  urls[2] = event.result_url as string;
                  return { ...prev, metaImageUrls: urls };
                });
              } else if (task === "story_image" && event.result_url) {
                setFullCampaignResults((prev) => ({ ...prev, storyImageUrl: event.result_url as string }));
              } else if (task === "story_image_1" && event.result_url) {
                setFullCampaignResults((prev) => {
                  const urls = [...(prev?.storyImageUrls ?? [])];
                  urls[0] = event.result_url as string;
                  return { ...prev, storyImageUrls: urls, storyImageUrl: urls[0] };
                });
              } else if (task === "story_image_2" && event.result_url) {
                setFullCampaignResults((prev) => {
                  const urls = [...(prev?.storyImageUrls ?? [])];
                  urls[1] = event.result_url as string;
                  return { ...prev, storyImageUrls: urls };
                });
              } else if (task === "story_image_3" && event.result_url) {
                setFullCampaignResults((prev) => {
                  const urls = [...(prev?.storyImageUrls ?? [])];
                  urls[2] = event.result_url as string;
                  return { ...prev, storyImageUrls: urls };
                });
              } else if (task === "video_16x9" && event.result_url) {
                setFullCampaignResults((prev) => ({ ...prev, videoUrl16x9: event.result_url as string }));
              } else if (task === "video_9x16" && event.result_url) {
                setFullCampaignResults((prev) => ({ ...prev, videoUrl9x16: event.result_url as string }));
              } else if (task === "email_html" && event.email_html) {
                const copies = (event.email_copies as Record<string, string>[] | undefined) ?? (event.email_copy ? [event.email_copy as Record<string, string>, event.email_copy as Record<string, string>] : []);
                setFullCampaignResults((prev) => ({
                  ...prev,
                  emailHtml: event.email_html as string,
                  emailHtmls: (event.email_htmls as string[] | undefined) ?? (event.email_html ? [event.email_html as string, event.email_html as string] : []),
                  emailCopy: (event.email_copies as Record<string, string>[] | undefined)?.[0] ?? (event.email_copy as Record<string, string> | undefined),
                  emailCopies: copies.length >= 2 ? copies : [copies[0] ?? {}, copies[0] ?? {}],
                }));
              } else if (task === "social_copy" && event.data) {
                setFullCampaignResults((prev) => ({
                  ...prev,
                  socialCopy: event.data as typeof prev extends null ? never : NonNullable<typeof prev>["socialCopy"],
                }));
              } else if (task === "email_image_1" && event.result_url) {
                setFullCampaignResults((prev) => ({
                  ...prev,
                  emailImageUrls: [event.result_url as string, ...(prev?.emailImageUrls?.slice(1) ?? [])],
                }));
              } else if (task === "email_image_2" && event.result_url) {
                setFullCampaignResults((prev) => ({
                  ...prev,
                  emailImageUrls: [(prev?.emailImageUrls?.[0] ?? ""), event.result_url as string, ...(prev?.emailImageUrls?.slice(2) ?? [])],
                }));
              } else if (task === "email_image_3" && event.result_url) {
                setFullCampaignResults((prev) => ({
                  ...prev,
                  emailImageUrls: [(prev?.emailImageUrls?.[0] ?? ""), (prev?.emailImageUrls?.[1] ?? ""), event.result_url as string],
                }));
              } else if (task === "campaign_complete") {
                setFullCampaignResults((prev) => ({
                  ...prev,
                  campaignId: event.campaign_id as string,
                }));
              }
            } else if (status === "failed") {
              updateStep(task, "failed");
              const retryable = event.retryable === true || event.code === "generation_unavailable";
              if (retryable) {
                setFullCampaignGeneration((prev) => ({ ...prev, generationUnavailableRetryable: true }));
              }
              if (task === "meta_feed_image_1" || task === "meta_feed_image_2" || task === "meta_feed_image_3") {
                const idx = task === "meta_feed_image_1" ? 0 : task === "meta_feed_image_2" ? 1 : 2;
                setFullCampaignResults((prev) => {
                  const failed = [...(prev?.metaFeedFailed ?? [false, false, false])];
                  failed[idx] = true;
                  return { ...prev, metaFeedFailed: failed };
                });
              } else if (task === "story_image_1" || task === "story_image_2" || task === "story_image_3") {
                const idx = task === "story_image_1" ? 0 : task === "story_image_2" ? 1 : 2;
                setFullCampaignResults((prev) => {
                  const failed = [...(prev?.storyFailed ?? [false, false, false])];
                  failed[idx] = true;
                  return { ...prev, storyFailed: failed };
                });
              } else if (task === "email_html" && event.email_copy) {
                const copy = event.email_copy as Record<string, string>;
                const copies = (event.email_copies as Record<string, string>[] | undefined) ?? [copy, copy];
                setFullCampaignResults((prev) => ({
                  ...prev,
                  emailCopy: copy,
                  emailCopies: copies.length >= 2 ? copies : [copy, copy],
                }));
              }
            }
          } catch {
            // skip unparseable chunks
          }
        }
      }

      setFullCampaignGeneration((prev) => ({ ...prev, status: "complete" }));
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Campaign generation failed";
      if (err instanceof TypeError && msg === "Failed to fetch") {
        msg = "Could not reach the campaign API. Check that the backend is running or NEXT_PUBLIC_API_URL / rewrites.";
      }
      toast.error(msg);
      setFullCampaignGeneration((prev) => ({ ...prev, status: "complete" }));
    }
  }

  /* Full campaign: product upload only in chat input; goal + style are in Options panel */
  const fullCampaignProductInput = (
    <div className="flex flex-col gap-2 p-[14px] text-[#000000] dark:text-white">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-[#888]">
        Product (required) — upload to generate
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fullCampaignFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Upload product image"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (fullCampaignProductImage != null) toast.success("Product photo updated");
              setFullCampaignProductImage(file);
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fullCampaignFileInputRef.current?.click()}
          className="cursor-pointer shrink-0 h-[34px] rounded-lg border-[1.5px] border-[#d1d5db] bg-white dark:bg-gray-800 dark:border-gray-600 px-[14px] py-[7px] text-xs text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Upload image (JPG/PNG/WEBP)
        </button>
        {fullCampaignProductPreviewUrl && (
          <div className="relative shrink-0 h-[34px] w-[34px] rounded-lg border border-[#e5e7eb] dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img src={fullCampaignProductPreviewUrl} alt="" className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={() => setFullCampaignProductImage(null)}
              className="cursor-pointer absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
              aria-label="Remove image"
            >
              <X className="size-2.5" />
            </button>
          </div>
        )}
      </div>
      {!fullCampaignProductImage && (
        <p className="text-[11px] text-muted-foreground">No image — add a product photo to generate.</p>
      )}
    </div>
  );

  const renderCampaignCard = (msgIndex: number) => {
    const isCurrent = currentCampaignMsgIndex === msgIndex;
    const saved = campaignResultsByMsgIndex[msgIndex];
    const isComplete = isCurrent ? fullCampaignGeneration.status === "complete" : !!saved;
    const onTap = () => {
      if (!isComplete) return;
      setSelectedCampaignMsgIndex(msgIndex);
      fullCampaignResultsRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    const brandLabel = isCurrent ? fullCampaignGeneration.brandName : (saved ? undefined : "");
    const goalLabel = isCurrent ? fullCampaignGeneration.campaignGoal : (saved ? undefined : "");
    if (!isCurrent && !saved) return null;
    return (
      <div
        role={isComplete ? "button" : undefined}
        tabIndex={isComplete ? 0 : undefined}
        onClick={isComplete ? onTap : undefined}
        onKeyDown={isComplete ? (e) => e.key === "Enter" && onTap() : undefined}
        className={cn(
          "w-full max-w-2xl rounded-xl border border-[#e5e7eb] bg-[#fafafa] overflow-hidden text-left",
          isComplete && "cursor-pointer hover:bg-[#f5f5f5] transition-colors"
        )}
      >
        <div className="h-[3px] w-full bg-gray-200 overflow-hidden">
          <div
            className="h-full transition-[width] duration-300 ease-out"
            style={{
              width: isCurrent && fullCampaignGeneration.status !== "complete"
                ? `${(fullCampaignGeneration.steps.filter((s) => s.status === "done").length / Math.max(1, fullCampaignGeneration.steps.length)) * 100}%`
                : "100%",
              background: isComplete
                ? "linear-gradient(90deg, #22c55e 0%, #22c55e 100%)"
                : "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)",
            }}
          />
        </div>
        <div className="p-4">
          <h3 className="text-[13px] font-medium text-[#333]">
            {isComplete ? "✅ Campaign ready — tap to view" : "✦ Generating your campaign..."}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {brandLabel ?? ""}
            {goalLabel ? ` · ${goalLabel}` : ""}
          </p>
          {isCurrent && (
            <>
              <div className="mt-3 space-y-2">
                {fullCampaignGeneration.steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <span className="flex shrink-0 items-center justify-center w-5 h-5">
                      {step.status === "pending" && (
                        <span className="size-2.5 rounded-full border-2 border-[#d1d5db]" aria-hidden />
                      )}
                      {step.status === "in_progress" && (
                        <span className="relative flex size-5 items-center justify-center">
                          <Spinner className="size-4 text-[#3b82f6]" />
                          {typeof step.progress === "number" && (
                            <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-[#3b82f6] tabular-nums">
                              {Math.round(step.progress)}%
                            </span>
                          )}
                        </span>
                      )}
                      {step.status === "done" && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-[#dcfce7]">
                          <Check className="size-3 text-green-600" strokeWidth={2.5} />
                        </span>
                      )}
                      {step.status === "failed" && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                          <X className="size-3" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13px]", step.status === "pending" ? "text-[#aaa]" : "text-[#333]")}>
                        {step.status === "failed" && step.id === "claude_json" && fullCampaignGeneration.generationUnavailableRetryable
                          ? "Our AI is busy right now. Tap to try again in a moment."
                          : step.id === "meta_feed_image_1" && fullCampaignGeneration.imageStyleChosen
                            ? `${fullCampaignGeneration.imageStyleChosen} — Feed (1:1)`
                            : step.id === "story_image_1" && fullCampaignGeneration.imageStyleChosen
                              ? `${fullCampaignGeneration.imageStyleChosen} — Story (9:16)`
                              : step.label}
                      </p>
                      <p className="text-[11px] text-gray-500">{step.subLabel}</p>
                    </div>
                    <div className="shrink-0 text-[11px] text-gray-500">
                      {step.status === "done" && step.timeTaken != null && `${step.timeTaken.toFixed(1)}s`}
                      {step.status === "in_progress" && step.id === "video" && fullCampaignGeneration.videoCountdownSeconds != null && `~${fullCampaignGeneration.videoCountdownSeconds}s remaining`}
                      {step.status === "failed" && (
                        <button
                          type="button"
                          className="text-[#3b82f6] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (step.id === "claude_json" && fullCampaignGeneration.generationUnavailableRetryable) {
                              handleFullCampaignGenerate();
                            }
                          }}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 pt-3 border-t border-[#e5e7eb] text-[11px] text-gray-600">
                Credits used: {fullCampaignGeneration.creditsUsed} of{" "}
                {fullCampaignGeneration.steps.length > 0
                  ? fullCampaignGeneration.steps.reduce((a, s) => a + s.credits, 0)
                  : fullCampaignBudgetCredits(fullCampaignQuality)}
              </p>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ─── Shared input card (textarea first, then row: Plus, Options, Tools, Send) ─── */

  /** Chat column width: 50% wider than opened sidebar (256 * 1.5 = 384) */
  const CHAT_WIDTH_PX = 384;
  const slideLabels = ["Posts", "Video", "Email"] as const;

  const { showFullCampaignLeft, standalonePreview } = useMemo(() => {
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    const fcActive =
      lastUserIdx >= 0 &&
      Boolean(messages[lastUserIdx].fullCampaignRequest) &&
      (fullCampaignGeneration.status === "generating" ||
        fullCampaignGeneration.status === "complete");

    type Standalone =
      | { type: "image"; urls: string[]; aspectRatio: ImageAspectRatio; generationIds?: string[] }
      | { type: "image-loading"; aspectRatio: ImageAspectRatio; count: number }
      | { type: "video"; url: string }
      | { type: "video-loading"; aspectRatio: VideoAspectRatio }
      | { type: "email"; msg: CreativeMessage }
      | { type: "email-loading" }
      | null;

    if (fcActive) {
      return { showFullCampaignLeft: true as const, standalonePreview: null as Standalone };
    }
    if (lastUserIdx < 0) {
      if (
        fullCampaignGeneration.status === "complete" &&
        fullCampaignResults &&
        (fullCampaignResults.campaignId != null ||
          (fullCampaignResults.metaImageUrls?.length ?? 0) > 0 ||
          !!fullCampaignResults.metaImageUrl)
      ) {
        return { showFullCampaignLeft: true as const, standalonePreview: null as Standalone };
      }
      return { showFullCampaignLeft: false as const, standalonePreview: null as Standalone };
    }
    for (let i = messages.length - 1; i > lastUserIdx; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      if (m.tool === "image") {
        if (m.generating) {
          return {
            showFullCampaignLeft: false as const,
            standalonePreview: {
              type: "image-loading" as const,
              aspectRatio: m.studioMeta?.aspectRatio ?? "4:5",
              count: Math.max(1, m.studioMeta?.imageCount ?? 1),
            },
          };
        }
        const urls = (m.signedImageUrls?.length ? m.signedImageUrls : m.imageUrls) ?? [];
        if (urls.length) {
          return {
            showFullCampaignLeft: false as const,
            standalonePreview: {
              type: "image" as const,
              urls,
              aspectRatio: m.studioMeta?.aspectRatio ?? "4:5",
              generationIds: m.generationIds,
            },
          };
        }
        return { showFullCampaignLeft: false as const, standalonePreview: null as Standalone };
      }
      if (m.tool === "video") {
        if (m.generating && !m.videoUrl) {
          return {
            showFullCampaignLeft: false as const,
            standalonePreview: {
              type: "video-loading" as const,
              aspectRatio: m.studioMeta?.videoAspect ?? "16:9",
            },
          };
        }
        if (m.videoUrl) {
          return { showFullCampaignLeft: false as const, standalonePreview: { type: "video" as const, url: m.videoUrl } };
        }
        return { showFullCampaignLeft: false as const, standalonePreview: null as Standalone };
      }
      if (m.tool === "email") {
        if (m.generating && !m.emailPayload) {
          return { showFullCampaignLeft: false as const, standalonePreview: { type: "email-loading" as const } };
        }
        if (m.emailPayload) {
          return { showFullCampaignLeft: false as const, standalonePreview: { type: "email" as const, msg: m } };
        }
        return { showFullCampaignLeft: false as const, standalonePreview: null as Standalone };
      }
    }
    return { showFullCampaignLeft: false as const, standalonePreview: null as Standalone };
  }, [messages, fullCampaignGeneration.status, fullCampaignResults]);

  const fullCampaignUsesTabs =
    fullCampaignGeneration.status === "generating" ||
    fullCampaignGeneration.status === "complete";

  const resultsPanelSegmentBar = fullCampaignUsesTabs ? (
    <div className="shrink-0 border-b border-border bg-[#ffffff] dark:bg-background flex items-center gap-2 px-3 h-10 w-full text-sm font-medium text-foreground">
      {slideLabels.map((label, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => setFullCampaignSwipeSlide(idx)}
          className={cn(
            "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 cursor-pointer rounded-sm overflow-hidden h-8",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          )}
          aria-label={`Show ${label}`}
        >
          <div
            className={cn(
              "w-full h-0.5 rounded-full min-h-[2px] transition-colors",
              fullCampaignSwipeSlide === idx ? "bg-primary" : "bg-gray-300"
            )}
          />
          <span className={cn(
            "text-[10px] truncate w-full text-center leading-tight",
            fullCampaignSwipeSlide === idx ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {label}
          </span>
        </button>
      ))}
    </div>
  ) : null;

  const chatTopBar = (
    <div className="sticky top-0 z-20 shrink-0 flex items-center h-10 w-full border-b border-border bg-[#ffffff] dark:bg-background px-3 text-sm font-medium text-foreground">
      {activeProject && (showBrandPicker ? (
        <div className="relative shrink-0 flex-1 min-w-0" ref={brandPickerRef}>
          <button
            type="button"
            onClick={() => setBrandPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 min-w-0 w-full max-w-full rounded-lg h-10 px-2 -mx-2 hover:bg-secondary/50 cursor-pointer"
          >
            <span className="truncate text-left">{activeProject.name}</span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", brandPickerOpen && "rotate-180")} />
          </button>
          {brandPickerOpen && (
            <div className="absolute top-full left-0 mt-1 w-[200px] rounded-xl border border-border bg-card shadow-lg z-50 py-1">
              {(allProjects ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (p.id === activeProject.id) {
                      setBrandPickerOpen(false);
                      return;
                    }
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveCreativeStudioChatToSupabase(workspaceId, projectId, stateRef.current);
                    try {
                      localStorage.setItem(
                        `blinkify:creativeStudio:lastProjectId:${workspaceId}`,
                        p.id
                      );
                    } catch {
                      /* ignore */
                    }
                    setHydrated(false);
                    setMessages([]);
                    setPrompt("");
                    setSelectedTool(null);
                    setContinuationPrompts([]);
                    setImageSlidePrompts([]);
                    setImageOptions(defaultImageOptions());
                    setVideoOptions(defaultVideoOptions());
                    setEmailOptions(defaultEmailOptions());
                    setLikedSnippets([]);
                    setDislikedSnippets([]);
                    setSelectedEmailTemplateId(null);
                    setFullCampaignGeneration({
                      status: "idle",
                      steps: [],
                      creditsUsed: 0,
                      brandName: "",
                      campaignGoal: null,
                      videoCountdownSeconds: null,
                      imageStyleChosen: null,
                    });
                    setFullCampaignResults(null);
                    setFullCampaignSwipeSlide(0);
                    setCampaignResultsByMsgIndex({});
                    setSelectedCampaignMsgIndex(null);
                    setCurrentCampaignMsgIndex(null);
                    fullCampaignLastUserMsgIndexRef.current = null;
                    setActiveProject(p);
                    setBrandPickerOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium",
                    "hover:bg-secondary/60"
                  )}
                >
                  {p.brand_colors?.[0] ? (
                    <span className="size-2.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: p.brand_colors[0] }} aria-hidden />
                  ) : (
                    <span className="size-2.5 rounded-full shrink-0 bg-primary" aria-hidden />
                  )}
                  <span className="truncate flex-1">{p.name}</span>
                  {p.id === activeProject.id && <Check className="size-3 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="truncate min-w-0 max-w-full">{activeProject.name}</span>
      ))}
    </div>
  );
  const inputActionRow = (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-2 shrink-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative shrink-0" ref={plusMenuRef}>
          <button
            type="button"
            onClick={() => {
              setPlusMenuOpen((v) => !v);
              setOptionsOpen(false);
              setToolsOpen(false);
              setBrandPickerOpen(false);
            }}
            className={cn(
              "flex items-center justify-center size-8 rounded-lg transition-colors shrink-0",
              pendingFiles.length > 0
                ? "icon-gradient-brand"
                : "text-[#000000] dark:text-white hover:text-foreground"
            )}
            title="Add or reset"
          >
            <Plus className="size-4" />
          </button>
          {plusMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-[220px] rounded-xl border border-border bg-card shadow-lg z-50 py-1">
              <button
                type="button"
                onClick={() => {
                  if (selectedTool === "full") {
                    fullCampaignFileInputRef.current?.click();
                  } else {
                    fileInputRef.current?.click();
                  }
                  setPlusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60"
              >
                <ImagePlus className="size-3.5" />
                <span className="flex-1">Upload product photo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedTool === "full") {
                    fullCampaignFileInputRef.current?.click();
                  } else {
                    fileInputRef.current?.click();
                  }
                  setPlusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60"
              >
                <ImagePlus className="size-3.5" />
                <span className="flex-1">Add images</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetChat();
                  setPlusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60"
              >
                <RotateCcw className="size-3.5" />
                <span className="flex-1">Start new campaign</span>
              </button>
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={optionsRef}>
          <button
            type="button"
            onClick={() => { setOptionsOpen((v) => !v); setToolsOpen(false); setBrandPickerOpen(false); setPlusMenuOpen(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer text-[#000000] dark:text-white hover:text-foreground"
          >
            <SlidersHorizontal className={cn("size-3.5", optionsOpen && "icon-active-creative")} />
            {optionsOpen ? <span className="text-gradient-brand">Options</span> : "Options"}
          </button>
          {optionsOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-[280px] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-50">
              {optionsPanelContent}
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={toolsRef}>
          <button
            type="button"
            onClick={() => { setToolsOpen((v) => !v); setOptionsOpen(false); setBrandPickerOpen(false); setPlusMenuOpen(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 text-[#000000] dark:text-white hover:text-foreground"
          >
            <Hammer className={cn("size-3.5", (toolsOpen || selectedTool) && "icon-active-creative")} />
            {toolsOpen || selectedTool ? <span className="text-gradient-brand">Tools</span> : "Tools"}
            <ChevronDown className={cn("size-3.5", (toolsOpen || selectedTool) && "icon-active-creative")} />
          </button>
            {toolsOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-[220px] rounded-xl border border-border bg-card shadow-lg z-50 py-1">
              <button
                type="button"
                title={!fullCampaignEnabled ? "Available on Professional plan" : undefined}
                onClick={() => {
                  if (!fullCampaignEnabled) {
                    setUpgradeModal({ feature: "full_campaign", requiredPlan: "pro" });
                    setToolsOpen(false);
                    return;
                  }
                  setSelectedTool(selectedTool === "full" ? null : "full");
                  setToolsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60 border-b border-border",
                  selectedTool === "full" && fullCampaignEnabled && "bg-secondary/40"
                )}
              >
                <Zap className="size-3.5 text-primary" />
                <span className="flex-1 font-semibold flex items-center gap-1.5 flex-wrap">
                  Full campaign
                  {!fullCampaignEnabled && (
                    <>
                      <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-[10px] font-semibold text-primary bg-primary/15 px-1.5 py-0 rounded">
                        Pro
                      </span>
                    </>
                  )}
                </span>
                {fullCampaignEnabled && selectedTool === "full" && (
                  <Check className="size-3.5 text-[#000000] dark:text-white" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTool(selectedTool === "image" ? null : "image");
                  setToolsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium",
                  "hover:bg-secondary/60"
                )}
              >
                <ImagePlus className="size-3.5" />
                <span className="flex-1">Ad Creative</span>
                {selectedTool === "image" && <Check className="size-3.5 text-[#000000] dark:text-white" />}
              </button>
              <div className="relative group/video">
                <button
                  type="button"
                  title={!videoEnabled ? "Available on Professional plan" : undefined}
                  onClick={() => {
                    if (!videoEnabled) {
                      setUpgradeModal({ feature: "video", requiredPlan: "pro" });
                      setToolsOpen(false);
                      return;
                    }
                    const next = selectedTool === "video" ? null : "video";
                    setSelectedTool(next);
                    if (next === "video") setVideoOptions(defaultVideoOptions());
                    setToolsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60"
                >
                  <Video className="size-3.5" />
                  <span className="flex-1 flex items-center gap-1.5 flex-wrap">
                    Commercial Video
                    {!videoEnabled && (
                      <>
                        <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-[10px] font-semibold text-primary bg-primary/15 px-1.5 py-0 rounded">
                          Pro
                        </span>
                      </>
                    )}
                  </span>
                  {videoEnabled && selectedTool === "video" && (
                    <Check className="size-3.5 text-[#000000] dark:text-white" />
                  )}
                </button>
              </div>
              <button
                type="button"
                title={!emailEnabled ? "Available on Standard plan" : undefined}
                onClick={() => {
                  if (!emailEnabled) {
                    setUpgradeModal({ feature: "email", requiredPlan: "standard" });
                    setToolsOpen(false);
                    return;
                  }
                  setSelectedTool(selectedTool === "email" ? null : "email");
                  if (selectedTool !== "email") setEmailOptions(defaultEmailOptions());
                  setToolsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/60"
              >
                <Mail className="size-3.5" />
                <span className="flex-1 flex items-center gap-1.5 flex-wrap">
                  Marketing Email
                  {!emailEnabled && (
                    <>
                      <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-[10px] font-semibold text-primary bg-primary/15 px-1.5 py-0 rounded">
                        Standard
                      </span>
                    </>
                  )}
                </span>
                {emailEnabled && selectedTool === "email" && (
                  <Check className="size-3.5 text-[#000000] dark:text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      {hasCreateTool && generationCost > 0 && (
        <span className="text-xs font-medium shrink-0 text-[#000000] dark:text-white">
          Generation Cost: {generationCost}
          {selectedTool === "full" ? ` (${fullCampaignQuality})` : ""}
        </span>
      )}
      <button
        type="button"
        onClick={() => (selectedTool === "full" ? handleFullCampaignGenerate() : handleSend())}
        disabled={selectedTool !== "full" && !canSend}
        className={cn(
          "size-8 rounded-lg bg-primary flex items-center justify-center text-white transition-opacity shrink-0 cursor-pointer",
          selectedTool !== "full" && !canSend && "disabled:opacity-40 disabled:cursor-default",
          selectedTool === "full" && !fullCampaignFormValid && "opacity-60",
          selectedTool === "full" && fullCampaignShake && "animate-shake"
        )}
      >
        <Send className="size-4" />
      </button>
    </div>
  );

  function renderStandaloneEmailInPanel(msg: CreativeMessage) {
    if (msg.tool !== "email" || !msg.emailPayload) return null;
    const html = getEmailHtmlFromMessage(msg);
    const p = msg.emailPayload;
    const generationIdList = Array.from(
      new Set(
        (msg.generationIds?.length ? msg.generationIds : msg.generationId ? [msg.generationId] : []).filter(
          (id): id is string => Boolean(id)
        )
      )
    );
    return (
      <MarketingEmailStandalonePreview
        subjectLine={p.subjectLine}
        html={html}
        generationIdList={generationIdList}
        setImagePreviewUrl={setImagePreviewUrl}
        handleSaveToCollection={handleSaveToCollection}
      />
    );
  }

  /* ─── Two-column layout: results panel (left) + chat (right), always ─── */

  return (
    <>
      {upgradeModal && (
        <UpgradeModal
          feature={upgradeModal.feature}
          requiredPlan={upgradeModal.requiredPlan}
          onClose={() => setUpgradeModal(null)}
        />
      )}
    <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* Results panel (middle): always present when has messages so chat stays fixed on the right */}
      <div
        ref={fullCampaignResultsRef}
        className="relative flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#fafafa] dark:bg-secondary/20"
      >
        <DotGridBg position="absolute" />
        {showFullCampaignLeft ? (
          <>
          {resultsPanelSegmentBar}
          {fullCampaignUsesTabs ? (
          <div className={cn("flex-1 min-h-0 flex items-center justify-center overflow-hidden", fullCampaignSwipeSlide === 0 ? "p-2 overflow-y-auto" : "p-10")}>
          <div className={cn("w-full min-w-0", fullCampaignSwipeSlide === 0 ? "min-h-full flex flex-col justify-start" : "h-full flex flex-col items-center justify-center gap-6")}>
            {/* Posts — 3 columns: 4:5 feed above 9:16 story per column; 5px gap, scale to fit */}
            {fullCampaignSwipeSlide === 0 && (() => {
              const displayResults = selectedCampaignMsgIndex != null ? campaignResultsByMsgIndex[selectedCampaignMsgIndex] ?? null : fullCampaignResults;
              const feedImages = displayResults?.metaImageUrls ?? (displayResults?.metaImageUrl ? [displayResults.metaImageUrl] : []);
              const storyImages = displayResults?.storyImageUrls ?? (displayResults?.storyImageUrl ? [displayResults.storyImageUrl] : []);
              const metaFeedFailed = displayResults?.metaFeedFailed ?? [false, false, false];
              const storyFailed = displayResults?.storyFailed ?? [false, false, false];
              const generating = fullCampaignGeneration.status === "generating";
              const Skeleton = ({ className }: { className?: string }) => (
                <div className={cn("animate-pulse rounded-xl bg-gray-200 dark:bg-secondary/60", className)} />
              );
              return (
                <div className="w-full min-h-full grid grid-cols-3 grid-rows-[minmax(280px,auto)_auto_auto] gap-[5px] min-w-0 place-items-stretch content-start pt-8 pb-4 px-1">
                  {/* Row 1: three 4:5 feed images — scales with viewport, no horizontal scroll */}
                  {[0, 1, 2].map((colIdx) => (
                    <div key={`feed-${colIdx}`} className="row-span-1 col-span-1 w-full min-w-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-secondary/40 border border-border flex items-center justify-center relative group aspect-[4/5]">
                      {feedImages[colIdx] ? (
                          <>
                            <button type="button" className="absolute inset-0 w-full h-full flex items-center justify-center" onClick={() => setImagePreviewUrl(feedImages[colIdx]!)}>
                              <img src={feedImages[colIdx]} alt={`Feed ${colIdx + 1}`} className="w-full h-full object-contain" />
                            </button>
                            <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={(e) => { e.stopPropagation(); downloadImageAsPng(feedImages[colIdx]!, `feed-${colIdx + 1}.png`); }} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white" aria-label="Download">
                                <Download className="size-4" />
                              </button>
                            </span>
                          </>
                        ) : metaFeedFailed[colIdx] ? (
                          <span className="text-sm text-red-600 dark:text-red-400 font-medium">Failed</span>
                        ) : generating ? (
                          <Skeleton className="w-full h-full min-h-[60px]" />
                        ) : (
                          <span className="text-xs text-center text-muted-foreground px-2">New image will be displayed here</span>
                        )}
                    </div>
                  ))}
                  {/* Rows 2-3: three 9:16 story images (1 col 2 rows each); aspect-[9/16] so grid grows and scroll shows full image */}
                  {[0, 1, 2].map((colIdx) => (
                    <div key={`story-${colIdx}`} className="col-span-1 row-span-2 w-full min-w-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-secondary/40 border border-border flex items-center justify-center relative group aspect-[9/16]">
                        {storyImages[colIdx] ? (
                          <>
                            <button type="button" className="absolute inset-0 w-full h-full flex items-center justify-center" onClick={() => setImagePreviewUrl(storyImages[colIdx]!)}>
                              <img src={storyImages[colIdx]} alt={`Story ${colIdx + 1}`} className="w-full h-full object-contain" />
                            </button>
                            <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={(e) => { e.stopPropagation(); downloadImageAsPng(storyImages[colIdx]!, `story-${colIdx + 1}.png`); }} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white" aria-label="Download">
                                <Download className="size-4" />
                              </button>
                            </span>
                          </>
                        ) : storyFailed[colIdx] ? (
                          <span className="text-sm text-red-600 dark:text-red-400 font-medium">Failed</span>
                        ) : generating ? (
                          <Skeleton className="w-full h-full min-h-[60px]" />
                        ) : (
                          <span className="text-xs text-center text-muted-foreground px-2">New image will be displayed here</span>
                        )}
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* Video — 16:9 left, 9:16 right; object-contain shows full frame */}
            {fullCampaignSwipeSlide === 1 && (() => {
              const displayResults = selectedCampaignMsgIndex != null ? campaignResultsByMsgIndex[selectedCampaignMsgIndex] ?? null : fullCampaignResults;
              const step16 = fullCampaignGeneration.steps.find((s) => s.id === "video_16x9");
              const step9 = fullCampaignGeneration.steps.find((s) => s.id === "video_9x16");
              const generating = fullCampaignGeneration.status === "generating";
              const url16 = displayResults?.videoUrl16x9 ?? displayResults?.videoUrl;
              const url9 = displayResults?.videoUrl9x16;
              return (
              <div className="w-full h-full flex flex-row gap-4 items-center justify-center overflow-auto py-4 px-2 min-h-0">
                {/* 16:9 left */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5 max-w-[60%]">
                  <p className="text-xs font-medium text-[#333] dark:text-foreground">Product commercial · 16:9</p>
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center relative">
                    {url16 ? (
                      <>
                        <video src={url16} className="max-h-full max-w-full w-auto h-auto object-contain" controls />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">0:08</span>
                        <a href={url16} download="video-16x9.mp4" className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Download className="size-3.5" /> Download
                        </a>
                      </>
                    ) : step16?.status === "failed" ? (
                      <div className="flex flex-col items-center justify-center gap-2 p-4">
                        <span className="text-sm text-red-500">Video failed</span>
                        <button type="button" className="text-xs text-[#3b82f6] hover:underline">Retry</button>
                      </div>
                    ) : generating ? (
                      <div className="w-full h-full animate-pulse bg-gray-800 flex items-center justify-center">
                        <span className="text-sm text-gray-400">Product video (16:9)</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground text-center px-4">New video will be displayed here</span>
                    )}
                  </div>
                </div>
                {/* 9:16 right */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5 max-w-[40%]">
                  <p className="text-xs font-medium text-[#333] dark:text-foreground">Vertical video · 9:16</p>
                  <div className="w-full aspect-[9/16] max-h-[70vh] rounded-xl overflow-hidden bg-black flex items-center justify-center relative">
                    {url9 ? (
                      <>
                        <video src={url9} className="max-h-full max-w-full w-auto h-auto object-contain" controls />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">0:08</span>
                        <a href={url9} download="video-9x16.mp4" className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Download className="size-3.5" /> Download
                        </a>
                      </>
                    ) : step9?.status === "failed" ? (
                      <div className="flex flex-col items-center justify-center gap-2 p-4">
                        <span className="text-sm text-red-500">Video failed</span>
                        <button type="button" className="text-xs text-[#3b82f6] hover:underline">Retry</button>
                      </div>
                    ) : generating ? (
                      <div className="w-full h-full animate-pulse bg-gray-800 flex items-center justify-center">
                        <span className="text-sm text-gray-400">Vertical (9:16)</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground text-center px-4">New video will be displayed here</span>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}
            {/* Email — 2 variants side by side; scale to fit, no horizontal scroll */}
            {fullCampaignSwipeSlide === 2 && (() => {
              const displayResults = selectedCampaignMsgIndex != null ? campaignResultsByMsgIndex[selectedCampaignMsgIndex] ?? null : fullCampaignResults;
              const emailHtmls = displayResults?.emailHtmls ?? (displayResults?.emailHtml ? [displayResults.emailHtml, displayResults.emailHtml] : []);
              const emailCopies = displayResults?.emailCopies ?? (displayResults?.emailCopy ? [displayResults.emailCopy, displayResults.emailCopy] : []);
              return (
              <div className="w-full h-full flex flex-row gap-4 justify-center items-stretch min-h-0 overflow-hidden py-4 px-2">
                {[0, 1].map((idx) => {
                  const html = emailHtmls[idx] ?? "";
                  const copy = emailCopies[idx];
                  return (
                    <div key={idx} className="w-full flex-1 min-w-0 aspect-[4/5] min-h-0 flex flex-col rounded-xl overflow-hidden border border-border bg-card shadow-sm">
                      <div className="p-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
                        <span className="text-xs font-medium truncate min-w-0 flex-1 mr-2 text-[#000000] dark:text-[#ffffff]" title={copy?.subject_line}>
                          {copy?.subject_line ?? "Preview"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80"
                            onClick={() => { const sub = copy?.subject_line ?? ""; if (sub) navigator.clipboard.writeText(sub).then(() => toast.success("Subject copied!")); }}
                          >
                            Copy Subject
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80"
                            onClick={() => { if (html) navigator.clipboard.writeText(html).then(() => toast.success("HTML copied!")); }}
                          >
                            Copy HTML
                          </button>
                        </div>
                      </div>
                      {html ? (
                        <iframe srcDoc={html} title={`Email ${idx + 1} preview`} className="w-full flex-1 min-h-0 border-0" sandbox="allow-same-origin" />
                      ) : copy ? (
                        <div className="p-4 border-t border-border text-sm text-foreground space-y-2 overflow-y-auto flex-1 min-h-0">
                          <p className="font-semibold">{copy.headline}</p>
                          <p className="text-xs text-muted-foreground">{copy.subheadline}</p>
                        </div>
                      ) : fullCampaignGeneration.status === "generating" ? (
                        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                          <div className="w-full max-w-[200px] space-y-2">
                            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-secondary/60 w-full" />
                            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-secondary/60 w-4/5" />
                            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-secondary/60 w-3/5" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                          <span className="text-sm text-muted-foreground text-center">New email will be displayed here</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              );
            })()}
            </div>
          </div>
          ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-10 pb-8">
            <div>
              <p className="text-xs font-semibold text-foreground mb-3 tracking-wide">Posts</p>
              {(() => {
                const displayResults = selectedCampaignMsgIndex != null ? campaignResultsByMsgIndex[selectedCampaignMsgIndex] ?? null : fullCampaignResults;
                const feedImages = displayResults?.metaImageUrls ?? (displayResults?.metaImageUrl ? [displayResults.metaImageUrl] : []);
                const storyImages = displayResults?.storyImageUrls ?? (displayResults?.storyImageUrl ? [displayResults.storyImageUrl] : []);
                const metaFeedFailed = displayResults?.metaFeedFailed ?? [false, false, false];
                const storyFailed = displayResults?.storyFailed ?? [false, false, false];
                return (
                  <div className="w-full min-w-0 grid grid-cols-3 grid-rows-[minmax(180px,auto)_auto_auto] gap-[5px] place-items-stretch content-start">
                    {[0, 1, 2].map((colIdx) => (
                      <div key={`cf-${colIdx}`} className="relative row-span-1 col-span-1 w-full min-w-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-secondary/40 border border-border flex items-center justify-center aspect-[4/5]">
                        {feedImages[colIdx] ? (
                          <button type="button" className="absolute inset-0 w-full h-full flex items-center justify-center" onClick={() => setImagePreviewUrl(feedImages[colIdx]!)}>
                            <img src={feedImages[colIdx]} alt="" className="w-full h-full object-contain" />
                          </button>
                        ) : metaFeedFailed[colIdx] ? (
                          <span className="text-xs text-red-500">Failed</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    ))}
                    {[0, 1, 2].map((colIdx) => (
                      <div key={`cs-${colIdx}`} className="col-span-1 row-span-2 w-full min-w-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-secondary/40 border border-border flex items-center justify-center aspect-[9/16]">
                        {storyImages[colIdx] ? (
                          <button type="button" className="w-full h-full flex items-center justify-center" onClick={() => setImagePreviewUrl(storyImages[colIdx]!)}>
                            <img src={storyImages[colIdx]} alt="" className="w-full h-full object-contain" />
                          </button>
                        ) : storyFailed[colIdx] ? (
                          <span className="text-xs text-red-500">Failed</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-3 tracking-wide">Video</p>
              {(() => {
                const displayResults = selectedCampaignMsgIndex != null ? campaignResultsByMsgIndex[selectedCampaignMsgIndex] ?? null : fullCampaignResults;
                const step16 = fullCampaignGeneration.steps.find((s) => s.id === "video_16x9");
                const step9 = fullCampaignGeneration.steps.find((s) => s.id === "video_9x16");
                const url16 = displayResults?.videoUrl16x9 ?? displayResults?.videoUrl;
                const url9 = displayResults?.videoUrl9x16;
                return (
                  <div className="w-full flex flex-col sm:flex-row gap-4 items-stretch justify-center">
                    <div className="flex-1 min-w-0 max-w-full sm:max-w-[60%]">
                      <p className="text-xs font-medium text-muted-foreground mb-1">16:9</p>
                      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                        {url16 ? <video src={url16} className="max-h-full max-w-full w-auto h-auto object-contain" controls /> : step16?.status === "failed" ? <span className="text-xs text-red-500 p-4">Failed</span> : <span className="text-xs text-muted-foreground p-4">—</span>}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 max-w-full sm:max-w-[40%] flex justify-center">
                      <div className="w-full max-w-[220px]">
                        <p className="text-xs font-medium text-muted-foreground mb-1">9:16</p>
                        <div className="w-full aspect-[9/16] rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[50vh]">
                          {url9 ? <video src={url9} className="max-h-full max-w-full w-auto h-auto object-contain" controls /> : step9?.status === "failed" ? <span className="text-xs text-red-500 p-4">Failed</span> : <span className="text-xs text-muted-foreground p-4">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-3 tracking-wide">Marketing email</p>
              {(() => {
                const displayResults = selectedCampaignMsgIndex != null ? campaignResultsByMsgIndex[selectedCampaignMsgIndex] ?? null : fullCampaignResults;
                const emailHtmls = displayResults?.emailHtmls ?? (displayResults?.emailHtml ? [displayResults.emailHtml, displayResults.emailHtml] : []);
                const emailCopies = displayResults?.emailCopies ?? (displayResults?.emailCopy ? [displayResults.emailCopy, displayResults.emailCopy] : []);
                return (
                  <div className="w-full flex flex-col md:flex-row gap-4 justify-center">
                    {[0, 1].map((idx) => {
                      const html = emailHtmls[idx] ?? "";
                      const copy = emailCopies[idx];
                      return (
                        <div key={idx} className="w-full flex-1 min-w-0 min-h-[280px] max-h-[480px] flex flex-col rounded-xl overflow-hidden border border-border bg-card">
                          <div className="p-2 flex flex-wrap gap-2 shrink-0 border-b border-border">
                            <span className="text-xs font-medium truncate flex-1 min-w-0">{copy?.subject_line ?? "Variant"}</span>
                            {html && (
                              <button type="button" className="text-xs px-2 py-1 rounded bg-secondary" onClick={() => navigator.clipboard.writeText(html).then(() => toast.success("HTML copied"))}>Copy HTML</button>
                            )}
                          </div>
                          {html ? (
                            <iframe srcDoc={html} title={`Email ${idx + 1}`} className="w-full flex-1 min-h-[200px] border-0" sandbox="allow-same-origin" />
                          ) : (
                            <div className="flex-1 flex items-center justify-center p-4 text-xs text-muted-foreground">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
          )}
        </>
        ) : standalonePreview ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
            {standalonePreview.type === "image-loading" && (
              <div
                className={cn(
                  standaloneAdImageLayoutClass(standalonePreview.aspectRatio, standalonePreview.count),
                  "w-full"
                )}
              >
                {Array.from({ length: standalonePreview.count }, (_, i) => (
                  <div
                    key={i}
                    className={standaloneAdImageCellWrapClass(
                      standalonePreview.aspectRatio,
                      standalonePreview.count
                    )}
                  >
                    <div className={standaloneAdImageSkeletonClass(standalonePreview.aspectRatio)} />
                  </div>
                ))}
              </div>
            )}
            {standalonePreview.type === "image" && (
              <div
                className={cn(
                  standaloneAdImageLayoutClass(
                    standalonePreview.aspectRatio,
                    standalonePreview.urls.length
                  ),
                  "w-full min-h-0 py-2"
                )}
              >
                {standalonePreview.urls.map((u, idx) => {
                  const genId =
                    standalonePreview.generationIds?.[idx] ??
                    (idx === 0 ? standalonePreview.generationIds?.[0] : undefined);
                  const expired = failedMediaUrls.includes(u);
                  return (
                    <div
                      key={idx}
                      className={standaloneAdImageCellWrapClass(
                        standalonePreview.aspectRatio,
                        standalonePreview.urls.length
                      )}
                    >
                      <div className="relative w-full group/img">
                        {expired ? (
                          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 bg-muted/30 p-4 text-center text-sm">
                            <span>Link expired</span>
                            <button
                              type="button"
                              onClick={() => setRefetchUrlsTrigger((t) => t + 1)}
                              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                            >
                              <RotateCw className="size-3.5" /> Refresh
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="block w-full cursor-zoom-in text-left"
                              onClick={() => setImagePreviewUrl(u)}
                            >
                              <img
                                src={u}
                                alt=""
                                className="block h-auto w-full max-w-full align-top"
                                onError={() =>
                                  setFailedMediaUrls((prev) =>
                                    prev.includes(u) ? prev : [...prev, u]
                                  )
                                }
                              />
                            </button>
                            <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/img:opacity-100">
                              {genId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSaveToCollection(genId);
                                  }}
                                  className={cn(
                                    "pointer-events-auto size-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
                                    bookmarkedGenIds.has(genId)
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-black/60 hover:bg-black/80 text-white"
                                  )}
                                  title={
                                    bookmarkedGenIds.has(genId)
                                      ? "In collection"
                                      : "Save to Asset Collection"
                                  }
                                >
                                  <Bookmark
                                    className={cn(
                                      "size-4",
                                      bookmarkedGenIds.has(genId) && "fill-current"
                                    )}
                                  />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  downloadImageAsPng(u, `blinkify-ad-${idx + 1}-${Date.now()}.png`);
                                }}
                                className="pointer-events-auto size-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white"
                                title="Download PNG"
                              >
                                <Download className="size-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {standalonePreview.type === "video-loading" && (
              <div
                className={cn(
                  "w-full max-w-3xl mx-auto rounded-xl overflow-hidden border border-border bg-muted/30 flex items-center justify-center min-h-[200px]",
                  standalonePreview.aspectRatio === "9:16" ? "aspect-[9/16] max-h-[70vh]" : "aspect-video"
                )}
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Spinner className="size-8" />
                  <span className="text-sm">Generating video…</span>
                </div>
              </div>
            )}
            {standalonePreview.type === "video" && (
              <div className="relative group/vid max-w-full">
                <video
                  src={standalonePreview.url}
                  className="max-w-full max-h-[min(78vh,calc(100vh-10rem))] rounded-xl border border-border shadow-sm"
                  controls
                  playsInline
                />
                <a
                  href={standalonePreview.url}
                  download
                  className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1 opacity-0 group-hover/vid:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="size-3.5" /> Download
                </a>
              </div>
            )}
            {standalonePreview.type === "email-loading" && (
              <div className="w-full max-w-2xl mx-auto space-y-4 p-2">
                <div className="h-9 w-3/4 max-w-md animate-pulse rounded-lg bg-muted" />
                <div className="h-[min(420px,50vh)] w-full animate-pulse rounded-xl bg-muted/40 border border-border" />
              </div>
            )}
            {standalonePreview.type === "email" &&
              renderStandaloneEmailInPanel(standalonePreview.msg)}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center p-10 text-sm text-muted-foreground text-center px-6">
            Results will show here.
          </div>
        )}
      </div>

      {/* Chat column: always fixed width on the right when has messages */}
      <div
        className="flex flex-col h-full min-h-0 shrink-0 border-l border-border bg-background"
        style={{ width: CHAT_WIDTH_PX, minWidth: CHAT_WIDTH_PX, flex: "none" }}
      >
      {chatTopBar}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 pb-6">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-start min-h-full w-full pt-6">
            <div className="text-center mb-4 shrink-0 w-full">
              <h1 className="text-xl font-bold tracking-tight mb-2">
                <span className="text-gradient-brand">Creative Studio</span>
              </h1>
              <p className="text-sm text-[#000000] dark:text-white">
                Upload your product. Get your ad creative, video, and email — ready to launch.
              </p>
            </div>
            {!prompt.trim() && selectedTool !== "full" && (
              <div className="flex flex-wrap gap-2 w-full justify-center">
                {SUGGESTED_PROMPT_CHIPS.map((label) => (
                  <button key={label} type="button" onClick={() => setPrompt(label)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/60 text-foreground hover:bg-secondary border border-border/60 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="w-full space-y-4">
          {messages.map((msg, i) => (
            <Fragment key={i}>
            <div
              className={cn(
                msg.role === "user"
                  ? "ml-auto max-w-[85%]"
                  : "flex flex-col items-start max-w-[85%]"
              )}
            >
              {msg.role === "assistant" && (
                <BlinkifyLogo variant="icon" height={20} className="mb-1.5 shrink-0" />
              )}
              <div
                className={cn(
                  "rounded-2xl text-sm w-full",
                  msg.role === "user"
                    ? "px-4 py-3 bg-primary/10 dark:bg-card"
                    : (() => {
                        const hasImageInChat =
                          msg.tool !== "image" &&
                          (msg.imageUrls?.length ?? 0) > 0 &&
                          !(msg.tool === "email" && msg.emailPayload);
                        const hasVideoInChat = !!msg.videoUrl && msg.tool !== "video";
                        const isMediaOnly = hasImageInChat || hasVideoInChat;
                        return isMediaOnly ? "" : "px-4 py-3 bg-card border border-border";
                      })()
                )}
              >
                {msg.role === "assistant" && msg.stages && msg.stages.length > 0 && (
                  <div className="space-y-1 mb-2 text-muted-foreground text-xs">
                    {msg.stages.map((s, j) => (
                      <div key={j}>{s}</div>
                    ))}
                  </div>
                )}
                {msg.role === "user" ? (
                  <>
                    {msg.attachedImageUrls && msg.attachedImageUrls.length > 0 && (
                      <div className="flex flex-wrap gap-3 overflow-x-auto mb-3">
                        {msg.attachedImageUrls.map((url, j) => (
                          <div
                            key={j}
                            className="relative shrink-0 rounded-xl border border-border bg-card overflow-hidden w-[140px]"
                          >
                            <div className="aspect-square bg-muted/30 relative">
                              <img src={url} alt="" className="w-full h-full object-contain" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </>
                ) : (
                  <>
                    {msg.generating &&
                      (msg.tool === "image" || msg.tool === "video" || msg.tool === "email") && (
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner className="size-4" />
                            <span className="text-xs">Generating…</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cancelGeneration(i)}
                            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    {msg.generating &&
                      msg.tool !== "image" &&
                      msg.tool !== "video" &&
                      msg.tool !== "email" &&
                      !msg.content &&
                      !msg.imageUrls?.length &&
                      !msg.videoUrl && (
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner className="size-4" />
                            <span className="text-xs">Thinking…</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => cancelGeneration(i)}
                            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    {(() => {
                      if (msg.tool === "email" && msg.emailPayload) {
                        return <p className="whitespace-pre-wrap text-sm">Generation complete.</p>;
                      }
                      if (msg.content) {
                        const isImageWithOutput = msg.tool === "image" && (msg.imageUrls?.length ?? 0) > 0;
                        const looksLikeModelPrompt =
                          isImageWithOutput &&
                          (msg.content.startsWith("I will generate") ||
                            (msg.content.length > 100 && /aspect ratio|focal point|photorealistic/i.test(msg.content)));
                        if (looksLikeModelPrompt) return null;
                        const stillWaitingForOutput =
                          msg.generating &&
                          (msg.tool === "image"
                            ? !(msg.imageUrls?.length)
                            : msg.tool === "video"
                              ? !msg.videoUrl
                              : msg.tool === "email"
                                ? !msg.emailPayload
                                : false);
                        return stillWaitingForOutput ? (
                          <div className="flex items-center justify-between gap-2 w-full">
                            <p className="whitespace-pre-wrap min-w-0">
                              {renderContentWithBold(msg.content)}
                            </p>
                            <button
                              type="button"
                              onClick={() => cancelGeneration(i)}
                              className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">
                            {renderContentWithBold(msg.content)}
                          </p>
                        );
                        }
                        return null;
                      })()}
                    {msg.tool !== "image" &&
                      msg.imageUrls &&
                      msg.imageUrls.length > 0 &&
                      !(msg.tool === "email" && msg.emailPayload) && (
                      <div className="flex flex-col gap-2 w-full">
                        {msg.imageUrls.map((url, j) => {
                          const isExpired = failedMediaUrls.includes(url);
                          return (
                          <div
                            key={j}
                            className="relative group/img rounded-2xl overflow-hidden w-full"
                          >
                            {isExpired ? (
                              <div className="flex flex-col items-center justify-center gap-2 min-h-[200px] p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-2xl border border-border">
                                <span>Link expired</span>
                                <button
                                  type="button"
                                  onClick={() => setRefetchUrlsTrigger((t) => t + 1)}
                                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                                >
                                  <RotateCw className="size-3.5" />
                                  Refresh
                                </button>
                              </div>
                            ) : (
                            <button
                              type="button"
                              className="block w-full cursor-zoom-in text-left"
                              onClick={() => setImagePreviewUrl(url)}
                            >
                              <img
                                src={url}
                                alt=""
                                className="w-full max-h-[min(88vh,920px)] h-auto object-contain rounded-2xl bg-muted/20"
                                onError={() => setFailedMediaUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))}
                              />
                            </button>
                            )}
                            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                              {msg.generationId && j === 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSaveToCollection(msg.generationId!);
                                  }}
                                  className={cn(
                                    "size-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
                                    bookmarkedGenIds.has(msg.generationId!)
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-black/60 hover:bg-black/80 text-white"
                                  )}
                                  title={
                                    bookmarkedGenIds.has(msg.generationId!)
                                      ? "In collection"
                                      : "Save to Asset Collection"
                                  }
                                >
                                  <Bookmark
                                    className={cn(
                                      "size-4",
                                      bookmarkedGenIds.has(msg.generationId!) && "fill-current"
                                    )}
                                  />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  downloadImageAsPng(url, `blinkify-${j + 1}-${Date.now()}.png`);
                                }}
                                className="size-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer"
                                title="Download PNG"
                              >
                                <Download className="size-4" />
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                    {msg.videoUrl && msg.tool !== "video" && (
                      <div className="rounded-2xl overflow-hidden relative group/vid">
                        {failedMediaUrls.includes(msg.videoUrl) ? (
                          <div className="flex flex-col items-center justify-center gap-2 min-h-[200px] p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-2xl border border-border">
                            <span>Link expired</span>
                            <button
                              type="button"
                              onClick={() => setRefetchUrlsTrigger((t) => t + 1)}
                              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                            >
                              <RotateCw className="size-3.5" />
                              Refresh
                            </button>
                          </div>
                        ) : (
                        <video
                          src={msg.videoUrl}
                          controls
                          className="w-full rounded-2xl"
                          playsInline
                          onError={() => setFailedMediaUrls((prev) => (prev.includes(msg.videoUrl!) ? prev : [...prev, msg.videoUrl!]))}
                        />
                        )}
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/vid:opacity-100 transition-opacity">
                          {msg.generationId && (
                            <button
                              type="button"
                              onClick={() => handleSaveVideoToCollection(msg.generationId!)}
                              className={cn(
                                "size-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
                                bookmarkedVideoGenIds.has(msg.generationId!)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-black/60 hover:bg-black/80 text-white"
                              )}
                              title={
                                bookmarkedVideoGenIds.has(msg.generationId!)
                                  ? "In collection"
                                  : "Save to Asset Collection"
                              }
                            >
                              <Bookmark
                                className={cn(
                                  "size-4",
                                  bookmarkedVideoGenIds.has(msg.generationId!) && "fill-current"
                                )}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadVideo(msg.videoUrl!)}
                            className="size-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer"
                            title="Download"
                          >
                            <Download className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {msg.role === "assistant" &&
                !msg.generating &&
                (msg.content || (msg.imageUrls?.length ?? 0) > 0 || msg.videoUrl || msg.emailPayload) && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <div className="relative group/action">
                      <button
                        type="button"
                        onClick={() => handleGoodResponse(i)}
                        className="size-8 rounded-full flex items-center justify-center text-[#000000] dark:text-white hover:bg-secondary/60 hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Good response"
                      >
                        <ThumbsUp className="size-4" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-neutral-800 dark:bg-neutral-700 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/action:opacity-100 transition-opacity z-10">
                        Good response
                      </span>
                    </div>
                    <div className="relative group/action">
                      <button
                        type="button"
                        onClick={() => handleBadResponse(i)}
                        className="size-8 rounded-full flex items-center justify-center text-[#000000] dark:text-white hover:bg-secondary/60 hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Bad response"
                      >
                        <ThumbsDown className="size-4" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-neutral-800 dark:bg-neutral-700 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/action:opacity-100 transition-opacity z-10">
                        Bad response
                      </span>
                    </div>
                    <div className="relative group/action">
                      <button
                        type="button"
                        onClick={() => handleCopyResponse(i)}
                        className="size-8 rounded-full flex items-center justify-center text-[#000000] dark:text-white hover:bg-secondary/60 hover:text-foreground transition-colors cursor-pointer"
                        aria-label={msg.tool === "email" && msg.emailPayload ? "Copy HTML" : "Copy response"}
                      >
                        <Copy className="size-4" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-neutral-800 dark:bg-neutral-700 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/action:opacity-100 transition-opacity z-10">
                        {msg.tool === "email" && msg.emailPayload ? "Copy HTML" : "Copy response"}
                      </span>
                    </div>
                  </div>
                )}
                {msg.role === "assistant" &&
                  !msg.generating &&
                  i > 0 &&
                  messages[i - 1].role === "user" &&
                  messages[i - 1].fullCampaignRequest && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {FULL_CAMPAIGN_FOLLOWUP_CHIPS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          chipSendRef.current = label;
                          setPrompt(label);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/60 text-foreground hover:bg-secondary border border-border/60 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
            </div>
            {msg.role === "user" && msg.fullCampaignRequest && (() => {
              const card = renderCampaignCard(i);
              return card ? <div className="w-full flex flex-col items-start max-w-[85%]">{card}</div> : null;
            })()}
            </Fragment>
          ))}
          <div ref={messagesEndRef} />
        </div>
        )}
      </div>

      {/* Input bar — attached to bottom of chat column */}
      <div className="shrink-0 border-t border-border bg-background w-full">
        <div className="flex flex-col p-3">
              {replyingTo != null && (
                <div className="flex items-center gap-2 mb-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-sm">
                  <Reply className="size-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Replying to message — your prompt will adjust that response.</span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="ml-auto size-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    aria-label="Cancel reply"
                  >
                    <span className="sr-only">Cancel reply</span>
                    ×
                  </button>
                </div>
              )}
              {selectedTool === "full" ? (
                fullCampaignProductInput
              ) : (
                <>
                  <div className="shrink-0">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={replyingTo != null ? "Describe the change (e.g. make the background darker)…" : "Describe what you want to create or ask about…"}
                      rows={3}
                      className="w-full min-h-[4.5rem] max-h-[9.2rem] resize-none overflow-y-auto bg-transparent px-0 py-1 text-sm placeholder:text-muted-foreground focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                  </div>
                  {selectedTool === "image" && imageOptions.adStyle !== "none" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {adStylesConfig?.styles?.[imageOptions.adStyle]?.name ?? imageOptions.adStyle.replace(/_/g, " ")} style applied
                    </p>
                  )}
                  {(() => {
                    const imageEntries = pendingFiles
                      .map((f, i) => ({ f, pendingIndex: i }))
                      .filter(({ f }) => f.type.startsWith("image/"));
                    if (imageEntries.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
                        {imageEntries.map(({ pendingIndex }, j) => (
                          <div
                            key={pendingIndex}
                            className="relative shrink-0 rounded-xl border border-border bg-card overflow-hidden w-[140px]"
                          >
                            <div className="aspect-square bg-muted/30 relative">
                              {pendingPreviewUrls[j] ? (
                                <img
                                  src={pendingPreviewUrls[j]}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => removePendingFile(pendingIndex)}
                                className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-sm leading-none"
                                aria-label="Remove image"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {selectedTool === "video" && continuationSlots > 0 && (
                    <div className="space-y-2 border-t border-border/60 pt-2">
                      <p className="text-[10px] font-medium text-muted-foreground">Segment 2+ — one prompt per segment.</p>
                      {Array.from({ length: continuationSlots }, (_, i) => (
                        <textarea
                          key={i}
                          value={continuationPrompts[i] ?? ""}
                          onChange={(e) => setContinuationPromptAt(i, e.target.value)}
                          placeholder={`Segment ${i + 2}…`}
                          rows={1}
                          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
              {inputActionRow}
        </div>
      </div>
      </div>
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setImagePreviewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setImagePreviewUrl(null)}
            className="absolute top-4 right-4 size-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            aria-label="Close preview"
          >
            <X className="size-5" />
          </button>
          <div className="relative flex items-center justify-center max-w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={imagePreviewUrl}
              alt=""
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => downloadImageAsPng(imagePreviewUrl, `blinkify-${Date.now()}.png`)}
              className="absolute bottom-4 right-4 p-2.5 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
              aria-label="Download image"
            >
              <Download className="size-5" />
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Add images"
        onChange={handleFileSelect}
      />
    </div>
    </>
  );
}
