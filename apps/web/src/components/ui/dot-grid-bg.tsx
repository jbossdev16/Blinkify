import { cn } from "@/lib/utils";

type DotGridBgProps = {
  className?: string;
  /**
   * `fixed` — viewport-fixed (Brand, Asset Collection pages).
   * `absolute` — fill a `relative` parent (Creative Studio results pane).
   */
  position?: "fixed" | "absolute";
};

/**
 * Subtle dot texture. Uses class-based dark mode (ancestor `.dark`), matching globals.css.
 */
export function DotGridBg({ className, position = "fixed" }: DotGridBgProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none inset-0 z-0",
        position === "fixed" ? "fixed" : "absolute",
        "[background-image:radial-gradient(var(--dot-color,rgba(0,0,0,0.08))_1px,transparent_1px)]",
        "[background-size:24px_24px]",
        "[--dot-color:rgba(0,0,0,0.08)]",
        "dark:[--dot-color:rgba(255,255,255,0.07)]",
        className
      )}
    />
  );
}
