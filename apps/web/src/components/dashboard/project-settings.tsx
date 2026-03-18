"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Trash2,
  X,
  Upload,
  ChevronDown,
  Plus,
  AlertTriangle,
  Link,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateProject, deleteProject, uploadProjectLogo, setProjectLogoFromUrl, analyzeWebsite } from "@/app/(app)/actions";
import type { Project, BrandFont, FontStyles, FontStyleElement } from "@/lib/api";

/* ─── Constants ───────────────────────────────────────────────────────── */

const PRESET_FONTS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Montserrat",
  "Open Sans",
  "Playfair Display",
  "Lato",
  "Raleway",
  "Manrope",
  "DM Sans",
  "Nunito",
  "Outfit",
  "Source Sans 3",
  "Oswald",
  "Roboto Condensed",
  "Work Sans",
  "Merriweather",
  "PT Sans",
  "Ubuntu",
  "Nunito Sans",
  "Rubik",
  "Bebas Neue",
  "Barlow",
  "Fira Sans",
  "Quicksand",
  "Kanit",
  "Oxygen",
  "Libre Baskerville",
  "Noto Sans",
  "Mukta",
  "Crimson Text",
  "Libre Franklin",
  "Karla",
  "IBM Plex Sans",
  "Space Grotesk",
  "Figtree",
  "Plus Jakarta Sans",
  "Geist",
  "Sora",
  "Syne",
  "Archivo",
  "Red Hat Display",
  "Hind",
  "Josefin Sans",
  "Abel",
  "Bitter",
  "Cormorant Garamond",
  "Exo 2",
  "Inconsolata",
  "Lexend",
  "Lora",
  "Mulish",
  "Noto Serif",
  "Pacifico",
  "Righteous",
  "Titillium Web",
  "Varela Round",
  "Yanone Kaffeesatz",
  "Zilla Slab",
  "Alfa Slab One",
  "Anton",
  "Arimo",
  "Barlow Condensed",
  "Cabin",
  "Comfortaa",
  "Dancing Script",
  "Epilogue",
  "Fraunces",
  "Gloria Hallelujah",
  "Heebo",
  "Jost",
  "League Spartan",
  "Lilita One",
  "Lobster",
  "Martel",
  "Merriweather Sans",
  "M PLUS 1p",
  "Nanum Gothic",
  "Old Standard TT",
  "Overpass",
  "Permanent Marker",
  "Prata",
  "Public Sans",
  "Questrial",
  "Rajdhani",
  "Readex Pro",
  "Recursive",
  "Roboto Mono",
  "Roboto Slab",
  "Satisfy",
  "Schibsted Grotesk",
  "Shadows Into Light",
  "Spectral",
  "Space Mono",
  "Taviraj",
  "Trirong",
  "Urbanist",
  "Volkhov",
  "Wix Madefor Display",
  "Xanh Mono",
  "Yeseva One",
  "Zeyada",
];

const INDUSTRY_OPTIONS = [
  // --- Products & Ecommerce ---
  { id: "food_beverage", label: "Food & Beverage", emoji: "🍔" },
  { id: "coffee_tea", label: "Coffee & Tea", emoji: "☕" },
  { id: "beauty_skincare", label: "Beauty & Skincare", emoji: "✨" },
  { id: "health_supplements", label: "Health & Supplements", emoji: "💊" },
  { id: "fashion_apparel", label: "Fashion & Apparel", emoji: "👗" },
  { id: "jewelry_accessories", label: "Jewelry & Accessories", emoji: "💎" },
  { id: "home_lifestyle", label: "Home & Lifestyle", emoji: "🏠" },
  { id: "sports_fitness", label: "Sports & Fitness", emoji: "💪" },
  { id: "tech_electronics", label: "Tech & Electronics", emoji: "📱" },
  { id: "pet_products", label: "Pet Products", emoji: "🐾" },
  { id: "baby_kids", label: "Baby & Kids", emoji: "🍼" },
  { id: "candles_fragrance", label: "Candles & Fragrance", emoji: "🕯" },
  { id: "drinks_beverages", label: "Drinks & Beverages", emoji: "🥤" },
  { id: "snacks_confectionery", label: "Snacks & Confectionery", emoji: "🍫" },
  // --- Services & Other ---
  { id: "restaurant_cafe", label: "Restaurant & Cafe", emoji: "🍽" },
  { id: "agency_creative", label: "Agency & Creative Services", emoji: "🎨" },
  { id: "professional_services", label: "Professional Services", emoji: "💼" },
  { id: "health_wellness_services", label: "Health & Wellness Services", emoji: "🧘" },
  { id: "fitness_gym", label: "Fitness & Gym", emoji: "🏋" },
  { id: "real_estate", label: "Real Estate", emoji: "🏡" },
  { id: "education_coaching", label: "Education & Coaching", emoji: "🎓" },
  { id: "saas_software", label: "SaaS & Software", emoji: "💻" },
  { id: "retail_local", label: "Retail & Local Business", emoji: "🏪" },
  { id: "other", label: "Other", emoji: "📦" },
];

const SOCIAL_LINK_KEYS = [
  "instagram",
  "tiktok",
  "facebook",
  "x",
  "linkedin",
  "pinterest",
  "youtube",
  "contact_email",
  "address",
] as const;

type SocialLinksState = Partial<Record<(typeof SOCIAL_LINK_KEYS)[number], string>>;

function socialLinksFromProject(raw: unknown): SocialLinksState {
  const o: SocialLinksState = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    for (const k of SOCIAL_LINK_KEYS) {
      const v = r[k];
      o[k] = typeof v === "string" ? v : "";
    }
  }
  return o;
}

function serializeSocialLinksForApi(links: SocialLinksState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SOCIAL_LINK_KEYS) {
    const v = links[k]?.trim();
    if (v) out[k] = v.slice(0, 2048);
  }
  return out;
}

function IconTikTok({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.73a8.19 8.19 0 0 0 4.79 1.52V6.8a4.85 4.85 0 0 1-1.02-.11z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconPinterest({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.236 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.806-2.428 1.808-2.428.852 0 1.264.64 1.264 1.408 0 .858-.546 2.141-.828 3.33-.236.995.499 1.806 1.476 1.806 1.772 0 3.136-1.867 3.136-4.562 0-2.387-1.715-4.054-4.163-4.054-2.833 0-4.497 2.124-4.497 4.32 0 .856.33 1.772.741 2.273a.3.3 0 0 1 .069.286c-.076.313-.244.995-.277 1.134-.044.183-.146.222-.337.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z" />
    </svg>
  );
}

const GRADIENT_LINE_PREFIX = "GRADIENT:";
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
/** Accept GRADIENT:slot:angle or GRADIENT::slot:angle (legacy) or with :hex stops; reject plain user text like "GRADIENT: use blue" */
const GRADIENT_LINE_STARTS = /^GRADIENT:/i;

type ColorSlotGradient = { angle: number; colors: string[] };

const COLOR_SLOT_COUNT = 3;

function parseSlotGradientsFromGuidelines(guidelines: string): { slotGradients: ColorSlotGradient[]; rest: string } {
  const lines = guidelines.split(/\n/);
  const slotGradients: ColorSlotGradient[] = Array.from({ length: COLOR_SLOT_COUNT }, () => ({ angle: 90, colors: [] }));
  const restLines: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!GRADIENT_LINE_STARTS.test(t)) {
      restLines.push(line);
      continue;
    }
    const payload = t.slice(GRADIENT_LINE_PREFIX.length).replace(/^:+/, "").trim();
    const parts = payload.split(":").filter(Boolean);
    const numbers = parts.filter((p) => /^\d+$/.test(p));
    const hexes = parts.filter((h) => HEX_REGEX.test(h));
    if (numbers.length >= 2) {
      const slotIndex = Math.min(COLOR_SLOT_COUNT - 1, Math.max(0, parseInt(numbers[0], 10) || 0));
      const angle = Math.min(360, Math.max(0, parseInt(numbers[1], 10) || 90));
      slotGradients[slotIndex] = { angle, colors: hexes.slice(0, 6) };
    } else {
      restLines.push(line);
    }
  }
  return { slotGradients, rest: restLines.join("\n").trimStart() };
}

function serializeSlotGradientsToGuidelines(slotGradients: ColorSlotGradient[], rest: string): string {
  const lines: string[] = [];
  for (let i = 0; i < COLOR_SLOT_COUNT; i++) {
    const g = slotGradients[i];
    if (!g) continue;
    const validColors = (g.colors ?? []).filter((h) => HEX_REGEX.test(h)).slice(0, 6);
    const angle = Math.min(360, Math.max(0, g.angle ?? 90));
    lines.push([GRADIENT_LINE_PREFIX, i, angle, ...validColors].join(":"));
  }
  return lines.length > 0 ? `${lines.join("\n")}\n${rest}` : rest;
}

/** Parse BRAND_TONE and BRAND_INDUSTRY from guidelines; return rest for main textarea. */
function parseBrandMeta(guidelines: string): { tone: string; industry: string; rest: string } {
  const lines = guidelines.split(/\n/);
  let tone = "";
  let industry = "";
  const restLines: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("BRAND_TONE:")) {
      tone = t.slice("BRAND_TONE:".length).trim();
    } else if (t.startsWith("BRAND_INDUSTRY:")) {
      industry = t.slice("BRAND_INDUSTRY:".length).trim();
    } else {
      restLines.push(line);
    }
  }
  return { tone, industry, rest: restLines.join("\n").trimStart() };
}

function serializeBrandMeta(tone: string, industry: string, rest: string): string {
  const parts: string[] = [];
  if (tone) parts.push(`BRAND_TONE: ${tone}`);
  if (industry) parts.push(`BRAND_INDUSTRY: ${industry}`);
  return parts.length > 0 ? (rest ? `${parts.join("\n")}\n${rest}` : parts.join("\n")) : rest;
}

/* ─── Props ───────────────────────────────────────────────────────────── */

interface Props {
  project: Project;
  workspaceId: string;
  logoUrl?: string | null;
  /** When true, show as "Brand" page with extra placeholder sections and no project-specific back link */
  brandMode?: boolean;
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function ProjectSettings({ project, workspaceId, logoUrl = null, brandMode = false }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [error, setError] = useState("");
  const [newColor, setNewColor] = useState("#FFFFFF");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  /** Logo URL we just applied from "Apply Brand" — shown without router.refresh() so other fields (colors, etc.) are not reverted. */
  const [appliedLogoUrl, setAppliedLogoUrl] = useState<string | null>(null);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [targetAudience, setTargetAudience] = useState(project.target_audience ?? "");
  const [brandColors, setBrandColors] = useState<string[]>(() => {
    const c = project.brand_colors ?? [];
    return [
      c[0] ?? "#000000",
      c[1] ?? "#666666",
      c[2] ?? "#FFFFFF",
    ];
  });
  const [brandFonts, setBrandFonts] = useState<BrandFont[]>(project.brand_fonts ?? []);
  const [fontStyles, setFontStyles] = useState<FontStyles>(project.font_styles ?? {});
  const [brandTone, setBrandTone] = useState("");
  const [brandIndustry, setBrandIndustry] = useState("");
  const [industryPopupOpen, setIndustryPopupOpen] = useState(false);
  const [brandGuidelines, setBrandGuidelines] = useState(() => {
    const g = project.brand_guidelines ?? "";
    const { rest } = parseSlotGradientsFromGuidelines(g);
    const { rest: rest2 } = parseBrandMeta(rest);
    return rest2;
  });
  const [colorSlotModes, setColorSlotModes] = useState<("solid" | "gradient")[]>(() => {
    const { slotGradients } = parseSlotGradientsFromGuidelines(project.brand_guidelines ?? "");
    return Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => (slotGradients[i]?.colors?.length > 1 ? "gradient" : "solid"));
  });
  const [colorSlotGradients, setColorSlotGradients] = useState<ColorSlotGradient[]>(() => {
    const { slotGradients } = parseSlotGradientsFromGuidelines(project.brand_guidelines ?? "");
    return Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => slotGradients[i] ?? { angle: 90, colors: [] });
  });
  const [websiteUrl, setWebsiteUrl] = useState(project.website_url ?? "");
  const [socialLinks, setSocialLinks] = useState<SocialLinksState>(() =>
    socialLinksFromProject(project.social_links)
  );
  const [applyingBrand, setApplyingBrand] = useState(false);
  /** After save we set state from the API response. Skip syncing from project for a short window so router.refresh() / cached server data doesn't overwrite with stale brand_colors. */
  const lastSaveAtRef = useRef<number>(0);
  const SAVE_SYNC_GRACE_MS = 3000;

  // Sync local state when project prop changes (e.g. initial load or navigation).
  // Skip syncing for a short time after save so we don't revert to stale project from refresh.
  useEffect(() => {
    if (lastSaveAtRef.current && Date.now() - lastSaveAtRef.current < SAVE_SYNC_GRACE_MS) {
      return;
    }
    setAppliedLogoUrl(null);
    setName(project.name);
    setDescription(project.description ?? "");
    setTargetAudience(project.target_audience ?? "");
    const c = project.brand_colors ?? [];
    setBrandColors(
      brandMode
        ? [
            c[0] ?? "#000000",
            c[1] ?? "#666666",
            c[2] ?? "#FFFFFF",
          ]
        : c
    );
    setBrandFonts(project.brand_fonts ?? []);
    if (project.font_styles !== undefined) {
      setFontStyles(project.font_styles ?? {});
    }
    const { slotGradients, rest } = parseSlotGradientsFromGuidelines(project.brand_guidelines ?? "");
    const { tone, industry, rest: rest2 } = parseBrandMeta(rest);
    setBrandTone(tone);
    setBrandIndustry(industry);
    setBrandGuidelines(rest2);
    setColorSlotModes(Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => (slotGradients[i]?.colors?.length > 1 ? "gradient" : "solid")));
    setColorSlotGradients(Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => slotGradients[i] ?? { angle: 90, colors: [] }));
    setWebsiteUrl(project.website_url ?? "");
    setSocialLinks(socialLinksFromProject(project.social_links));
  }, [
    brandMode,
    project.name,
    project.description,
    project.target_audience,
    project.brand_colors,
    project.brand_fonts,
    project.font_styles,
    project.brand_guidelines,
    project.website_url,
    project.social_links,
  ]);

  const brandColorsForSave = brandMode
    ? Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => {
        const raw =
          colorSlotModes[i] === "solid"
            ? brandColors[i] ?? "#000000"
            : (colorSlotGradients[i]?.colors?.[0] ?? brandColors[i] ?? "#000000");
        return HEX_REGEX.test(raw) ? raw : "#000000";
      })
    : brandColors.filter((c) => HEX_REGEX.test(c));
  const guidelinesRestForSave = brandMode ? serializeBrandMeta(brandTone, brandIndustry, brandGuidelines) : brandGuidelines;
  const guidelinesForSave = brandMode ? serializeSlotGradientsToGuidelines(colorSlotGradients, guidelinesRestForSave) : brandGuidelines;
  const websiteUrlTrimmed = websiteUrl.trim();
  const hasChanges =
    name !== project.name ||
    description !== (project.description ?? "") ||
    websiteUrlTrimmed !== (project.website_url ?? "") ||
    JSON.stringify(brandColorsForSave) !== JSON.stringify(brandMode ? (project.brand_colors ?? []).slice(0, COLOR_SLOT_COUNT) : (project.brand_colors ?? [])) ||
    (brandMode && (JSON.stringify(colorSlotGradients) !== JSON.stringify(parseSlotGradientsFromGuidelines(project.brand_guidelines ?? "").slotGradients))) ||
    JSON.stringify(brandFonts) !== JSON.stringify(project.brand_fonts ?? []) ||
    JSON.stringify(fontStyles) !== JSON.stringify(project.font_styles ?? {}) ||
    guidelinesForSave !== (project.brand_guidelines ?? "") ||
    JSON.stringify(serializeSocialLinksForApi(socialLinks)) !==
      JSON.stringify(serializeSocialLinksForApi(socialLinksFromProject(project.social_links)));

  /* ── Save ── */

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError((brandMode ? "Brand" : "Project") + " name is required");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Name must be 100 characters or fewer");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (brandMode && appliedLogoUrl && appliedLogoUrl.startsWith("http")) {
        try {
          await setProjectLogoFromUrl(workspaceId, project.id, appliedLogoUrl);
          setAppliedLogoUrl(null);
        } catch {
          toast.error("Logo could not be set from URL; other settings saved.");
        }
      }
      const updatedProject = await updateProject(workspaceId, project.id, {
        name: trimmedName,
        description: description.trim(),
        target_audience: targetAudience.trim() || null,
        brand_colors: brandColorsForSave,
        brand_fonts: brandFonts,
        font_styles: Object.keys(fontStyles).length > 0 ? fontStyles : null,
        brand_guidelines: guidelinesForSave.trim() || null,
        website_url: websiteUrlTrimmed || null,
      });
      lastSaveAtRef.current = Date.now();
      setName(updatedProject.name);
      setDescription(updatedProject.description ?? "");
      setTargetAudience(updatedProject.target_audience ?? "");
      const c = updatedProject.brand_colors ?? [];
      setBrandColors(
        brandMode
          ? [
              c[0] ?? "#000000",
              c[1] ?? "#666666",
              c[2] ?? "#FFFFFF",
            ]
          : c
      );
      setBrandFonts(updatedProject.brand_fonts ?? []);
      if (updatedProject.font_styles !== undefined) {
        setFontStyles((updatedProject.font_styles ?? {}) as FontStyles);
      }
      const { slotGradients, rest } = parseSlotGradientsFromGuidelines(updatedProject.brand_guidelines ?? "");
      const { tone, industry, rest: rest2 } = parseBrandMeta(rest);
      setBrandTone(tone);
      setBrandIndustry(industry);
      setBrandGuidelines(rest2);
      setColorSlotModes(Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => (slotGradients[i]?.colors?.length > 1 ? "gradient" : "solid")));
      setColorSlotGradients(Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => slotGradients[i] ?? { angle: 90, colors: [] }));
      setWebsiteUrl(updatedProject.website_url ?? "");
      setSocialLinks(socialLinksFromProject(updatedProject.social_links));
      toast.success("Settings saved.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ── */

  async function handleDelete() {
    if (deleteInput !== project.name) return;

    setDeleting(true);
    setError("");

    try {
      await deleteProject(workspaceId, project.id);
      toast.success("Project deleted.");
      router.push("/creative-studio");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setError("");
    setAppliedLogoUrl(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      await uploadProjectLogo(workspaceId, project.id, fd);
      setLogoPreview(URL.createObjectURL(file));
      toast.success("Logo updated.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  /* ── Brand helpers ── */

  function setPrimaryColor(hex: string) {
    setBrandColors([hex, brandColors[1] ?? "#666666", brandColors[2] ?? "#FFFFFF"]);
  }
  function setSecondaryColor(hex: string) {
    setBrandColors([brandColors[0] ?? "#000000", hex, brandColors[2] ?? "#FFFFFF"]);
  }
  function setAccentColor(hex: string) {
    setBrandColors([brandColors[0] ?? "#000000", brandColors[1] ?? "#666666", hex]);
  }

  function setSlotMode(slotIndex: number, mode: "solid" | "gradient") {
    setColorSlotModes((prev) => {
      const next = [...prev];
      next[slotIndex] = mode;
      return next;
    });
    if (mode === "gradient") {
      setColorSlotGradients((prev) => {
        const next = [...prev];
        const cur = next[slotIndex];
        next[slotIndex] = { angle: cur?.angle ?? 90, colors: (cur?.colors?.length ? cur.colors : [brandColors[slotIndex] ?? "#000000"]).slice(0, 6) };
        return next;
      });
    }
  }
  function setSlotGradientAngle(slotIndex: number, angle: number) {
    setColorSlotGradients((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...(next[slotIndex] ?? { angle: 90, colors: [] }), angle };
      return next;
    });
  }
  function setSlotGradientColor(slotIndex: number, colorIndex: number, hex: string) {
    const validHex = HEX_REGEX.test(hex) ? hex : (colorSlotGradients[slotIndex]?.colors?.[colorIndex] ?? "#000000");
    setColorSlotGradients((prev) => {
      const next = prev.map((g) => ({ ...g, colors: [...(g.colors ?? [])] }));
      const colors = [...(next[slotIndex]?.colors ?? [])];
      colors[colorIndex] = validHex;
      next[slotIndex] = { ...(next[slotIndex] ?? { angle: 90, colors: [] }), colors };
      return next;
    });
  }
  function addSlotGradientColor(slotIndex: number) {
    setColorSlotGradients((prev) => {
      const next = prev.map((g) => ({ ...g, colors: [...(g.colors ?? [])] }));
      const arr = next[slotIndex]?.colors ?? [];
      if (arr.length >= 6) return prev;
      const toAdd = arr.length > 0 ? arr[arr.length - 1]! : "#000000";
      next[slotIndex] = { ...(next[slotIndex] ?? { angle: 90, colors: [] }), colors: [...arr, toAdd] };
      return next;
    });
  }
  function removeSlotGradientColor(slotIndex: number, colorIndex: number) {
    setColorSlotGradients((prev) => {
      const next = prev.map((g) => ({ ...g, colors: [...(g.colors ?? [])] }));
      const colors = (next[slotIndex]?.colors ?? []).filter((_, i) => i !== colorIndex);
      next[slotIndex] = { ...(next[slotIndex] ?? { angle: 90, colors: [] }), colors };
      return next;
    });
  }

  function addColor() {
    if (brandColors.length >= 6) return;
    if (brandColors.includes(newColor)) return;
    setBrandColors([...brandColors, newColor]);
  }

  function removeColor(hex: string) {
    setBrandColors(brandColors.filter((c) => c !== hex));
  }

  function addPresetFont(fontName: string) {
    if (brandFonts.some((f) => f.name === fontName)) return;
    setBrandFonts([...brandFonts, { name: fontName, type: "preset" }]);
  }

  function removeFont(fontName: string) {
    setBrandFonts(brandFonts.filter((f) => f.name !== fontName));
  }

  async function handleApplyBrand() {
    const url = websiteUrl.trim();
    if (!url) {
      setError("Enter a website URL above, then click Apply Brand.");
      return;
    }
    setError("");
    setApplyingBrand(true);
    lastSaveAtRef.current = Date.now();
    try {
      const result = await analyzeWebsite(workspaceId, project.id, url);
      const suggestions = result.suggestions;
      const extract = result.extract ?? {};
      if (
        suggestions.brand_name &&
        (!name || name.trim() === "" || name === "My Brand")
      ) {
        setName(suggestions.brand_name.slice(0, 100));
      }
      const descriptionText = suggestions.description?.trim() || "Brand project for ad creatives.";
      const guidelinesText = suggestions.brand_guidelines?.trim() || "Professional tone. Clear visuals.";
      setDescription(descriptionText);
      setBrandGuidelines(guidelinesText);
      if (typeof suggestions.brand_tone === "string" && suggestions.brand_tone.trim()) setBrandTone(suggestions.brand_tone.trim());
      if (typeof suggestions.brand_industry === "string" && suggestions.brand_industry.trim()) setBrandIndustry(suggestions.brand_industry.trim());
      if (typeof suggestions.target_audience === "string" && suggestions.target_audience.trim()) setTargetAudience(suggestions.target_audience.trim().slice(0, 500));
      const primaryFont = suggestions.primary_font ?? extract.primaryFont;
      if (typeof primaryFont === "string" && primaryFont.trim()) {
        setBrandFonts([{ name: primaryFont.trim(), type: "preset" }]);
      }
      const neutrals = ["#000000", "#666666", "#FFFFFF"];
      const colors = suggestions.suggestedColors.filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 3);
      const padded = colors.length >= 3 ? colors : [...colors, ...neutrals].slice(0, 3);
      setBrandColors(padded);
      setColorSlotModes(Array.from({ length: COLOR_SLOT_COUNT }, () => "solid"));
      setColorSlotGradients(Array.from({ length: COLOR_SLOT_COUNT }, (_, i) => ({ angle: 90, colors: padded[i] ? [padded[i]] : [] })));
      const extractedLogoUrl = result.extract?.suggestedLogoUrl?.trim();
      if (extractedLogoUrl && extractedLogoUrl.startsWith("http")) {
        setAppliedLogoUrl(extractedLogoUrl);
      }
      toast.success(
        extractedLogoUrl
          ? "Brand options and logo applied. Review below and click Save Changes to save."
          : "Brand options applied. Review the fields below and click Save Changes to save."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply brand from website");
      toast.error(err instanceof Error ? err.message : "Failed to apply brand");
    } finally {
      setApplyingBrand(false);
    }
  }

  return (
    <div>
      {brandMode ? (
        /* ─── Brand page: wide, 3-column cards ───────────────────────── */
        <div className="p-6 lg:p-10">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-6">
              {error}
            </div>
          )}

          {/* Website link + Apply Brand */}
          <div className="w-full max-w-6xl mx-auto mb-8 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Link className="size-4 text-foreground shrink-0" />
              <h3 className="text-base font-semibold text-foreground">Website link</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Your store or brand URL. Used for email marketing: CTA buttons and clickable images will link to this URL. Click Apply Brand to pull description, guidelines, and colors from this URL into the options below.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourstore.com"
                className="flex-1 min-w-[220px] max-w-xl rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={applyingBrand}
              />
              <button
                type="button"
                onClick={handleApplyBrand}
                disabled={applyingBrand || !websiteUrl.trim()}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                {applyingBrand ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Apply Brand"
                )}
              </button>
            </div>
          </div>

          {/* Bento grid: explicit placement, no overlapping cells; rows expand to content */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6 [grid-auto-rows:minmax(10rem,auto)]">
            {/* Row 1-3: Logo (cols 1-4) */}
            <BrandCard
              label="Logo"
              className="col-start-1 col-end-5 row-start-1 row-span-3 min-h-[14rem]"
              footerRight={
                (logoUrl || logoPreview || appliedLogoUrl) ? (
                  <label className="flex items-center justify-end gap-2 text-sm text-foreground hover:opacity-80 transition-opacity cursor-pointer">
                    {uploadingLogo ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="size-4" />
                        Upload Logo
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      disabled={uploadingLogo}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : undefined
              }
            >
              {(logoUrl || logoPreview || appliedLogoUrl) ? (
                <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl bg-[#ffffff] dark:bg-[#000000] overflow-hidden p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview ?? appliedLogoUrl ?? logoUrl ?? ""}
                    alt="Logo"
                    className="max-w-full max-h-full w-full h-full object-contain"
                  />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center flex-1 gap-2 px-4 py-6 rounded-xl border border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer min-h-[120px]">
                  {uploadingLogo ? (
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="size-8 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground text-center">
                    Upload logo (PNG, JPG, WebP, GIF)
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </BrandCard>

            {/* Row 4: Brand Name (cols 1-2) */}
            <BrandCard label="Brand Name" className="col-start-1 col-end-3 row-start-4" footerRight={`${name.length}/100`}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent text-xl font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none py-1"
                placeholder="Your brand name"
                maxLength={100}
              />
            </BrandCard>

            {/* Row 4: Website link for email CTAs (cols 3-5) */}
            <BrandCard label="Website link" className="col-start-3 col-end-5 row-start-4" footerRight="For email CTAs">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourstore.com"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-1 border-b border-transparent hover:border-border focus:border-primary/50 transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-2">Used for link and CTA buttons in marketing emails. Save changes to apply.</p>
            </BrandCard>

            {/* Row 1-2: Colors (cols 5-6) */}
            <BrandCard label="Colors" className="col-start-5 col-end-7 row-start-1 row-span-2">
              <div className="flex flex-col gap-6 overflow-y-auto min-h-0 flex-1 pr-1">
                {[
                  { label: "Primary", color: brandColors[0] ?? "#000000", setColor: setPrimaryColor, slotIndex: 0 },
                  { label: "Secondary", color: brandColors[1] ?? "#666666", setColor: setSecondaryColor, slotIndex: 1 },
                  { label: "Accent", color: brandColors[2] ?? "#FFFFFF", setColor: setAccentColor, slotIndex: 2 },
                ].map(({ label, color, setColor, slotIndex }) => (
                  <div key={slotIndex} className="shrink-0 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-foreground shrink-0">{label}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSlotMode(slotIndex, "solid")}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${colorSlotModes[slotIndex] === "solid" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground dark:text-white hover:bg-muted"}`}
                        >
                          Solid
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlotMode(slotIndex, "gradient")}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${colorSlotModes[slotIndex] === "gradient" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground dark:text-white hover:bg-muted"}`}
                        >
                          Gradient
                        </button>
                      </div>
                    </div>
                    {colorSlotModes[slotIndex] === "solid" ? (
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border cursor-pointer p-0 appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-lg"
                        style={{ background: color }}
                      />
                    ) : (
                      <div className="space-y-3">
                        {/* Color stops above the gradient bar; remove (x) above stop on hover */}
                        <div className="space-y-2 w-full">
                          <div className="flex items-end justify-between gap-0.5 w-full px-0.5">
                            {(colorSlotGradients[slotIndex]?.colors ?? []).map((hex, i) => (
                              <div key={i} className="group relative flex flex-col items-center">
                                {(colorSlotGradients[slotIndex]?.colors ?? []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSlotGradientColor(slotIndex, i)}
                                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Remove stop"
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}
                                <input
                                  type="color"
                                  value={hex}
                                  onChange={(e) => setSlotGradientColor(slotIndex, i, e.target.value)}
                                  className="size-7 rounded-full border-2 border-border shadow-sm cursor-pointer p-0 shrink-0 appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
                                  style={{ background: hex }}
                                  title={`Color stop ${i + 1}`}
                                />
                              </div>
                            ))}
                            {((colorSlotGradients[slotIndex]?.colors ?? []).length < 6) && (
                              <button
                                type="button"
                                onClick={() => addSlotGradientColor(slotIndex)}
                                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted shrink-0"
                              >
                                Add
                              </button>
                            )}
                          </div>
                          <div
                            className="h-10 w-full rounded-lg border border-border overflow-hidden shrink-0"
                            style={{
                              background:
                                (colorSlotGradients[slotIndex]?.colors ?? []).length > 0
                                  ? `linear-gradient(${colorSlotGradients[slotIndex]?.angle ?? 90}deg, ${(colorSlotGradients[slotIndex]?.colors ?? []).join(", ")})`
                                  : "linear-gradient(90deg, #e5e5e5 0%, #d4d4d4 100%)",
                            }}
                          />
                        </div>
                        {/* Angle: how the gradient flows */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground shrink-0">Angle</label>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={colorSlotGradients[slotIndex]?.angle ?? 90}
                            onChange={(e) => setSlotGradientAngle(slotIndex, Number(e.target.value))}
                            className="flex-1 h-2 rounded-full appearance-none bg-muted accent-primary"
                          />
                          <span className="text-xs text-muted-foreground w-8 tabular-nums">
                            {colorSlotGradients[slotIndex]?.angle ?? 90}°
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </BrandCard>

            {/* Row 3: Target Audience (cols 5-6) */}
            <BrandCard label="Target Audience" className="col-start-5 col-end-7 row-start-3" footerRight={`${targetAudience.length}/200`}>
              <textarea
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                maxLength={200}
                rows={2}
                className="flex-1 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none resize-none py-1"
                placeholder="e.g. Young professionals aged 25-35 interested in sustainable fashion"
              />
            </BrandCard>

            {/* Row 4: Typography (cols 3-4) — same height as Brand Name */}
            <BrandCard
              label="Typography"
              className="col-start-3 col-end-5 row-start-4"
              footerRight={
                <label className="flex items-center justify-end gap-2 text-sm text-foreground hover:opacity-80 transition-opacity cursor-pointer">
                  <Upload className="size-4" />
                  Upload Font
                  <input
                    type="file"
                    accept=".woff2,.ttf,.otf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const fontName = file.name.replace(/\.\w+$/, "");
                        setBrandFonts([{ name: fontName, type: "custom" }]);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              }
            >
              <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-foreground block">Font</span>
                  <select
                    value={brandFonts[0]?.type === "preset" ? brandFonts[0].name : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBrandFonts(v ? [{ name: v, type: "preset" }] : []);
                    }}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select font…</option>
                    {((() => {
                      const cur = brandFonts[0]?.name;
                      const options = cur && !PRESET_FONTS.includes(cur) ? [cur, ...PRESET_FONTS] : PRESET_FONTS;
                      return options.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ));
                    })())}
                  </select>
                </div>
              </div>
            </BrandCard>

            <div className="col-span-6 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">Social & Contact Links</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Used in email footers and campaign assets
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    {
                      key: "instagram" as const,
                      label: "Instagram",
                      Icon: Instagram,
                      placeholder: "https://instagram.com/yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "tiktok" as const,
                      label: "TikTok",
                      Icon: IconTikTok,
                      placeholder: "https://tiktok.com/@yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "facebook" as const,
                      label: "Facebook",
                      Icon: Facebook,
                      placeholder: "https://facebook.com/yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "x" as const,
                      label: "X (Twitter)",
                      Icon: IconX,
                      placeholder: "https://x.com/yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "linkedin" as const,
                      label: "LinkedIn",
                      Icon: Linkedin,
                      placeholder: "https://linkedin.com/company/yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "pinterest" as const,
                      label: "Pinterest",
                      Icon: IconPinterest,
                      placeholder: "https://pinterest.com/yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "youtube" as const,
                      label: "YouTube",
                      Icon: Youtube,
                      placeholder: "https://youtube.com/@yourbrand",
                      type: "url" as const,
                    },
                    {
                      key: "contact_email" as const,
                      label: "Contact Email",
                      Icon: Mail,
                      placeholder: "hello@yourbrand.com",
                      type: "email" as const,
                    },
                    {
                      key: "address" as const,
                      label: "Address",
                      Icon: MapPin,
                      placeholder: "123 Main St, City, State",
                      type: "text" as const,
                    },
                  ] as const
                ).map(({ key, label, Icon, placeholder, type }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-2">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      {label}
                    </label>
                    <input
                      type={type}
                      value={socialLinks[key] ?? ""}
                      onChange={(e) =>
                        setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={placeholder}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Row 4-5: Brand Guidelines (cols 5-6) — long, next to Typography */}
            <BrandCard label="Brand Guidelines" className="col-start-5 col-end-7 row-start-4 row-span-2 min-h-[12rem]" footerRight={`${brandGuidelines.length}/500`}>
              <div className="flex flex-col flex-1 min-h-[10rem]">
                <textarea
                  placeholder="e.g. Always use uppercase headlines. Keep visuals minimal…"
                  value={brandGuidelines}
                  onChange={(e) => setBrandGuidelines(e.target.value)}
                  maxLength={500}
                  className="flex-1 min-h-[10rem] w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-y py-1"
                />
              </div>
            </BrandCard>

            {/* Row 5: Description (cols 1-2) | Brand tone (cols 3-4) — single row, shorter */}
            <BrandCard label="Description" className="col-start-1 col-end-3 row-start-5" footerRight={`${description.length}/500`}>
              <div className="flex flex-col flex-1 min-h-0">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="flex-1 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-y py-1 min-h-0"
                  placeholder="What your brand does and who it’s for…"
                />
              </div>
            </BrandCard>
            <BrandCard label="Brand tone / industry" className="col-start-3 col-end-5 row-start-5">
              <p className="text-xs text-muted-foreground mb-4">Helps AI match voice and style to your brand.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">Tone</label>
                  <input
                    type="text"
                    value={brandTone}
                    onChange={(e) => setBrandTone(e.target.value)}
                    placeholder="e.g. Premium, Trustworthy, Playful"
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="mt-1.5">
                  <label className="text-xs font-medium text-foreground block mb-1.5">Industry</label>
                  <button
                    type="button"
                    onClick={() => setIndustryPopupOpen(true)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {brandIndustry ? (
                        <>
                          <span aria-hidden className="shrink-0">{INDUSTRY_OPTIONS.find((o) => o.label === brandIndustry)?.emoji ?? "📦"}</span>
                          <span className="truncate">{brandIndustry}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Select industry…</span>
                      )}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                  {industryPopupOpen &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
                          onClick={() => setIndustryPopupOpen(false)}
                          aria-hidden
                        />
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                          <div
                            className="relative rounded-2xl border border-border bg-card shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="industry-popup-title"
                          >
                            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                              <h2 id="industry-popup-title" className="text-lg font-semibold text-foreground">
                                Select industry
                              </h2>
                              <button
                                type="button"
                                onClick={() => setIndustryPopupOpen(false)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                aria-label="Close"
                              >
                                <X className="size-5" />
                              </button>
                            </div>
                            <div className="p-4 grid grid-cols-1 gap-2 min-h-0 flex-1 overflow-y-auto">
                              <div className="col-span-full py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Products & Ecommerce
                              </div>
                              {INDUSTRY_OPTIONS.slice(0, 14).map((opt) => {
                                const isSelected = brandIndustry === opt.label;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                      setBrandIndustry(opt.label);
                                      setIndustryPopupOpen(false);
                                    }}
                                    className={cn(
                                      "w-full h-11 rounded-lg border px-3 text-sm text-left flex items-center gap-2 transition-colors",
                                      isSelected
                                        ? "border-primary bg-primary/10 text-foreground font-medium"
                                        : "border-border bg-background hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    <span aria-hidden className="shrink-0">{opt.emoji}</span>
                                    <span className="truncate">{opt.label}</span>
                                  </button>
                                );
                              })}
                              <div className="col-span-full py-1.5 pt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Services & Other Businesses
                              </div>
                              {INDUSTRY_OPTIONS.slice(14).map((opt) => {
                                const isSelected = brandIndustry === opt.label;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                      setBrandIndustry(opt.label);
                                      setIndustryPopupOpen(false);
                                    }}
                                    className={cn(
                                      "w-full h-11 rounded-lg border px-3 text-sm text-left flex items-center gap-2 transition-colors",
                                      isSelected
                                        ? "border-primary bg-primary/10 text-foreground font-medium"
                                        : "border-border bg-background hover:bg-muted/50 text-foreground"
                                    )}
                                  >
                                    <span aria-hidden className="shrink-0">{opt.emoji}</span>
                                    <span className="truncate">{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                </div>
              </div>
            </BrandCard>

          </div>
          <div className="w-full max-w-6xl mx-auto mt-8 grid grid-cols-6 gap-6">
            <div className="col-start-3 col-span-2 flex justify-center">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="h-10 px-6 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin inline-block mr-2 align-middle" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Project settings: narrow layout ─────────────────────────── */
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Edit your project details and brand identity.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Section title="General">
            <Field label="Project Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">{name.length}/100</p>
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </Field>

            <Field label="Website link">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourstore.com"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1">Used for email marketing: CTA buttons and clickable images link here.</p>
            </Field>
          </Section>

          <Section title="Brand Identity">
          {/* Colors */}
          <Field label={brandMode ? "Colors" : "Brand Colors"}>
            <div className="flex items-center gap-2 flex-wrap">
              {brandColors.map((c) => (
                <button
                  key={c}
                  onClick={() => removeColor(c)}
                  className="size-9 rounded-lg border border-border relative group cursor-pointer transition-transform hover:scale-105"
                  style={{ backgroundColor: c }}
                  title={`Remove ${c}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-lg transition-opacity">
                    <X className="size-3.5 text-white" />
                  </span>
                </button>
              ))}
              {brandColors.length < 6 && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="size-9 rounded-lg border border-border cursor-pointer p-0 bg-transparent"
                  />
                  <button
                    onClick={addColor}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-secondary/50"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </Field>

          {/* Fonts */}
          <Field label="Fonts">
            {brandFonts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {brandFonts.map((f) => (
                  <span
                    key={f.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium"
                  >
                    {f.name}
                    <button
                      onClick={() => removeFont(f.name)}
                      className="hover:text-destructive transition-colors cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addPresetFont(e.target.value);
                }}
                className="appearance-none h-9 w-full rounded-lg border border-input bg-background px-3 pr-8 text-xs focus:outline-none cursor-pointer"
              >
                <option value="">Select a font…</option>
                {PRESET_FONTS.filter((f) => !brandFonts.some((sf) => sf.name === f)).map(
                  (f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  )
                )}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Plus className="size-3" />
              Upload custom font (.woff2, .ttf, .otf)
              <input
                type="file"
                accept=".woff2,.ttf,.otf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const fontName = file.name.replace(/\.\w+$/, "");
                    if (!brandFonts.some((f) => f.name === fontName)) {
                      setBrandFonts([...brandFonts, { name: fontName, type: "custom" }]);
                    }
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </Field>

          {/* Font styling for ad creatives */}
          <Field label="Font styling (headline, CTA, description)">
            <p className="text-xs text-muted-foreground mb-3">
              Control weight, color, and size for text elements in generated ad creatives.
            </p>
            <div className="space-y-4">
              {(["headline", "cta", "description"] as const).map((key) => (
                <FontStyleRow
                  key={key}
                  label={key === "headline" ? "Headline" : key === "cta" ? "CTA / Button" : "Description / Subhead"}
                  value={fontStyles[key]}
                  onChange={(v) => setFontStyles((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
          </Field>

          {/* Logo */}
          <Field label={brandMode ? "Logo(s)" : "Brand Logo"}>
            {(logoUrl || logoPreview || appliedLogoUrl) ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
                <div className="size-14 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview ?? appliedLogoUrl ?? logoUrl ?? ""}
                    alt="Logo"
                    className="size-14 object-contain"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {uploadingLogo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Replace logo
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer">
                {uploadingLogo ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="size-4 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  Upload logo (PNG, JPG, WebP, GIF)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </Field>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Social & Contact Links</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Used in email footers and campaign assets
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { key: "instagram" as const, label: "Instagram", Icon: Instagram, placeholder: "https://instagram.com/yourbrand", type: "url" as const },
                  { key: "tiktok" as const, label: "TikTok", Icon: IconTikTok, placeholder: "https://tiktok.com/@yourbrand", type: "url" as const },
                  { key: "facebook" as const, label: "Facebook", Icon: Facebook, placeholder: "https://facebook.com/yourbrand", type: "url" as const },
                  { key: "x" as const, label: "X (Twitter)", Icon: IconX, placeholder: "https://x.com/yourbrand", type: "url" as const },
                  { key: "linkedin" as const, label: "LinkedIn", Icon: Linkedin, placeholder: "https://linkedin.com/company/yourbrand", type: "url" as const },
                  { key: "pinterest" as const, label: "Pinterest", Icon: IconPinterest, placeholder: "https://pinterest.com/yourbrand", type: "url" as const },
                  { key: "youtube" as const, label: "YouTube", Icon: Youtube, placeholder: "https://youtube.com/@yourbrand", type: "url" as const },
                  { key: "contact_email" as const, label: "Contact Email", Icon: Mail, placeholder: "hello@yourbrand.com", type: "email" as const },
                  { key: "address" as const, label: "Address", Icon: MapPin, placeholder: "123 Main St, City, State", type: "text" as const },
                ] as const
              ).map(({ key, label, Icon, placeholder, type }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    {label}
                  </label>
                  <input
                    type={type}
                    value={socialLinks[key] ?? ""}
                    onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Guidelines */}
          <Field label="Brand Guidelines">
            <textarea
              placeholder="e.g. Tone is energetic and youthful. Always use uppercase headlines…"
              value={brandGuidelines}
              onChange={(e) => setBrandGuidelines(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </Field>
        </Section>

        {/* ─── Placeholder sections (Brand mode only) ────────────────── */}
        {brandMode && (
          <>
            <Section title="Product images">
              <p className="text-sm text-muted-foreground py-2">Coming soon. Upload product photos for the AI to reference.</p>
            </Section>
            <Section title="Brand tone / industry">
              <p className="text-sm text-muted-foreground py-2">Coming soon. Set tone and industry for more consistent outputs.</p>
            </Section>
          </>
        )}

        {/* ─── Danger Zone ─────────────────────────────────────────── */}
        {!brandMode && (
        <Section title="Danger Zone" variant="danger">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-destructive">Delete Project</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  This will move the project to trash. It will be permanently deleted after 30 days.
                  All assets and generations will be lost.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded-xl hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    Delete this project
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-foreground">
                      Type <strong>{project.name}</strong> to confirm:
                    </p>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder={project.name}
                      autoFocus
                      className="flex h-10 w-full rounded-xl border border-destructive/30 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-destructive/50 transition-colors"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDelete}
                        disabled={deleteInput !== project.name || deleting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-xl transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                      >
                        {deleting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        {deleting ? "Deleting…" : "Delete permanently"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteInput("");
                        }}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Section>
        )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

const FONT_WEIGHT_OPTIONS: { value: FontStyleElement["weight"]; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
];

const FONT_SIZE_OPTIONS: { value: FontStyleElement["size"]; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

function FontStyleRow({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value?: FontStyleElement | null;
  onChange: (v: FontStyleElement | null) => void;
  /** When true, no border, tighter spacing for use inside Typography card */
  compact?: boolean;
}) {
  const weight = value?.weight ?? "";
  const color = value?.color ?? "#000000";
  const size = value?.size ?? "";

  const update = (k: keyof FontStyleElement, v: string) => {
    if (!v) {
      const next = { ...value };
      delete next[k];
      onChange(Object.keys(next).length > 0 ? next : null);
    } else {
      onChange({ ...value, [k]: v } as FontStyleElement);
    }
  };

  return (
    <div
      className={
        compact
          ? "py-2 space-y-1.5 first:pt-0 last:pb-0"
          : "rounded-lg border border-border bg-card/30 p-3 space-y-2"
      }
    >
      <span className="text-xs font-medium text-foreground block">{label}</span>
      <div className={compact ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-3 gap-2"}>
        <select
          value={weight}
          onChange={(e) => update("weight", e.target.value)}
          className={compact ? "h-7 rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" : "h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"}
        >
          <option value="">Weight</option>
          {FONT_WEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={color}
            onChange={(e) => update("color", e.target.value)}
            className={compact ? "size-7 rounded border border-input cursor-pointer p-0 bg-transparent shrink-0" : "size-8 rounded border border-input cursor-pointer p-0 bg-transparent"}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">Color</span>
        </div>
        <select
          value={size}
          onChange={(e) => update("size", e.target.value)}
          className={compact ? "h-7 rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" : "h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"}
        >
          <option value="">Size</option>
          {FONT_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Section({
  title,
  variant = "default",
  children,
}: {
  title: string;
  variant?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className={cn(
          "text-base font-semibold mb-5",
          variant === "danger" ? "text-destructive" : ""
        )}
      >
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function BrandCard({
  label,
  children,
  className,
  footerRight,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  footerRight?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card overflow-hidden flex flex-col min-h-[160px] shadow-sm",
        className
      )}
    >
      <div className="flex-1 p-5 min-h-0 flex flex-col">{children}</div>
      <div className="flex items-center justify-between px-5 pb-4 pt-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {footerRight != null ? <span className="text-sm text-muted-foreground text-right">{footerRight}</span> : null}
      </div>
    </div>
  );
}
