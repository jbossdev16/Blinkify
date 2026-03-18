"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL === "https://blinkify.ai"
    ? "https://app.blinkify.ai"
    : "";

const DEMO_VIDEO_SRC = "/blinkify-demo.webm";

const PLACEHOLDER_SITES = [
  "yourwebsite.com",
  "starbucks.com",
  "instagram.com",
  "linkedin.com",
  "acme.com",
];
const TYPING_SPEED = 80;
const HOLD_DURATION = 1000;

export function HeroForm() {
  const [displayText, setDisplayText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const animatingRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let idx = 0;
    let charPos = 0;
    let deleting = false;
    animatingRef.current = true;

    function tick() {
      if (!animatingRef.current) return;
      const word = PLACEHOLDER_SITES[idx];
      if (!deleting) {
        charPos++;
        setDisplayText(word.slice(0, charPos));
        if (charPos >= word.length) {
          deleting = true;
          timeoutRef.current = setTimeout(tick, HOLD_DURATION);
          return;
        }
      } else {
        charPos--;
        setDisplayText(word.slice(0, charPos));
        if (charPos <= 0) {
          deleting = false;
          idx = (idx + 1) % PLACEHOLDER_SITES.length;
          timeoutRef.current = setTimeout(tick, HOLD_DURATION);
          return;
        }
      }
      timeoutRef.current = setTimeout(tick, TYPING_SPEED);
    }

    timeoutRef.current = setTimeout(tick, HOLD_DURATION);
    return () => {
      animatingRef.current = false;
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    animatingRef.current = false;
    clearTimeout(timeoutRef.current);
    setDisplayText("");
  };

  const handleBlur = () => {
    if (!userInput) setIsFocused(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `${APP_BASE}/signup${userInput ? `?website=${encodeURIComponent(userInput)}` : ""}`;
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="flex items-center rounded-full border-2 border-black/[0.08] bg-white shadow-lg shadow-black/[0.04] overflow-hidden h-14 pl-5 pr-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full bg-transparent text-base text-[#000000] outline-none placeholder-transparent"
            placeholder="yourwebsite.com"
          />
          {!isFocused && !userInput && (
            <span className="pointer-events-none absolute inset-0 flex items-center text-base text-black/40">
              {displayText}
              <span className="inline-block w-[2px] h-5 bg-black/40 ml-[1px] animate-pulse" />
            </span>
          )}
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center justify-center rounded-full bg-[hsl(var(--primary))] hover:bg-[hsl(211_100%_28%)] text-white text-base font-semibold px-6 h-10 transition-colors ml-2"
        >
          Get Started
        </button>
      </div>
    </form>
  );
}

/** Loads video src only on first play to avoid 12MB on initial load. */
export function DemoVideoPlayer({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const srcSetRef = useRef(false);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (!srcSetRef.current) {
        srcSetRef.current = true;
        setLoading(true);
        v.src = DEMO_VIDEO_SRC;
        const onCanPlay = () => {
          v.removeEventListener("canplay", onCanPlay);
          v.removeEventListener("error", onError);
          setLoading(false);
          v.play().catch(() => setLoading(false));
        };
        const onError = () => {
          v.removeEventListener("canplay", onCanPlay);
          v.removeEventListener("error", onError);
          setLoading(false);
        };
        v.addEventListener("canplay", onCanPlay);
        v.addEventListener("error", onError);
        return;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    v.addEventListener("pause", onPause);
    v.addEventListener("play", onPlay);
    return () => {
      v.removeEventListener("pause", onPause);
      v.removeEventListener("play", onPlay);
    };
  }, []);

  const showOverlay = !playing || loading;

  return (
    <div
      className={cn("relative w-full h-full cursor-pointer group", className)}
      onClick={toggle}
    >
      <video
        ref={videoRef}
        loop
        playsInline
        preload="none"
        className="absolute inset-0 w-full h-full object-cover bg-slate-200"
        aria-label="Blinkify demo"
      />
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 transition-opacity">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            {loading ? (
              <span className="inline-block w-6 h-6 md:w-8 md:h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Play
                className="h-7 w-7 md:h-9 md:w-9 text-black ml-1"
                fill="currentColor"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
