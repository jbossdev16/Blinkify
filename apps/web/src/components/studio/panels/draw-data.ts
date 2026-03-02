import type { LineNode } from "../types";

const cx = 540;
const cy = 540;
const halfLen = 160;

export type DrawPreset = {
  label: string;
  icon: string;
  add: () => Omit<LineNode, "id">;
};

const colors = [
  "#000000",
  "#374151",
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

export const DRAW_PRESETS: DrawPreset[] = [
  { label: "Line", icon: "—", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke: "#000", strokeWidth: 4, tension: 0 }) },
  { label: "Curved line", icon: "⌒", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx, cy - 70, cx + halfLen, cy], stroke: "#000", strokeWidth: 4, tension: 0.5 }) },
  { label: "Arrow →", icon: "→", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke: "#000", strokeWidth: 4, pointerLength: 14, pointerWidth: 14, pointerAtBeginning: false, pointerAtEnding: true }) },
  { label: "Arrow ←", icon: "←", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke: "#000", strokeWidth: 4, pointerLength: 14, pointerWidth: 14, pointerAtBeginning: true, pointerAtEnding: false }) },
  { label: "Double arrow", icon: "↔", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke: "#000", strokeWidth: 4, pointerLength: 14, pointerWidth: 14, pointerAtBeginning: true, pointerAtEnding: true }) },
  { label: "Thick line", icon: "━", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke: "#000", strokeWidth: 10, tension: 0 }) },
  { label: "Thin line", icon: "─", add: () => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke: "#374151", strokeWidth: 1.5, tension: 0 }) },
  ...colors.map((stroke, i) => ({
    label: `Line ${["black", "gray", "blue", "red", "green", "amber", "violet", "pink"][i]}`,
    icon: "—",
    add: (): Omit<LineNode, "id"> => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke, strokeWidth: 4, tension: 0 }),
  })),
  ...colors.map((stroke, i) => ({
    label: `Arrow ${["black", "gray", "blue", "red", "green", "amber", "violet", "pink"][i]}`,
    icon: "→",
    add: (): Omit<LineNode, "id"> => ({ type: "line", x: 0, y: 0, width: 0, height: 0, points: [cx - halfLen, cy, cx + halfLen, cy], stroke, strokeWidth: 4, pointerLength: 14, pointerWidth: 14, pointerAtBeginning: false, pointerAtEnding: true }),
  })),
];
