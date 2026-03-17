"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { BlinkifyLogo } from "@/components/blinkify-logo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

/* ─────────────────────────────────────────────
   3D Marquee images
───────────────────────────────────────────── */
const baseImages = [
  "/blinkify-1770839372135.png",
  "/blinkify-1770839665605.png",
  "/Starbucks AFTER.png",
  "/blinkify-1770843387104.png",
  "/blinkify-1770843757047.png",
  "/Skincare%20Product.webp",
  "/Sneakers.webp",
  "/Watch.webp",
  "/Headphones.webp",
  "/Coffee%20Bag.webp",
  "/Sunglasses.webp",
];

function getInitialMarqueeImages(): string[] {
  const cols: string[] = [];
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < 6; i++) cols.push(baseImages[i % baseImages.length]!);
  }
  return cols;
}

function shuffleMarqueeImages(): string[] {
  const cols: string[][] = [];
  for (let c = 0; c < 4; c++) {
    const pool = [...baseImages];
    const col: string[] = [];
    for (let i = 0; i < 6; i++) {
      const available = pool.length > 0
        ? pool.filter((img) => img !== col[col.length - 1])
        : baseImages.filter((img) => img !== col[col.length - 1]);
      const pick = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]!
        : baseImages[i % baseImages.length]!;
      col.push(pick);
      const idx = pool.indexOf(pick);
      if (idx !== -1) pool.splice(idx, 1);
    }
    cols.push(col);
  }
  return cols.flat();
}

function useShuffledImages() {
  const [images, setImages] = useState<string[]>(getInitialMarqueeImages);
  useEffect(() => {
    setImages(shuffleMarqueeImages());
  }, []);
  return images;
}

/* ─────────────────────────────────────────────
   Company logos
───────────────────────────────────────────── */
const companyLogos = [
  { name: "Google", src: "/Google/Google_Logo_0.svg" },
  { name: "Microsoft", src: "/Microsoft/Microsoft_Logo_0.svg" },
  { name: "Amazon", src: "/Amazon/Amazon_Logo_0.svg" },
  { name: "Netflix", src: "/Netflix/Netflix_Logo_0.svg" },
  { name: "Shopify", src: "/Shopify.com/Shopify.com_Logo_0.svg" },
  { name: "NVIDIA", src: "/NVIDIA/NVIDIA_Logo_0.svg" },
  { name: "TikTok", src: "/TikTok/TikTok_Logo_0.svg" },
];

/* ─────────────────────────────────────────────
   Icons
───────────────────────────────────────────── */
function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   SIGNUP PAGE
───────────────────────────────────────────── */
const inputBase =
  "flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none";

type FormErrors = { firstName?: string; lastName?: string; email?: string; password?: string; agreeToTerms?: string; form?: string };
type Step = "form" | "verify";

const COOLDOWN_SECONDS = 30;
const CODE_LENGTH = 6;

export default function SignupPage() {
  const marqueeImages = useShuffledImages();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Form state
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Verification state
  const [step, setStep] = useState<Step>("form");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start cooldown timer
  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ─── Step 1: Submit form → send code ───────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: FormErrors = {};
    if (!firstName.trim()) next.firstName = "First name is required";
    if (!lastName.trim()) next.lastName = "Last name is required";
    if (!email.trim()) next.email = "Email is required";
    if (!password) next.password = "Password is required";
    else if (password.length < 8) next.password = "Password must be at least 8 characters";
    if (!agreeToTerms) next.agreeToTerms = "You must agree to the Terms and Privacy Policy to sign up.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ form: data.error || "Something went wrong" });
        setLoading(false);
        return;
      }
      // Move to verify step
      setStep("verify");
      startCooldown();
      setCode(Array(CODE_LENGTH).fill(""));
      setVerifyError("");
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 2: Verify code ───────────────────────────────────────────────────
  async function handleVerify() {
    const fullCode = code.join("");
    if (fullCode.length !== CODE_LENGTH) {
      setVerifyError("Please enter the full 6-digit code");
      return;
    }

    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await fetch(`${API_URL}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Verification failed");
        setVerifyLoading(false);
        return;
      }
      // Store email for plan setup page, then redirect
      if (typeof window !== "undefined") {
        sessionStorage.setItem("signup_email", email.trim());
        if (typeof (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag === "function") {
          (window as unknown as { gtag: (...a: unknown[]) => void }).gtag("event", "signup_complete", { method: "email" });
        }
      }
      router.push("/setup-plan");
    } catch {
      setVerifyError("Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  }

  // ─── Resend code ───────────────────────────────────────────────────────────
  async function handleResend() {
    if (cooldown > 0) return;
    setVerifyError("");
    try {
      const res = await fetch(`${API_URL}/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Failed to resend code");
        return;
      }
      startCooldown();
      setCode(Array(CODE_LENGTH).fill(""));
    } catch {
      setVerifyError("Network error. Please try again.");
    }
  }

  // ─── Code input handlers ───────────────────────────────────────────────────
  function handleCodeChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (verifyError) setVerifyError("");

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && code.join("").length === CODE_LENGTH) {
      handleVerify();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    // Focus the next empty or last field
    const nextIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[nextIdx]?.focus();
  }

  // ─── Left panel content based on step ──────────────────────────────────────
  function renderFormStep() {
    return (
      <div className="relative z-10 w-full max-w-[400px] px-8">
        <Link href="/" className="block w-full h-[50px] mb-8">
          <Image src="/logo/blinkify-logo-color.svg" alt="Blinkify" width={200} height={50} className="w-full h-full object-contain" />
        </Link>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <input
                type="text"
                placeholder="First name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                }}
                className={cn(inputBase, errors.firstName && "border-destructive/80")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive/90 font-medium" role="alert">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
                }}
                className={cn(inputBase, errors.lastName && "border-destructive/80")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive/90 font-medium" role="alert">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="Email Address"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={cn(inputBase, "pr-11", errors.email && "border-destructive/80")}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <EnvelopeIcon className="size-[18px]" />
              </div>
            </div>
            {errors.email && (
              <p className="text-xs text-destructive/90 font-medium" role="alert">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <input
                id="password"
                type={passwordVisible ? "text" : "password"}
                placeholder="Password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className={cn(inputBase, "pr-11", errors.password && "border-destructive/80")}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
              >
                {passwordVisible ? <EyeIcon className="size-[18px]" /> : <EyeOffIcon className="size-[18px]" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive/90 font-medium" role="alert">{errors.password}</p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => {
                setAgreeToTerms(e.target.checked);
                if (errors.agreeToTerms) setErrors((prev) => ({ ...prev, agreeToTerms: undefined }));
              }}
              className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              aria-describedby={errors.agreeToTerms ? "agree-error" : undefined}
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground/90 transition-colors">
              I agree to the{" "}
              <Link href="/terms" className="text-primary font-medium hover:underline" target="_blank" rel="noopener noreferrer">
                Terms
              </Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-primary font-medium hover:underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.agreeToTerms && (
            <p id="agree-error" className="text-xs text-destructive/90 font-medium -mt-2" role="alert">{errors.agreeToTerms}</p>
          )}

          {errors.form && (
            <p className="text-xs text-destructive/90 font-medium text-center" role="alert">{errors.form}</p>
          )}

          <Button type="submit" size="lg" className="w-full mt-2 font-semibold cursor-pointer" disabled={loading}>
            {loading ? "Sending code…" : "Sign Up"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-8 text-center">
          Already have an account?{" "}
          <Link href="/signin" className="text-primary font-medium hover:underline">Log In</Link>
        </p>
      </div>
    );
  }

  function renderVerifyStep() {
    return (
      <div className="relative z-10 w-full max-w-[400px] px-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => { setStep("form"); setVerifyError(""); }}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
          <Link href="/">
            <BlinkifyLogo variant="full" height={32} />
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
          Check your email
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          We sent a 6-digit verification code to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>

        {/* 6-digit code input */}
        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={code[i]}
              onChange={(e) => handleCodeChange(i, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(i, e)}
              onPaste={i === 0 ? handleCodePaste : undefined}
              className={cn(
                "w-12 h-14 text-center text-xl font-semibold rounded-xl border border-input bg-white",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                "transition-all",
                verifyError && "border-destructive/60"
              )}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {verifyError && (
          <p className="text-xs text-destructive/90 font-medium text-center mb-4" role="alert">
            {verifyError}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full font-semibold cursor-pointer"
          disabled={verifyLoading || code.join("").length !== CODE_LENGTH}
          onClick={handleVerify}
        >
          {verifyLoading ? "Verifying…" : "Confirm"}
        </Button>

        {/* Resend with cooldown */}
        <div className="text-center mt-6">
          {cooldown > 0 ? (
            <p className="text-sm text-muted-foreground">
              Resend code in <span className="font-medium text-foreground">{cooldown}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-sm text-primary font-medium hover:underline cursor-pointer"
            >
              Resend code
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden">
      {/* Background: full-screen 3D marquee */}
      <div className="absolute inset-0 z-0 min-h-screen">
        <ThreeDMarquee
          images={marqueeImages}
          aspectRatio="9/16"
          className="h-full w-full min-h-screen rounded-none pointer-events-none"
        />
      </div>

      {/* Left: form / verification */}
      <div className="relative z-10 w-full lg:w-1/2 min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-white" />
        {step === "form" ? renderFormStep() : renderVerifyStep()}
      </div>

      {/* Right: 3D marquee + companies marquee */}
      <div className="relative z-10 hidden lg:flex lg:w-1/2 min-h-screen flex-col pointer-events-auto border-l border-border">
        <div className="flex-1 relative" />
        <div className="relative bg-white py-5 border-t border-border">
          <div className="relative overflow-hidden h-8">
            <div className="group flex w-max animate-marquee items-center h-full">
              {companyLogos.map((company) => (
                <div key={company.name} className="group/logo shrink-0 w-[140px] h-6 flex items-center justify-center mx-3 cursor-default relative">
                  <Image src={company.src} alt={company.name} width={140} height={24} className="h-full w-full object-contain opacity-100 grayscale-0 group-hover:opacity-40 group-hover:grayscale group-hover/logo:opacity-100 group-hover/logo:grayscale-0" />
                </div>
              ))}
              {companyLogos.map((company) => (
                <div key={`${company.name}-dup`} className="group/logo shrink-0 w-[140px] h-6 flex items-center justify-center mx-3 cursor-default relative">
                  <Image src={company.src} alt={company.name} width={140} height={24} className="h-full w-full object-contain opacity-100 grayscale-0 group-hover:opacity-40 group-hover:grayscale group-hover/logo:opacity-100 group-hover/logo:grayscale-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
