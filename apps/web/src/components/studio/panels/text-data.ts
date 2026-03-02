import type { TextNode } from "../types";

const cx = 540;
const cy = 540;

/** System and common web-safe fonts that work in canvas without loading. */
export const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
  "Impact",
  "Comic Sans MS",
  "Palatino Linotype",
  "Lucida Sans Unicode",
  "Lucida Console",
  "Garamond",
  "Bookman",
  "Arial Black",
] as const;

export type TextPreset = {
  label: string;
  add: () => Omit<TextNode, "id">;
};

function text(
  content: string,
  fontSize: number,
  fontFamily: string,
  width: number,
  height: number,
  fill: string = "#000000"
): Omit<TextNode, "id"> {
  return {
    type: "text",
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    text: content,
    fontSize,
    fontFamily,
    fill,
  };
}

export const TEXT_PRESETS: TextPreset[] = [
  { label: "Heading", add: () => text("Heading", 48, "Arial", 400, 80) },
  { label: "Subheading", add: () => text("Subheading", 36, "Arial", 400, 60) },
  { label: "Title", add: () => text("Title", 56, "Helvetica", 400, 90) },
  { label: "Body", add: () => text("Add your text here", 24, "Arial", 500, 48, "#374151") },
  { label: "Caption", add: () => text("Caption text", 14, "Arial", 400, 24, "#6b7280") },
  { label: "Quote", add: () => text("Quote or callout", 28, "Georgia", 450, 48, "#374151") },
  { label: "Bullet", add: () => text("• Item one", 22, "Arial", 400, 32) },
  { label: "Label", add: () => text("Label", 12, "Arial", 200, 20, "#6b7280") },
  { label: "Big title", add: () => text("Big Title", 72, "Impact", 500, 100) },
  { label: "Serif body", add: () => text("Serif paragraph", 20, "Georgia", 480, 36, "#1f2937") },
  { label: "Monospace", add: () => text("Code or data", 18, "Courier New", 400, 28, "#111827") },
  { label: "Light heading", add: () => text("Light", 40, "Helvetica", 300, 56, "#6b7280") },
  { label: "Two lines", add: () => text("Line one\nLine two", 24, "Arial", 400, 60) },
  { label: "CTA", add: () => text("Click here", 20, "Arial", 200, 36, "#2563eb") },
  { label: "Overline", add: () => text("OVERLINE", 11, "Arial", 300, 18, "#9ca3af") },
  { label: "Number", add: () => text("01", 64, "Arial", 120, 80) },
  { label: "Price", add: () => text("$99", 48, "Helvetica", 150, 70) },
  { label: "Date", add: () => text("Jan 15, 2025", 16, "Arial", 200, 24, "#6b7280") },
  { label: "Author", add: () => text("By Author Name", 14, "Georgia", 250, 22, "#6b7280") },
  { label: "Tag", add: () => text("#tag", 14, "Arial", 80, 24, "#6366f1") },
];
