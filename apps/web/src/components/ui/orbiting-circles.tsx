"use client";

import { cn } from "@/utils/cn";

export interface OrbitingCirclesProps {
  className?: string;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  children?: React.ReactNode;
}

export function OrbitingCircles({
  className,
  reverse = false,
  duration = 20,
  delay = 0,
  radius = 50,
  path = true,
  children,
}: OrbitingCirclesProps) {
  if (!path) return null;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <circle
          className="stroke-black/10 stroke-1 dark:stroke-white/10"
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          strokeDasharray="4 4"
        />
      </svg>
      <div
        style={
          {
            "--duration": duration,
            "--radius": radius,
            animationDelay: `-${delay}s`,
          } as React.CSSProperties
        }
        className={cn(
          "absolute flex h-full w-full transform-gpu animate-orbit items-center justify-center rounded-full border bg-black/10 dark:bg-white/10",
          reverse && "[animation-direction:reverse]",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}
