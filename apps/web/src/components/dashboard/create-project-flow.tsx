"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  X,
  Upload,
  ChevronDown,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createProject, uploadProjectLogo, type CreateProjectPayload } from "@/app/(app)/actions";
import type { BrandFont } from "@/lib/api";
import Link from "next/link";

/* ─── Constants ───────────────────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: "Brand Name" },
  { id: 2, label: "Description" },
  { id: 3, label: "Brand Identity" },
] as const;

const PRESET_FONTS = [
  "Inter", "Poppins", "Roboto", "Montserrat", "Open Sans",
  "Playfair Display", "Lato", "Raleway", "Manrope", "DM Sans",
  "Nunito", "Outfit",
];

/* ─── Types ───────────────────────────────────────────────────────────── */

interface FormData {
  name: string;
  description: string;
  brand_colors: string[];
  brand_fonts: BrandFont[];
  brand_logo: File | null;
  brand_guidelines: string;
}

interface Props {
  workspaceId: string;
  /** After creating, redirect here instead of /projects/:id */
  redirectToAfterCreate?: string;
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function CreateProjectFlow({ workspaceId, redirectToAfterCreate }: Props) {
  const router = useRouter();

  // highestUnlocked = the furthest step the user has reached (1-indexed)
  // activeStep = which step is currently expanded for editing
  const [highestUnlocked, setHighestUnlocked] = useState(1);
  const [activeStep, setActiveStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [newColor, setNewColor] = useState("#007AFF");

  const [form, setForm] = useState<FormData>({
    name: "",
    description: "",
    brand_colors: [],
    brand_fonts: [],
    brand_logo: null,
    brand_guidelines: "",
  });

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const updateForm = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  }, [error]);

  /* ── Validation ── */

  function validateStep(step: number): boolean {
    if (step === 1) {
      const trimmed = form.name.trim();
      if (!trimmed) { setError("Brand name is required"); return false; }
      if (trimmed.length > 100) { setError("Name must be 100 characters or fewer"); return false; }
    }
    if (step === 2 && !form.description.trim()) {
      setError("Brand description is required");
      return false;
    }
    return true;
  }

  /* ── Continue: validate current step, unlock next ── */

  function handleContinue(step: number) {
    if (!validateStep(step)) return;
    setError("");

    const next = step + 1;
    if (next > highestUnlocked) setHighestUnlocked(next);
    setActiveStep(next);

    // Scroll to next step
    setTimeout(() => {
      stepRefs.current[next - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  /* ── Click on a step indicator to expand it (only if unlocked) ── */

  function goToStep(step: number) {
    if (step > highestUnlocked) return;
    setActiveStep(step);
    setError("");
    setTimeout(() => {
      stepRefs.current[step - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  /* ── Submit ── */

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      const payload: CreateProjectPayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        brand_colors: form.brand_colors,
        brand_fonts: form.brand_fonts,
        brand_logo: null,
        brand_guidelines: form.brand_guidelines.trim() || null,
      };

      const project = await createProject(workspaceId, payload);

      if (form.brand_logo) {
        const logoFd = new FormData();
        logoFd.append("logo", form.brand_logo);
        await uploadProjectLogo(workspaceId, project.id, logoFd);
      }

      toast.success("Brand created.");
      router.push(redirectToAfterCreate ?? `/projects/${project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create brand");
      setSubmitting(false);
    }
  }

  /* ── Gradient fill: how far down the line we've progressed ── */

  const progressPercent =
    highestUnlocked >= STEPS.length
      ? 100
      : ((highestUnlocked - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="pb-20">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-6 py-3">
          <Link
            href="/creative-studio"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <h1 className="text-sm font-semibold">Set up your brand</h1>
          <div className="w-16" /> {/* spacer for centering */}
        </div>
      </div>

      {/* Steps flow */}
      <div className="max-w-2xl mx-auto px-6 pt-6">
        {STEPS.map((step, idx) => {
          const isUnlocked = step.id <= highestUnlocked;
          const isActive = step.id === activeStep;
          const isCompleted = step.id < highestUnlocked;
          const isLast = idx === STEPS.length - 1;

          return (
            <div
              key={step.id}
              ref={(el) => { stepRefs.current[idx] = el; }}
              className="relative flex gap-5"
            >
              {/* ─── Left: indicator + line ──────────────────────── */}
              <div className="flex flex-col items-center shrink-0">
                {/* Circle */}
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={!isUnlocked}
                  className={cn(
                    "relative z-10 size-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 border-2",
                    isCompleted
                      ? "bg-gradient-brand border-transparent text-white cursor-pointer"
                      : isActive
                        ? "border-primary bg-background text-primary cursor-default"
                        : isUnlocked
                          ? "border-border bg-background text-muted-foreground cursor-pointer"
                          : "border-border/50 bg-secondary/30 text-muted-foreground/40 cursor-default"
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs font-semibold">{step.id}</span>
                  )}
                </button>

                {/* Connecting line */}
                {!isLast && (
                  <div className="relative w-[2px] flex-1 min-h-[24px] bg-border">
                    {isCompleted && (
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `linear-gradient(to bottom, ${getGradientColor(idx)} 0%, ${getGradientColor(idx + 1)} 100%)`,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* ─── Right: content ──────────────────────────────── */}
              <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                {/* Step header — always visible */}
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={!isUnlocked}
                  className={cn(
                    "flex items-center gap-2 -mt-0.5 mb-1 text-left transition-colors",
                    isUnlocked ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  <h2
                    className={cn(
                      "text-sm font-semibold transition-colors",
                      isActive
                        ? "text-foreground"
                        : isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                    )}
                  >
                    {step.label}
                  </h2>

                  {/* Summary when collapsed + completed */}
                  {isCompleted && !isActive && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      — {getStepSummary(step.id, form)}
                    </span>
                  )}
                </button>

                {/* Expandable content */}
                {isActive && isUnlocked && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {step.id === 1 && (
                      <StepName
                        value={form.name}
                        onChange={(v) => updateForm("name", v)}
                        error={error}
                        onContinue={() => handleContinue(1)}
                      />
                    )}
                    {step.id === 2 && (
                      <StepDescription
                        value={form.description}
                        onChange={(v) => updateForm("description", v)}
                        error={error}
                        onContinue={() => handleContinue(2)}
                      />
                    )}
                    {step.id === 3 && (
                      <StepBrandIdentity
                        colors={form.brand_colors}
                        fonts={form.brand_fonts}
                        logo={form.brand_logo}
                        guidelines={form.brand_guidelines}
                        newColor={newColor}
                        setNewColor={setNewColor}
                        onColorsChange={(v) => updateForm("brand_colors", v)}
                        onFontsChange={(v) => updateForm("brand_fonts", v)}
                        onLogoChange={(v) => updateForm("brand_logo", v)}
                        onGuidelinesChange={(v) => updateForm("brand_guidelines", v)}
                        onSubmit={handleSubmit}
                        submitting={submitting}
                        error={error}
                      />
                    )}
                  </div>
                )}

                {/* Locked state */}
                {!isUnlocked && (
                  <p className="text-xs text-muted-foreground/40 mt-1">
                    Complete the previous step to unlock.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const GRADIENT_COLORS = ["#0079d0", "#9e52d8", "#da365c", "#d04901"];

function getGradientColor(index: number): string {
  return GRADIENT_COLORS[Math.min(index, GRADIENT_COLORS.length - 1)];
}

function getStepSummary(stepId: number, form: FormData): string {
  switch (stepId) {
    case 1: return form.name.trim() || "Untitled brand";
    case 2: {
      const d = form.description.trim();
      return d.length > 40 ? d.slice(0, 40) + "…" : d || "No description";
    }
    case 3: {
      const parts: string[] = [];
      if (form.brand_colors.length) parts.push(`${form.brand_colors.length} color${form.brand_colors.length > 1 ? "s" : ""}`);
      if (form.brand_fonts.length) parts.push(`${form.brand_fonts.length} font${form.brand_fonts.length > 1 ? "s" : ""}`);
      return parts.join(", ") || "No brand set";
    }
    default: return "";
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   STEP COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function StepContinueButton({
  onClick,
  disabled,
  label = "Save & Continue",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex justify-end mt-5">
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
      >
        {label}
        <Check className="size-3.5" />
      </button>
    </div>
  );
}

/* ─── Step 1: Project Name ────────────────────────────────────────────── */

function StepName({
  value,
  onChange,
  error,
  onContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Give your brand a clear, recognizable name.
      </p>
      <input
        type="text"
        placeholder="e.g. Acme Co"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onContinue(); }
        }}
        autoFocus
        className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
        maxLength={100}
      />
      <div className="flex items-center justify-between mt-1.5">
        {error ? (
          <p className="text-xs text-destructive font-medium">{error}</p>
        ) : <span />}
        <p className="text-xs text-muted-foreground">{value.length}/100</p>
      </div>
      <StepContinueButton onClick={onContinue} disabled={!value.trim()} />
    </div>
  );
}

/* ─── Step 2: Description ─────────────────────────────────────────────── */

function StepDescription({
  value,
  onChange,
  error,
  onContinue,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Describe what your brand is about. This helps the AI understand your business.
      </p>
      <textarea
        placeholder="e.g. Ad creatives for our summer sneaker collection targeting 18-35 year olds on Instagram and TikTok…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.metaKey) { e.preventDefault(); onContinue(); }
        }}
        autoFocus
        rows={4}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
      />
      {error && <p className="text-xs text-destructive font-medium mt-1">{error}</p>}
      <StepContinueButton onClick={onContinue} disabled={!value.trim()} />
    </div>
  );
}

/* ─── Step 3: Brand Identity ──────────────────────────────────────────── */

function StepBrandIdentity({
  colors,
  fonts,
  logo,
  guidelines,
  newColor,
  setNewColor,
  onColorsChange,
  onFontsChange,
  onLogoChange,
  onGuidelinesChange,
  onSubmit,
  submitting,
  error,
}: {
  colors: string[];
  fonts: BrandFont[];
  logo: File | null;
  guidelines: string;
  newColor: string;
  setNewColor: (v: string) => void;
  onColorsChange: (v: string[]) => void;
  onFontsChange: (v: BrandFont[]) => void;
  onLogoChange: (v: File | null) => void;
  onGuidelinesChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string;
}) {
  function addColor() {
    if (colors.length >= 6 || colors.includes(newColor)) return;
    onColorsChange([...colors, newColor]);
  }

  function removeColor(hex: string) {
    onColorsChange(colors.filter((c) => c !== hex));
  }

  function addPresetFont(name: string) {
    if (fonts.some((f) => f.name === name)) return;
    onFontsChange([...fonts, { name, type: "preset" }]);
  }

  function removeFont(name: string) {
    onFontsChange(fonts.filter((f) => f.name !== name));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Optional. Define your brand&apos;s visual identity to help the AI create on-brand content.
      </p>

      {/* Colors */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Brand Colors</label>
        <div className="flex items-center gap-2 flex-wrap">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => removeColor(c)}
              className="size-8 rounded-lg border border-border relative group cursor-pointer transition-transform hover:scale-105"
              style={{ backgroundColor: c }}
              title={`Remove ${c}`}
            >
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-lg transition-opacity">
                <X className="size-3 text-white" />
              </span>
            </button>
          ))}
          {colors.length < 6 && (
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="size-8 rounded-lg border border-border cursor-pointer p-0 bg-transparent"
              />
              <button
                onClick={addColor}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-secondary/50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Fonts</label>
        {fonts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {fonts.map((f) => (
              <span
                key={f.name}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-medium"
              >
                {f.name}
                <button onClick={() => removeFont(f.name)} className="hover:text-destructive transition-colors cursor-pointer">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <select
            value=""
            onChange={(e) => { if (e.target.value) addPresetFont(e.target.value); }}
            className="appearance-none h-8 w-full rounded-lg border border-input bg-background px-3 pr-8 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">Select a font…</option>
            {PRESET_FONTS.filter((f) => !fonts.some((sf) => sf.name === f)).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
        </div>
        <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Plus className="size-3" />
          Upload custom font
          <input
            type="file"
            accept=".woff2,.ttf,.otf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const name = file.name.replace(/\.\w+$/, "");
                if (!fonts.some((f) => f.name === name)) onFontsChange([...fonts, { name, type: "custom" }]);
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Logo */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Brand Logo</label>
        {logo ? (
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
            <div className="size-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(logo)} alt="Logo" className="size-9 object-contain" />
            </div>
            <span className="text-xs truncate flex-1">{logo.name}</span>
            <button onClick={() => onLogoChange(null)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer">
            <Upload className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload logo (PNG, SVG, JPG)</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoChange(f); e.target.value = ""; }} />
          </label>
        )}
      </div>

      {/* Guidelines */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Brand Guidelines</label>
        <textarea
          placeholder="e.g. Tone is energetic and youthful. Always use uppercase headlines…"
          value={guidelines}
          onChange={(e) => onGuidelinesChange(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive font-medium mt-1">{error}</p>}

      <div className="flex justify-end mt-5">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-brand hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-default"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              Create Brand
              <Check className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
