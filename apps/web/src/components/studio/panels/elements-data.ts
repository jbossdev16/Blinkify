import type { StudioNode } from "../types";

const cx = 540;
const cy = 540;

export type ElementPreset = {
  label: string;
  icon: string;
  add: () => Omit<StudioNode, "id">;
};

const colors = {
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  slate: "#64748b",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
  teal: "#14b8a6",
  red: "#ef4444",
  indigo: "#6366f1",
  lime: "#84cc16",
  white: "#ffffff",
  black: "#0f172a",
};

function rect(w: number, h: number, fill: string, stroke?: string) {
  return {
    type: "rect" as const,
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
    fill,
    stroke,
    strokeWidth: stroke ? 2 : undefined,
  };
}
function ellipse(w: number, h: number, fill: string, stroke?: string) {
  return {
    type: "ellipse" as const,
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
    fill,
    stroke,
    strokeWidth: stroke ? 2 : undefined,
  };
}
function star(s: number, fill: string, stroke?: string) {
  return {
    type: "star" as const,
    x: cx - s / 2,
    y: cy - s / 2,
    width: s,
    height: s,
    fill,
    stroke,
    strokeWidth: stroke ? 2 : undefined,
  };
}
function polygon(sides: number, s: number, fill: string, stroke?: string) {
  return {
    type: "regularPolygon" as const,
    sides,
    x: cx - s / 2,
    y: cy - s / 2,
    width: s,
    height: s,
    fill,
    stroke,
    strokeWidth: stroke ? 2 : undefined,
  };
}
function arrow(fill: string, strokeW: number = 4) {
  const half = 140;
  return {
    type: "line" as const,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [cx - half, cy, cx + half, cy],
    stroke: fill,
    strokeWidth: strokeW,
    pointerLength: 16,
    pointerWidth: 16,
    pointerAtBeginning: false,
    pointerAtEnding: true,
  };
}
function line(fill: string, strokeW: number = 4) {
  const half = 140;
  return {
    type: "line" as const,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [cx - half, cy, cx + half, cy],
    stroke: fill,
    strokeWidth: strokeW,
    tension: 0,
  };
}
function curvedLine(fill: string) {
  const half = 140;
  return {
    type: "line" as const,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [cx - half, cy, cx, cy - 60, cx + half, cy],
    stroke: fill,
    strokeWidth: 4,
    tension: 0.5,
  };
}

export const ELEMENT_PRESETS: { category: string; presets: ElementPreset[] }[] = [
  {
    category: "Rectangles",
    presets: [
      ...["blue", "emerald", "amber", "rose", "violet", "cyan", "orange", "pink", "teal", "red", "indigo", "lime"].map(
        (c) => ({
          label: `Rect ${c}`,
          icon: "▭",
          add: () => rect(200, 140, (colors as Record<string, string>)[c]),
        })
      ),
      { label: "Square", icon: "□", add: () => rect(140, 140, colors.blue) },
      { label: "Wide bar", icon: "▬", add: () => rect(300, 48, colors.slate) },
      { label: "Tall bar", icon: "▮", add: () => rect(48, 200, colors.violet) },
      { label: "Rect outline", icon: "▭", add: () => rect(180, 120, "transparent", colors.blue) },
    ],
  },
  {
    category: "Circles & ellipses",
    presets: [
      { label: "Circle blue", icon: "●", add: () => ellipse(120, 120, colors.blue) },
      { label: "Circle emerald", icon: "●", add: () => ellipse(120, 120, colors.emerald) },
      { label: "Circle amber", icon: "●", add: () => ellipse(120, 120, colors.amber) },
      { label: "Circle rose", icon: "●", add: () => ellipse(120, 120, colors.rose) },
      { label: "Oval horizontal", icon: "⬭", add: () => ellipse(200, 100, colors.cyan) },
      { label: "Oval vertical", icon: "⬯", add: () => ellipse(100, 200, colors.violet) },
      { label: "Circle outline", icon: "○", add: () => ellipse(100, 100, "transparent", colors.slate) },
    ],
  },
  {
    category: "Stars",
    presets: [
      { label: "Star 5", icon: "★", add: () => star(120, colors.amber) },
      { label: "Star blue", icon: "★", add: () => star(100, colors.blue) },
      { label: "Star emerald", icon: "★", add: () => star(100, colors.emerald) },
      { label: "Star rose", icon: "★", add: () => star(100, colors.rose) },
      { label: "Star violet", icon: "★", add: () => star(100, colors.violet) },
      { label: "Star outline", icon: "☆", add: () => star(100, "transparent", colors.amber) },
    ],
  },
  {
    category: "Triangles & polygons",
    presets: [
      { label: "Triangle", icon: "△", add: () => polygon(3, 140, colors.blue) },
      { label: "Triangle emerald", icon: "△", add: () => polygon(3, 140, colors.emerald) },
      { label: "Diamond", icon: "◇", add: () => polygon(4, 120, colors.violet) },
      { label: "Square shape", icon: "◇", add: () => polygon(4, 120, colors.cyan) },
      { label: "Pentagon", icon: "⬠", add: () => polygon(5, 120, colors.orange) },
      { label: "Hexagon", icon: "⬡", add: () => polygon(6, 120, colors.rose) },
      { label: "Octagon", icon: "⯃", add: () => polygon(8, 120, colors.teal) },
    ],
  },
  {
    category: "Lines & arrows",
    presets: [
      { label: "Arrow right", icon: "→", add: () => arrow(colors.blue) },
      { label: "Arrow red", icon: "→", add: () => arrow(colors.red) },
      { label: "Arrow thick", icon: "⇒", add: () => arrow(colors.slate, 8) },
      { label: "Line", icon: "—", add: () => line(colors.slate) },
      { label: "Curved line", icon: "⌒", add: () => curvedLine(colors.violet) },
    ],
  },
];
