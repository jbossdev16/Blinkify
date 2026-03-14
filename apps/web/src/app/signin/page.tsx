"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

/** Allow only relative app paths to prevent open redirects. */
function safeReturnTo(value: string | null): string {
  if (!value || typeof value !== "string") return "/creative-studio";
  const path = value.trim();
  if (!path.startsWith("/") || path.includes("//") || path.includes(":")) return "/creative-studio";
  return path;
}

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

const companyLogos = [
  { name: "Google", src: "/Google/Google_Logo_0.svg" },
  { name: "Microsoft", src: "/Microsoft/Microsoft_Logo_0.svg" },
  { name: "Amazon", src: "/Amazon/Amazon_Logo_0.svg" },
  { name: "Netflix", src: "/Netflix/Netflix_Logo_0.svg" },
  { name: "Shopify", src: "/Shopify.com/Shopify.com_Logo_0.svg" },
  { name: "NVIDIA", src: "/NVIDIA/NVIDIA_Logo_0.svg" },
  { name: "TikTok", src: "/TikTok/TikTok_Logo_0.svg" },
];

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

const inputBase =
  "flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none";

type FormErrors = { email?: string; password?: string; form?: string };

type ForgotErrors = { email?: string; form?: string };

export default function SigninPage() {
  return (
    <Suspense>
      <SigninContent />
    </Suspense>
  );
}

function SigninContent() {
  const marqueeImages = useShuffledImages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const verified = searchParams.get("verified") === "true";
  const supabase = createSupabaseBrowserClient();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotErrors, setForgotErrors] = useState<ForgotErrors>({});
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: FormErrors = {};
    if (!email.trim()) next.email = "Email is required";
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }

    router.push(returnTo);
    router.refresh();
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: ForgotErrors = {};
    const trimmed = forgotEmail.trim();
    if (!trimmed) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next.email = "Enter a valid email";
    setForgotErrors(next);
    if (Object.keys(next).length > 0) return;

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotErrors({ form: data.error ?? "Failed to send reset link" });
        setForgotLoading(false);
        return;
      }
      toast.success("Reset link sent. Check your email.");
      setForgotSent(true);
    } catch {
      setForgotErrors({ form: "Network error. Please try again." });
    } finally {
      setForgotLoading(false);
    }
  }

  useEffect(() => {
    if (!forgotSent) return;
    const t = setTimeout(() => {
      window.location.href = "/signin";
    }, 1000);
    return () => clearTimeout(t);
  }, [forgotSent]);

  return (
    <div className="relative min-h-screen flex overflow-hidden">
      <div className="absolute inset-0 z-0 min-h-screen">
        <ThreeDMarquee
          images={marqueeImages}
          aspectRatio="9/16"
          className="h-full w-full min-h-screen rounded-none pointer-events-none"
        />
      </div>

      <div className="relative z-10 w-full lg:w-1/2 min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-white" />

        <div className="relative z-10 w-full max-w-[400px] px-8">
          <div className={cn("mb-8", forgotMode && "flex items-center gap-3")}>
            {forgotMode && (
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setForgotEmail("");
                  setForgotErrors({});
                  setForgotSent(false);
                }}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                aria-label="Back"
              >
                <ArrowLeftIcon className="size-5" />
              </button>
            )}
            <Link href="/" className="block w-full min-w-0 h-[50px]">
              <img src="/logo/blinkify-logo-color.svg" alt="Blinkify" className="w-full h-full object-contain" />
            </Link>
          </div>

          {forgotMode && (
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
              Reset Password
            </h1>
          )}

          {!forgotMode && verified && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Email verified successfully. You can now Log In.
            </div>
          )}

          {forgotMode ? (
            <div className="flex flex-col gap-4">
              {forgotSent ? (
                <p className="text-sm text-muted-foreground">Redirecting to Log In…</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-8">
                    Enter your email and we&apos;ll send you a link to reset your password.
                  </p>
                  <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                    <div className="space-y-1">
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="Email Address"
                          autoComplete="email"
                          value={forgotEmail}
                          onChange={(e) => {
                            setForgotEmail(e.target.value);
                            if (forgotErrors.email) setForgotErrors((p) => ({ ...p, email: undefined }));
                          }}
                          className={cn(inputBase, "pr-11", forgotErrors.email && "border-destructive/80")}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                          <EnvelopeIcon className="size-[18px]" />
                        </div>
                      </div>
                      {forgotErrors.email && (
                        <p className="text-xs text-destructive/90 font-medium" role="alert">
                          {forgotErrors.email}
                        </p>
                      )}
                    </div>
                    {forgotErrors.form && (
                      <p className="text-xs text-destructive/90 font-medium" role="alert">
                        {forgotErrors.form}
                      </p>
                    )}
                    <Button type="submit" className="w-full cursor-pointer" disabled={forgotLoading}>
                      {forgotLoading ? "Sending…" : "Send Reset Link"}
                    </Button>
                  </form>
                </>
              )}
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                <p className="text-xs text-destructive/90 font-medium" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="relative">
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
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
                  {passwordVisible ? (
                    <EyeIcon className="size-[18px]" />
                  ) : (
                    <EyeOffIcon className="size-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive/90 font-medium" role="alert">
                  {errors.password}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-sm text-primary font-medium hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {errors.form && (
              <p className="text-xs text-destructive/90 font-medium text-center" role="alert">
                {errors.form}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full mt-2 font-semibold cursor-pointer" disabled={loading}>
              {loading ? "Logging In…" : "Log In"}
            </Button>
          </form>
          )}

          {!forgotMode && (
            <p className="text-sm text-muted-foreground mt-8 text-center">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="relative z-10 hidden lg:flex lg:w-1/2 min-h-screen flex-col pointer-events-auto border-l border-border">
        <div className="flex-1 relative" />
        <div className="relative bg-white py-5 border-t border-border">
          <div className="relative overflow-hidden h-8">
            <div className="group flex w-max animate-marquee items-center h-full">
              {companyLogos.map((company) => (
                <div key={company.name} className="group/logo shrink-0 w-[140px] h-6 flex items-center justify-center mx-3 cursor-default">
                  <img src={company.src} alt={company.name} className="h-full w-full object-contain opacity-100 grayscale-0 group-hover:opacity-40 group-hover:grayscale group-hover/logo:opacity-100 group-hover/logo:grayscale-0" />
                </div>
              ))}
              {companyLogos.map((company) => (
                <div key={`${company.name}-dup`} className="group/logo shrink-0 w-[140px] h-6 flex items-center justify-center mx-3 cursor-default">
                  <img src={company.src} alt={company.name} className="h-full w-full object-contain opacity-100 grayscale-0 group-hover:opacity-40 group-hover:grayscale group-hover/logo:opacity-100 group-hover/logo:grayscale-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
