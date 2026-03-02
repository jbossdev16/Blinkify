"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { BlinkifyLogo } from "@/components/blinkify-logo";

const inputBase =
  "flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none";

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

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; repeat?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(true);
      setValidLink(!!session);
    });
  }, [supabase.auth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: { password?: string; repeat?: string } = {};
    if (password.length < 8) next.password = "Password must be at least 8 characters";
    if (password !== repeat) next.repeat = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }
    toast.success("Password updated.");
    router.push("/signin");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!validLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-[400px] rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground mb-2">Invalid or expired link</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This reset link is invalid or has expired. Request a new one from the Log In page.
          </p>
          <Button asChild className="w-full cursor-pointer">
            <Link href="/signin">Back to Log In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-[400px] rounded-2xl border bg-card p-8 shadow-sm">
        <Link href="/" className="inline-block mb-6">
          <BlinkifyLogo variant="full" height={32} />
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-2">Set new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                aria-label="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                className={cn(inputBase, "pr-11", errors.password && "border-destructive/80")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeIcon className="size-[18px]" /> : <EyeOffIcon className="size-[18px]" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive/90 font-medium" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <input
                id="repeat"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat new password"
                aria-label="Repeat new password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => {
                  setRepeat(e.target.value);
                  if (errors.repeat) setErrors((p) => ({ ...p, repeat: undefined }));
                }}
                className={cn(inputBase, errors.repeat && "border-destructive/80")}
              />
            </div>
            {errors.repeat && (
              <p className="text-xs text-destructive/90 font-medium" role="alert">
                {errors.repeat}
              </p>
            )}
          </div>

          {errors.form && (
            <p className="text-xs text-destructive/90 font-medium" role="alert">
              {errors.form}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full font-semibold cursor-pointer" disabled={loading}>
            {loading ? "Updating…" : "Confirm"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          <Link href="/signin" className="text-primary font-medium hover:underline">
            Back to Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
