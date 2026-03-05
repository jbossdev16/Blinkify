"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
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
  Copy,
  Reply,
  X,
  Palette,
  Check,
  Hammer,
} from "lucide-react";
import { BlinkifyLogo } from "@/components/blinkify-logo";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { BorderBeam } from "@/components/ui/border-beam";
import type { Project } from "@/lib/api";
import { apiClientFetch } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { renderContentWithBold } from "@/lib/render-content-with-bold";
import { getPlanFeatures } from "@/lib/constants";
import { toast } from "sonner";
import { isEmailTemplateId, type EmailTemplateId } from "@/lib/email-templates";

/* ─── Types ───────────────────────────────────────────────────────────── */

type CreativeTool = "image" | "video" | "email" | null;

type ImageAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
type ImageResolution = "1K" | "4K";

interface ImageOptions {
  aspectRatio: ImageAspectRatio;
  resolution: ImageResolution;
  temperature: number;
  numberOfImages: number;
  carousel: boolean;
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
  brand_colors: string[];
  font_styles: unknown;
  brand_logo_url: string | null;
  /** Website URL for CTA and clickable images in email. */
  website_url?: string | null;
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
}

const IMAGE_ASPECT_RATIOS: { value: ImageAspectRatio; label: string }[] = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "4:5", label: "Instagram Feed (4:5)" },
  { value: "5:4", label: "Landscape Photo (5:4)" },
  { value: "3:4", label: "Portrait (3:4)" },
  { value: "4:3", label: "Presentation (4:3)" },
  { value: "2:3", label: "Tall Portrait (2:3)" },
  { value: "3:2", label: "Photo Print (3:2)" },
  { value: "9:16", label: "Story / Reel (9:16)" },
  { value: "16:9", label: "Landscape Ad (16:9)" },
  { value: "21:9", label: "Banner (21:9)" },
];

const IMAGE_RESOLUTIONS: { value: ImageResolution; label: string }[] = [
  { value: "1K", label: "Standard (1K)" },
  { value: "4K", label: "Ultra (4K)" },
];

const VIDEO_MODELS: { value: VideoModelKey; label: string }[] = [
  { value: "fast", label: "Blinkify Fast" },
  { value: "standard", label: "Blinkify Standard" },
];

const VIDEO_ASPECT_RATIOS: { value: VideoAspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
];

const VIDEO_RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: "1080p", label: "Standard" },
  { value: "4k", label: "Ultra (4K)" },
];

const EMAIL_ASPECT_RATIOS: { value: EmailAspectRatio; label: string }[] = [
  { value: "9:16", label: "9:16 Portrait" },
  { value: "1:1", label: "1:1 Square" },
];

const EMAIL_NUMBER_OF_IMAGES: { value: EmailNumberOfImages; label: string }[] = [
  { value: 1, label: "1 image" },
  { value: 2, label: "2 images" },
  { value: 3, label: "3 images" },
];

const EMAIL_IMAGE_QUALITIES: { value: EmailImageQuality; label: string }[] = [
  { value: "1K", label: "Standard (1K)" },
  { value: "4K", label: "Ultra (4K)" },
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
}

function defaultImageOptions(): ImageOptions {
  return {
    aspectRatio: "1:1",
    resolution: "1K",
    temperature: TEMPERATURE_DEFAULT,
    numberOfImages: 1,
    carousel: false,
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

function continuationSlotsForDuration(seconds: number): number {
  if (seconds <= 8) return 0;
  return Math.min(20, Math.ceil((seconds - 8) / 7));
}

const PREFERENCE_SNIPPETS_MAX = 10;

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
}> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("creative_studio_chats")
    .select("data")
    .eq("project_id", projectId)
    .maybeSingle();

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
  }));
  const selectedEmailTemplateId = isEmailTemplateId(d.selectedEmailTemplateId) ? d.selectedEmailTemplateId : null;
  return {
    messages,
    prompt: d.prompt ?? "",
    selectedTool: d.selectedTool ?? null,
    imageOptions: { ...defaultImageOptions(), ...d.imageOptions },
    videoOptions: { ...defaultVideoOptions(), ...d.videoOptions },
    emailOptions: { ...defaultEmailOptions(), ...d.emailOptions },
    continuationPrompts: Array.isArray(d.continuationPrompts) ? d.continuationPrompts : [],
    imageSlidePrompts: Array.isArray(d.imageSlidePrompts) ? d.imageSlidePrompts : [],
    likedSnippets: Array.isArray(d.likedSnippets) ? d.likedSnippets.slice(0, PREFERENCE_SNIPPETS_MAX) : [],
    dislikedSnippets: Array.isArray(d.dislikedSnippets) ? d.dislikedSnippets.slice(0, PREFERENCE_SNIPPETS_MAX) : [],
    selectedEmailTemplateId,
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
  }
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const storedMessages: StoredCreativeMessage[] = state.messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    ...(m.tool != null && { tool: m.tool }),
    ...(m.stages != null && { stages: m.stages }),
    ...(m.generationId != null && { generationId: m.generationId }),
    ...(m.generationIds?.length && { generationIds: m.generationIds }),
    ...(m.imageUrls?.length && { hasImage: true }),
    ...(m.emailPayload && { emailPayload: m.emailPayload }),
    ...(m.signedImageUrls?.length && { signedImageUrls: m.signedImageUrls }),
  }));
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
      },
    },
    { onConflict: "project_id" }
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
  const [generating, setGenerating] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  /** Object URLs for pending image previews; synced from pendingFiles and revoked on cleanup. */
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]);
  /** When set, the next send is a reply to this message (for context and image edit). */
  const [replyingTo, setReplyingTo] = useState<{ messageIndex: number } | null>(null);

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  /** Tracks current load context so image/video URL fetches only apply when still relevant (avoids hydration lost to effect cleanup). */
  const hydrationContextRef = useRef<{ workspaceId: string; projectId: string } | null>(null);
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
    let cancelled = false;
    loadCreativeStudioChatFromSupabase(workspaceId, projectId).then((loaded) => {
      if (cancelled) return;
      setSelectedTool(null);
      setImageOptions(loaded.imageOptions);
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
          setMessages((prev) =>
            prev.map((m) => {
              if (m.role !== "assistant" || m.tool !== "video" || !m.generationId) return m;
              const r = results.find((x) => x.msg.generationId === m.generationId);
              if (!r) return m;
              const { status, videoUrl, error } = r.res;
              if (status === "completed" && videoUrl) {
                return { ...m, videoUrl, generating: false };
              }
              if (status === "failed") {
                return { ...m, content: error ? `Error: ${error}` : "Video generation failed.", generating: false };
              }
              return { ...m, generating: false, content: m.content || "Video was still processing. It may have completed—check Asset Collection or generate again." };
            })
          );
        }).catch(() => {});
      }
    });
    return () => { cancelled = true; };
  }, [workspaceId, projectId]);

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
    if (!hydrated) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCreativeStudioChatToSupabase(workspaceId, projectId, {
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
      });
    }, 500);
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
  ]);

  useEffect(() => {
    let cancelled = false;
    apiClientFetch<{
      items: Array<{ generationId?: string; videoGenerationId?: string }>;
    }>(`/workspaces/${workspaceId}/asset-collection`)
      .then((res) => {
        if (!cancelled && res.items) {
          const genIds = new Set(
            res.items.map((i) => i.generationId).filter(Boolean) as string[]
          );
          const videoIds = new Set(
            res.items.map((i) => i.videoGenerationId).filter(Boolean) as string[]
          );
          setBookmarkedGenIds(genIds);
          setBookmarkedVideoGenIds(videoIds);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workspaceId]);

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
    }
    if (optionsOpen || toolsOpen || brandPickerOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [optionsOpen, toolsOpen]);

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
    const esc = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const n = Math.min(3, Math.max(1, p.numberOfImages ?? msg.imageUrls?.length ?? 1)) as 1 | 2 | 3;
    const htmlImageUrls = (msg.signedImageUrls?.length ? msg.signedImageUrls : msg.imageUrls) ?? [];
    const urls = htmlImageUrls.slice(0, n).map((u) => u.replace(/&/g, "&amp;").replace(/"/g, "&quot;"));
    const brand = msg.emailBrandSnapshot;
    const websiteUrl = (brand?.website_url?.trim() || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const ctaUrlRaw = p.ctaUrl?.trim() && p.ctaUrl !== "#" ? p.ctaUrl : (brand?.website_url?.trim() || "#");
    const ctaUrl = ctaUrlRaw.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const ctaText = esc(p.ctaText || "Shop Now");
    const headline = esc(p.headline || "");
    const introCopy = esc(p.introCopy || "").replace(/\n/g, "<br />");
    const closingCopy = esc(p.closingCopy || "").replace(/\n/g, "<br />");
    const fontFamily = (brand?.font_styles as { fontFamily?: string } | null)?.fontFamily ?? "Arial,sans-serif";
    const primaryColor = (Array.isArray(brand?.brand_colors) && brand.brand_colors[0]) ? String(brand.brand_colors[0]).trim() : "#000000";
    const ctaBg = /^#[0-9a-fA-F]{3,6}$/.test(primaryColor) ? (primaryColor.length === 4 ? `#${primaryColor[1]}${primaryColor[1]}${primaryColor[2]}${primaryColor[2]}${primaryColor[3]}${primaryColor[3]}` : primaryColor) : "#000000";
    const bodyBg = "#f5f5f5";
    const logoUrl = brand?.brand_logo_url?.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const imageLinkUrl = websiteUrl || (ctaUrl !== "#" ? ctaUrl : "");
    const logoBlock = logoUrl ? `<tr><td align="center" style="padding:20px 25px 10px;"><img src="${logoUrl}" alt="Logo" width="160" style="border:none;display:inline-block;height:auto;max-height:60px;" border="0" /></td></tr>` : "";
    const headlineBlock = headline ? `<tr><td align="left" style="padding:0 25px 10px;font-family:${fontFamily};font-size:22px;font-weight:bold;line-height:1.3;color:#000;"><p style="margin:0;">${headline}</p></td></tr>` : "";
    const introBlock = introCopy ? `<tr><td align="left" style="padding:0 25px 15px;font-family:${fontFamily};font-size:16px;line-height:1.5;color:#333;"><p style="margin:0 0 10px;">${introCopy}</p></td></tr>` : "";
    const closingBlock = closingCopy ? `<tr><td align="left" style="padding:0 25px 15px;font-family:${fontFamily};font-size:16px;line-height:1.5;color:#333;"><p style="margin:0;">${closingCopy}</p></td></tr>` : "";
    const makeImageBlock = (imgUrl: string, alt: string, linkToWebsite: boolean) => {
      if (!imgUrl) return "";
      const imgTag = `<img src="${imgUrl}" alt="${esc(alt)}" width="600" style="border:none;display:block;outline:none;text-decoration:none;height:auto;width:100%;" border="0" />`;
      const wrapped = linkToWebsite && imageLinkUrl ? `<a href="${imageLinkUrl}" target="_blank" style="display:block;">${imgTag}</a>` : imgTag;
      return `<tr><td style="font-size:0;padding:0 0 20px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="width:600px;">${wrapped}</td></tr></table></td></tr>`;
    };
    const ctaBlock = ctaUrl !== "#" ? `<tr><td align="center" style="padding:20px 25px;"><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td align="center" style="border-radius:6px;background:${ctaBg};"><a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background:${ctaBg};color:#fff!important;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;font-family:${fontFamily};">${ctaText}</a></td></tr></table></td></tr>` : "";
    const linkImages = !!imageLinkUrl;
    let bodyRows: string;
    if (n === 1) bodyRows = [logoBlock, headlineBlock, introBlock, makeImageBlock(urls[0], "Email hero", linkImages), closingBlock, ctaBlock].filter(Boolean).join("\n");
    else if (n === 2) {
      const img1 = makeImageBlock(urls[0], "Email image 1", linkImages);
      const img2 = makeImageBlock(urls[1], "Email image 2", linkImages);
      const textCta = (closingCopy ? closingBlock : "") + ctaBlock;
      bodyRows = [logoBlock, headlineBlock, introBlock, img1, textCta, img2, textCta].filter(Boolean).join("\n");
    } else {
      const img1 = makeImageBlock(urls[0], "Email image 1", linkImages);
      const img2 = makeImageBlock(urls[1], "Email image 2", linkImages);
      const img3 = makeImageBlock(urls[2], "Email image 3", linkImages);
      bodyRows = [logoBlock, headlineBlock, introBlock, img1, ctaBlock, img2, closingBlock, img3, ctaBlock].filter(Boolean).join("\n");
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>${esc(p.subjectLine || "Email")}</title>
<style type="text/css">body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}table,td{border-collapse:collapse;}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}</style>
</head>
<body style="margin:0;padding:0;font-family:${fontFamily};background:${bodyBg};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${bodyBg};">
<tr><td align="center" style="padding:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:8px;">
<tbody>
${bodyRows}
</tbody>
</table>
</td></tr>
</table>
</body>
</html>`;
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
        const body: Record<string, unknown> = {
          prompt: userContent,
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
            n[placeholderIndex] = {
              ...m,
              content: fromApi ? fromApi : (m.content ?? ""),
              imageUrls: urls,
              generationId: genRes.generation?.id,
              ...(genIds && { generationIds: genIds }),
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(n));
          return n;
        });
      } else if (intent === "video") {
        if (!videoEnabled) {
          setMessages((prev) => {
            const n = [...prev];
            const m = n[placeholderIndex];
            if (m && m.role === "assistant") {
              n[placeholderIndex] = { ...m, content: "Video generation is not available on your current plan. Upgrade to use this feature.", generating: false };
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
        setGenerating(false);
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
      setMessages((prev) => {
        const n = [...prev];
        const m = n[placeholderIndex];
        if (m && m.role === "assistant") {
          n[placeholderIndex] = { ...m, content: wasCancelled ? "Generation cancelled." : `Error: ${errMsg}`, generating: false };
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
          return { ...m, content: "Generation cancelled.", generating: false };
        });
        queueMicrotask(() => flushSave(next));
        return next;
      });
      setGenerating(false);
    },
    [flushSave]
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
              next[msgIndex] = { ...m, videoUrl: res.videoUrl ?? null, generating: false };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          setGenerating(false);
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
    [workspaceId, projectId, flushSave]
  );

  async function handleSend() {
    const text = prompt.trim();
    if (!text || generating) return;

    const hasCreateTool = selectedTool === "image" || selectedTool === "video" || selectedTool === "email";
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

      const userMsg: CreativeMessage = {
        role: "user",
        content: text,
        timestamp: Date.now(),
        tool: null,
        ...(attachedUrls.length > 0 && { attachedImageUrls: attachedUrls }),
      };
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
            next[msgIndex] = { ...m, content: res.content ?? "", tool: doImageEdit ? "image" : intent ?? null };
          }
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
          const body: Record<string, unknown> = {
            prompt: text,
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
              next[msgIndex] = {
                ...m,
                content: fromApi ? fromApi : (m.content ?? ""),
                imageUrls: urls,
                generationId: genRes.generation?.id,
                ...(genIds && { generationIds: genIds }),
                generating: false,
              };
            }
            queueMicrotask(() => flushSave(next));
            return next;
          });
          setPendingFiles([]);
        } else if (intent === "video") {
          if (!videoEnabled) {
            setMessages((prev) => {
              const next = [...prev];
              const m = next[msgIndex];
              if (m && m.role === "assistant") {
                next[msgIndex] = { ...m, content: "Video generation is not available on your current plan. Upgrade to use this feature.", generating: false };
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
        setMessages((prev) => {
          const next = [...prev];
          const m = next[msgIndex];
          if (m && m.role === "assistant") {
            next[msgIndex] = { ...m, content: wasCancelled ? "Generation cancelled." : `Error: ${errMsg}`, generating: false };
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
        const body: Record<string, unknown> = {
          prompt: text,
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
            next[msgIndex] = {
              ...m,
              content: fromApi ? fromApi : (m.content ?? ""),
              imageUrls: urls,
              generationId: res.generation?.id,
              ...(genIds && { generationIds: genIds }),
              generating: false,
            };
          }
          queueMicrotask(() => flushSave(next));
          return next;
        });
        setPendingFiles([]);
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
              content: "",
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
  const hasCreateTool = selectedTool === "image" || selectedTool === "video" || selectedTool === "email";
  const canSend =
    prompt.trim().length > 0 &&
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
          <span className="text-xs font-medium">Quality</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IMAGE_RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setImageOptions((o) => ({ ...o, resolution: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                imageOptions.resolution === r.value
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
          <SlidersHorizontal className="size-3.5" />
          <span className="text-xs font-medium">Style Variation</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
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
            <span className="text-xs font-medium tabular-nums w-8 shrink-0">
              {imageOptions.temperature.toFixed(1)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Lower = more consistent, higher = more creative
          </p>
        </div>
      </div>
      <div>
        <span className="text-xs font-medium mb-2 block">Variations</span>
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
      {imageOptions.numberOfImages >= 2 && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={imageOptions.carousel}
            onChange={(e) =>
              setImageOptions((o) => ({ ...o, carousel: e.target.checked }))
            }
            className="rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
          />
          <span className="text-xs">One description per slide (Instagram/Facebook carousel)</span>
        </label>
      )}
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
        <span className="text-xs font-medium block mb-2">Number of images</span>
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
            <button
              key={r.value}
              type="button"
              onClick={() => setEmailOptions((o) => ({ ...o, imageQuality: r.value }))}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer",
                emailOptions.imageQuality === r.value
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

  const optionsPanelContent =
    selectedTool === "image"
      ? imageOptionsPanel
      : selectedTool === "video"
        ? videoOptionsPanel
        : selectedTool === "email"
          ? emailOptionsPanel
          : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Select a tool to see options.
              </div>
            );

  /* ─── Shared input card (textarea first, then row: Plus, Options, Tools, Send) ─── */

  const inputActionRow = (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-2 shrink-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex items-center justify-center size-8 rounded-lg transition-colors shrink-0",
            pendingFiles.length > 0
              ? "icon-gradient-brand"
              : "text-[#000000] dark:text-white hover:text-foreground"
          )}
          title="Add images"
        >
          <Plus className="size-4" />
        </button>
        <div className="relative shrink-0" ref={optionsRef}>
          <button
            type="button"
            onClick={() => { setOptionsOpen((v) => !v); setToolsOpen(false); setBrandPickerOpen(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer text-[#000000] dark:text-white hover:text-foreground"
          >
            <SlidersHorizontal className={cn("size-3.5", optionsOpen && "icon-gradient-brand")} />
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
            onClick={() => { setToolsOpen((v) => !v); setOptionsOpen(false); setBrandPickerOpen(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 text-[#000000] dark:text-white hover:text-foreground"
          >
            <Hammer className={cn("size-3.5", (toolsOpen || selectedTool) && "icon-gradient-brand")} />
            {toolsOpen || selectedTool ? <span className="text-gradient-brand">Tools</span> : "Tools"}
            <ChevronDown className={cn("size-3.5", (toolsOpen || selectedTool) && "icon-gradient-brand")} />
          </button>
          {toolsOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-[200px] rounded-xl border border-border bg-card shadow-lg z-50 py-1">
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
                <span className="flex-1">Image generation</span>
                {selectedTool === "image" && <Check className="size-3.5 text-[#000000] dark:text-white" />}
              </button>
              <div className="relative group/video">
                <button
                  type="button"
                  disabled={!videoEnabled}
                  onClick={() => {
                    if (!videoEnabled) return;
                    const next = selectedTool === "video" ? null : "video";
                    setSelectedTool(next);
                    if (next === "video") setVideoOptions(defaultVideoOptions());
                    setToolsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium",
                    !videoEnabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-secondary/60"
                  )}
                >
                  <Video className="size-3.5" />
                  <span className="flex-1">Video generation</span>
                  {videoEnabled && selectedTool === "video" && <Check className="size-3.5 text-[#000000] dark:text-white" />}
                </button>
                {!videoEnabled && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-foreground text-background text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/video:opacity-100 pointer-events-none transition-opacity z-50">
                    Upgrade your Plan to use this Feature
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTool(selectedTool === "email" ? null : "email");
                  setToolsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium",
                  "hover:bg-secondary/60"
                )}
              >
                <Mail className="size-3.5" />
                <span className="flex-1">Email marketing</span>
                {selectedTool === "email" && <Check className="size-3.5 text-[#000000] dark:text-white" />}
              </button>
            </div>
          )}
        </div>
        {showBrandPicker && (
          <div className="relative shrink-0" ref={brandPickerRef}>
            <button
              type="button"
              onClick={() => { setBrandPickerOpen((v) => !v); setToolsOpen(false); setOptionsOpen(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 text-[#000000] dark:text-white hover:text-foreground"
            >
              <Palette className={cn("size-3.5", brandPickerOpen && "icon-gradient-brand")} />
              {brandPickerOpen ? <span className="text-gradient-brand">Brand</span> : "Brand"}
              <ChevronDown className={cn("size-3.5", brandPickerOpen && "icon-gradient-brand")} />
            </button>
            {brandPickerOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-[200px] rounded-xl border border-border bg-card shadow-lg z-50 py-1">
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
                      setActiveProject(p);
                      setBrandPickerOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium",
                      p.id === activeProject.id ? "bg-primary/10 text-primary" : "hover:bg-secondary/60"
                    )}
                  >
                    <span className="truncate flex-1">{p.name}</span>
                    {p.id === activeProject.id && <Check className="size-3 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className="size-8 rounded-lg bg-primary flex items-center justify-center text-white disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default shrink-0"
      >
        <Send className="size-4" />
      </button>
    </div>
  );

  /* ─── Initial empty state (centered like other chats) ────────────────── */

  if (!hasMessages) {
    return (
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col transition-all duration-200">
        <main className="flex-1 flex min-h-0 w-full flex-col items-center justify-start px-4 pt-6 pb-4">
          <div className="w-full max-w-2xl flex flex-col">
            <div className="text-center mb-4 shrink-0">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-2">
                <span className="text-gradient-brand">Creative Studio</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Chat about ad creatives, social media, and marketing — or choose a tool to create images or videos.
              </p>
            </div>
            <div className="relative overflow-visible flex flex-col rounded-2xl border border-border bg-card shadow-none flex flex-col">
              <div className="absolute inset-0 rounded-[inherit] z-10 pointer-events-none">
                <BorderBeam size={80} duration={8} />
              </div>
              <div className="relative z-20 flex flex-col p-4">
                <div className="shrink-0">
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want to create or ask about…"
                    rows={3}
                    className="w-full min-h-[4.5rem] max-h-[9.2rem] resize-none overflow-y-auto bg-transparent px-0 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                </div>
                {(() => {
                  const imageEntries = pendingFiles
                    .map((f, i) => ({ f, pendingIndex: i }))
                    .filter(({ f }) => f.type.startsWith("image/"));
                  if (imageEntries.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
                      {imageEntries.map(({ f, pendingIndex }, j) => (
                        <div
                          key={pendingIndex}
                          className="relative shrink-0 rounded-xl border border-border bg-card overflow-hidden w-[140px]"
                        >
                          <div className="aspect-square bg-muted/30 relative">
                            {pendingPreviewUrls[j] ? (
                              <img
                                src={pendingPreviewUrls[j]}
                                alt=""
                                className="w-full h-full object-cover"
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
                {selectedTool === "image" && imageOptions.carousel && imageOptions.numberOfImages >= 2 && (
                  <div className="space-y-2 border-t border-border/60 pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground">One description per slide (carousel).</p>
                    {Array.from({ length: imageOptions.numberOfImages }, (_, i) => (
                      <div key={i}>
                        <label className="text-[10px] text-muted-foreground block mb-1">Slide {i + 1}</label>
                        <textarea
                          value={imageSlidePrompts[i] ?? ""}
                          onChange={(e) => setImageSlidePromptAt(i, e.target.value)}
                          placeholder={`Description for slide ${i + 1}…`}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {selectedTool === "video" && continuationSlots > 0 && (
                  <div className="space-y-2 border-t border-border/60 pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground">Segment 2 and after — one prompt per segment.</p>
                    {Array.from({ length: continuationSlots }, (_, i) => (
                      <div key={i}>
                        <label className="text-[10px] text-muted-foreground block mb-1">Segment {i + 2} (~7s)</label>
                        <textarea
                          value={continuationPrompts[i] ?? ""}
                          onChange={(e) => setContinuationPromptAt(i, e.target.value)}
                          placeholder={`Dialogue and visuals for segment ${i + 2}…`}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {inputActionRow}
              </div>
            </div>
          </div>
        </main>
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
      </div>
    );
  }

  /* ─── Chat view (has messages) ───────────────────────────────────────── */

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 min-h-screen transition-all duration-200">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-6">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
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
                        const hasImage = msg.tool === "image" && (msg.imageUrls?.length ?? 0) > 0;
                        const hasVideo = !!msg.videoUrl;
                        const hasEmail = msg.tool === "email" && !!msg.emailPayload;
                        const isMediaOnly = hasImage || hasVideo || hasEmail;
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
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </>
                ) : (
                  <>
                    {msg.generating && !msg.content && !msg.imageUrls?.length && !msg.videoUrl && (
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Spinner className="size-4" />
                          <span className="text-xs">
                            {msg.tool === "email" ? "Creating your email creative…" : "Thinking…"}
                          </span>
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
                        const p = msg.emailPayload;
                        const n = Math.min(3, Math.max(1, p.numberOfImages ?? msg.imageUrls?.length ?? 1)) as 1 | 2 | 3;
                        const urls = (msg.imageUrls ?? []).slice(0, n);
                        const brand = msg.emailBrandSnapshot;
                        const fontFamily = (brand?.font_styles as { fontFamily?: string } | null)?.fontFamily ?? "Arial, sans-serif";
                        const primaryColor = (Array.isArray(brand?.brand_colors) && brand.brand_colors[0]) ? String(brand.brand_colors[0]).trim() : "#000000";
                        const ctaBg = /^#[0-9a-fA-F]{3,6}$/.test(primaryColor) ? (primaryColor.length === 4 ? `#${primaryColor[1]}${primaryColor[1]}${primaryColor[2]}${primaryColor[2]}${primaryColor[3]}${primaryColor[3]}` : primaryColor) : "#000000";
                        const logoUrl = brand?.brand_logo_url ?? null;

                        const genIdForSlot = (i: number) => msg.generationIds?.[i] ?? (i === 0 ? msg.generationId : undefined);
                        const renderImageSlot = (url: string | undefined, idx: number, generationIdForSlot: string | undefined) => {
                          if (!url)
                            return (
                              <div key={idx} className="flex items-center justify-center min-h-[180px] bg-muted/40 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                Image loading…
                              </div>
                            );
                          if (failedMediaUrls.includes(url))
                            return (
                              <div key={idx} className="flex flex-col items-center justify-center gap-2 min-h-[180px] p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-border">
                                <span>Link expired</span>
                                <button type="button" onClick={() => setRefetchUrlsTrigger((t) => t + 1)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                                  <RotateCw className="size-3.5" /> Refresh
                                </button>
                              </div>
                            );
                          return (
                            <div key={idx} className="relative group/em rounded-lg overflow-hidden border border-border w-full">
                              <button type="button" className="block w-full cursor-zoom-in text-left" onClick={() => setImagePreviewUrl(url)}>
                                <img src={url} alt="" className="w-full h-auto max-h-[70vh] object-contain" onError={() => setFailedMediaUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))} />
                              </button>
                              <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/em:opacity-100 transition-opacity">
                                {generationIdForSlot && (
                                  <button type="button" onClick={(e) => { e.preventDefault(); handleSaveToCollection(generationIdForSlot); }} className={cn("size-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors", bookmarkedGenIds.has(generationIdForSlot) ? "bg-primary text-primary-foreground" : "bg-black/60 hover:bg-black/80 text-white")} title={bookmarkedGenIds.has(generationIdForSlot) ? "In collection" : "Save to Asset Collection"}>
                                    <Bookmark className={cn("size-4", bookmarkedGenIds.has(generationIdForSlot) && "fill-current")} />
                                  </button>
                                )}
                                <button type="button" onClick={(e) => { e.preventDefault(); downloadImageAsPng(url, `blinkify-email-${idx + 1}-${Date.now()}.png`); }} className="size-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer" title="Download PNG">
                                  <Download className="size-4" />
                                </button>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="w-full max-w-[600px]">
                              <div className="flex items-center gap-2 flex-wrap mb-3">
                                <span className="text-xs text-muted-foreground">Subject:</span>
                                <span className="text-sm font-medium">{p.subjectLine}</span>
                                <button type="button" onClick={() => { navigator.clipboard.writeText(p.subjectLine); toast.success("Subject line copied"); }} className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground shrink-0" title="Copy subject line" aria-label="Copy subject line">
                                  <Copy className="size-3.5" />
                                </button>
                              </div>
                              <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm" style={{ fontFamily }}>
                                <div className="p-5 pb-4 text-center">
                                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-[160px] mx-auto object-contain" />}
                                </div>
                                {p.headline && <h2 className="px-5 pt-1 pb-3 text-xl font-bold text-foreground" style={{ fontFamily }}>{p.headline}</h2>}
                                {p.introCopy && <div className="px-5 pb-4 text-[15px] leading-relaxed text-muted-foreground whitespace-pre-wrap" style={{ fontFamily }}>{p.introCopy}</div>}

                                {n === 1 && (
                                  <>
                                    {renderImageSlot(urls[0], 0, genIdForSlot(0))}
                                    {p.closingCopy && <div className="px-5 py-4 text-[15px] leading-relaxed text-muted-foreground whitespace-pre-wrap" style={{ fontFamily }}>{p.closingCopy}</div>}
                                    {p.ctaUrl && p.ctaUrl !== "#" && <div className="px-5 pb-4 text-center"><a href={p.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-md text-white font-semibold text-sm" style={{ backgroundColor: ctaBg, fontFamily }}>{p.ctaText || "Shop Now"}</a></div>}
                                  </>
                                )}
                                {n === 2 && (
                                  <>
                                    {renderImageSlot(urls[0], 0, genIdForSlot(0))}
                                    {p.closingCopy && <div className="px-5 py-3 text-[15px] leading-relaxed text-muted-foreground whitespace-pre-wrap" style={{ fontFamily }}>{p.closingCopy}</div>}
                                    {p.ctaUrl && p.ctaUrl !== "#" && <div className="px-5 pb-4 text-center"><a href={p.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-md text-white font-semibold text-sm" style={{ backgroundColor: ctaBg, fontFamily }}>{p.ctaText || "Shop Now"}</a></div>}
                                    {renderImageSlot(urls[1], 1, genIdForSlot(1))}
                                    {p.closingCopy && <div className="px-5 py-3 text-[15px] leading-relaxed text-muted-foreground whitespace-pre-wrap" style={{ fontFamily }}>{p.closingCopy}</div>}
                                    {p.ctaUrl && p.ctaUrl !== "#" && <div className="px-5 pb-4 text-center"><a href={p.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-md text-white font-semibold text-sm" style={{ backgroundColor: ctaBg, fontFamily }}>{p.ctaText || "Shop Now"}</a></div>}
                                  </>
                                )}
                                {n === 3 && (
                                  <>
                                    {renderImageSlot(urls[0], 0, genIdForSlot(0))}
                                    {p.ctaUrl && p.ctaUrl !== "#" && <div className="px-5 pb-4 text-center"><a href={p.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-md text-white font-semibold text-sm" style={{ backgroundColor: ctaBg, fontFamily }}>{p.ctaText || "Shop Now"}</a></div>}
                                    {renderImageSlot(urls[1], 1, genIdForSlot(1))}
                                    {p.closingCopy && <div className="px-5 py-3 text-[15px] leading-relaxed text-muted-foreground whitespace-pre-wrap" style={{ fontFamily }}>{p.closingCopy}</div>}
                                    {renderImageSlot(urls[2], 2, genIdForSlot(2))}
                                    {p.ctaUrl && p.ctaUrl !== "#" && <div className="px-5 pb-4 text-center"><a href={p.ctaUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-md text-white font-semibold text-sm" style={{ backgroundColor: ctaBg, fontFamily }}>{p.ctaText || "Shop Now"}</a></div>}
                                  </>
                                )}
                              </div>
                          </div>
                          );
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
                    {msg.imageUrls && msg.imageUrls.length > 0 && !(msg.tool === "email" && msg.emailPayload) && (
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
                                className="w-full h-auto object-cover rounded-2xl"
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
                    {msg.videoUrl && (
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
                        onClick={() => handleRedoResponse(i)}
                        disabled={generating}
                        className="size-8 rounded-full flex items-center justify-center text-[#000000] dark:text-white hover:bg-secondary/60 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                        aria-label="Redo"
                      >
                        <RotateCw className="size-4" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-neutral-800 dark:bg-neutral-700 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/action:opacity-100 transition-opacity z-10">
                        Redo
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
                    <div className="relative group/action">
                      <button
                        type="button"
                        onClick={() => handleReplyToMessage(i)}
                        className="size-8 rounded-full flex items-center justify-center text-[#000000] dark:text-white hover:bg-secondary/60 hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Reply to this response"
                      >
                        <Reply className="size-4" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-neutral-800 dark:bg-neutral-700 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/action:opacity-100 transition-opacity z-10">
                        Reply
                      </span>
                    </div>
                  </div>
                )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar at bottom — sticky so it stays visible while scrolling */}
      <div className="sticky bottom-0 z-10 shrink-0 pt-2 pb-4 w-full max-w-2xl mx-auto">
        <div className="w-full">
          <div className="relative overflow-visible flex flex-col rounded-2xl border border-border bg-card shadow-none">
            <div className="absolute inset-0 rounded-[inherit] z-10 pointer-events-none">
              <BorderBeam size={80} duration={8} />
            </div>
            <div className="relative z-20 flex flex-col p-3">
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
              {(() => {
                const imageEntries = pendingFiles
                  .map((f, i) => ({ f, pendingIndex: i }))
                  .filter(({ f }) => f.type.startsWith("image/"));
                if (imageEntries.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
                    {imageEntries.map(({ f, pendingIndex }, j) => (
                      <div
                        key={pendingIndex}
                        className="relative shrink-0 rounded-xl border border-border bg-card overflow-hidden w-[140px]"
                      >
                        <div className="aspect-square bg-muted/30 relative">
                          {pendingPreviewUrls[j] ? (
                            <img
                              src={pendingPreviewUrls[j]}
                              alt=""
                              className="w-full h-full object-cover"
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
              {selectedTool === "image" && imageOptions.carousel && imageOptions.numberOfImages >= 2 && (
                <div className="space-y-2 border-t border-border/60 pt-2">
                  <p className="text-[10px] font-medium text-muted-foreground">One description per slide.</p>
                  {Array.from({ length: imageOptions.numberOfImages }, (_, i) => (
                    <textarea
                      key={i}
                      value={imageSlidePrompts[i] ?? ""}
                      onChange={(e) => setImageSlidePromptAt(i, e.target.value)}
                      placeholder={`Slide ${i + 1}…`}
                      rows={1}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  ))}
                </div>
              )}
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
              {inputActionRow}
            </div>
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
          <img
            src={imagePreviewUrl}
            alt=""
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
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
    </div>
  );
}
